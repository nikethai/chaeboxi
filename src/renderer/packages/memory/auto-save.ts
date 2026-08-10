import type { Message, SessionSettings } from '@shared/types'
import { toast } from 'sonner'
import { getLogger } from '@/lib/utils'
import { ensureMemoryStoreInit, memoryStore } from '@/stores/memoryStore'
import {
  applyFactsToBanks,
  extractFactsFromTranscript,
  rebuildProfileLocal,
  transcriptFromMessages,
} from './extract'
import { getMemoryMessageText } from './message-text'
import { recordAutosave } from './metrics'
import { isSessionMemoryAutoSaveAllowed } from './session-policy'

const log = getLogger('memory-auto-save')

/** Serialize auto-save per session to avoid races */
const inFlight = new Set<string>()

export async function maybeAutoSaveMemory(options: {
  sessionId: string
  messages: Message[]
  agentId?: string
  sessionSettings?: SessionSettings
}): Promise<void> {
  const { sessionId, messages, agentId, sessionSettings } = options

  await ensureMemoryStoreInit()
  const store = memoryStore.getState()
  const settings = store.settings
  // Policy before turn bump so re-enabling session auto-save does not skip a cadence tick
  if (!isSessionMemoryAutoSaveAllowed(settings, sessionSettings)) return
  if (inFlight.has(sessionId)) return

  const every = Math.max(1, settings.retainEveryNTurns || 3)
  const turnCount = store.bumpSessionTurn(sessionId)
  if (turnCount % every !== 0) return

  inFlight.add(sessionId)
  try {
    if (agentId) {
      await store.ensureAgentBank(agentId)
    }

    const state = memoryStore.getState()
    const transcript = transcriptFromMessages(messages)
    if (!transcript.trim()) return

    const existingSummaries = [
      state.globalBank.profileSummary,
      agentId ? state.agentBanks[agentId]?.profileSummary : '',
    ]
      .filter(Boolean)
      .join('\n')

    const extracted = await extractFactsFromTranscript({
      transcript,
      existingSummaries,
      hasAgent: Boolean(agentId),
      sessionSettings,
    })

    if (extracted.error) {
      log.error('auto extract failed', extracted.error)
    }

    let facts = extracted.facts ?? []
    if (facts.length > 0) {
      recordAutosave('extracted', facts.length)
    }

    // Optional fallback (default off): pin last user message when extract empty
    if (facts.length === 0 && settings.autoSaveFallbackPin) {
      const lastUser = [...messages].reverse().find((m) => m.role === 'user')
      const raw = lastUser ? getMemoryMessageText(lastUser) : ''
      if (raw && raw.length >= 8 && raw.length <= 400) {
        if (!/^\//.test(raw) && raw.split(/\s+/).length >= 2) {
          facts = [
            {
              content: raw.slice(0, settings.maxEntryChars || 500),
              tags: ['auto', 'conversation'],
              scope: 'global',
            },
          ]
          recordAutosave('fallback_pinned', 1)
        }
      }
    }

    if (facts.length === 0) {
      if (settings.showMemoryUpdatedToast) {
        toast.message('Memory: no durable facts this turn')
      }
      return
    }

    const applied = applyFactsToBanks({
      facts,
      globalBank: state.globalBank,
      agentBank: agentId ? state.agentBanks[agentId] : null,
      agentId,
      settings,
      sourceSessionId: sessionId,
      source: 'auto',
    })

    let globalBank = rebuildProfileLocal(applied.globalBank)
    let agentBank = applied.agentBank ? rebuildProfileLocal(applied.agentBank) : null

    await memoryStore.getState().replaceGlobalBank(globalBank)
    if (agentId && agentBank) {
      await memoryStore.getState().replaceAgentBank(agentId, agentBank)
    }

    // Lazy LLM consolidate: schedule after N retains, not every auto-save
    if (settings.autoConsolidate) {
      memoryStore.getState().noteRetainsAndMaybeConsolidate(applied.added.length, {
        agentId,
        sessionSettings,
      })
    }

    store.resetSessionTurn(sessionId)
    recordAutosave('applied', applied.added.length)

    if (settings.showMemoryUpdatedToast && applied.added.length > 0) {
      toast.success(`Memory updated (${applied.added.length})`)
    }
  } catch (e) {
    log.error('auto-save failed', e)
    if (settings.showMemoryUpdatedToast) {
      toast.error('Memory auto-save failed')
    }
  } finally {
    inFlight.delete(sessionId)
  }
}
