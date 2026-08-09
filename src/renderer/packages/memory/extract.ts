import { getModel } from '@shared/models'
import type { MemoryBank, MemoryEntry, MemorySettings } from '@shared/types/memory'
import { emptyMemoryBank } from '@shared/types/memory'
import type { Message, SessionSettings, Settings } from '@shared/types'
import { createModelDependencies } from '@/adapters'
import { generateText } from '@/packages/model-calls'
import platform from '@/platform'
import { settingsStore } from '@/stores/settingsStore'
import { createEntry, retainEntry, setProfileSummary, simpleProfileFromEntries } from './bank-ops'
import { buildExtractSystemPrompt, buildExtractUserPrompt } from './prompts/extract'
import { createMessage } from '@shared/types'

export interface ExtractedFact {
  content: string
  tags: string[]
  scope: 'global' | 'agent'
}

export interface ExtractResult {
  facts: ExtractedFact[]
  raw?: string
  error?: string
}

function parseFactsJson(text: string): ExtractedFact[] {
  const cleaned = text
    .replace(/```json\s*/gi, '')
    .replace(/```/g, '')
    .trim()
  try {
    const parsed = JSON.parse(cleaned) as { facts?: unknown[] }
    if (!Array.isArray(parsed.facts)) return []
    return parsed.facts
      .map((f) => {
        if (!f || typeof f !== 'object') return null
        const o = f as Record<string, unknown>
        const content = typeof o.content === 'string' ? o.content.trim() : ''
        if (!content) return null
        const tags = Array.isArray(o.tags)
          ? o.tags.filter((t): t is string => typeof t === 'string').map((t) => t.toLowerCase())
          : []
        const scope = o.scope === 'agent' ? 'agent' : 'global'
        return { content, tags, scope } as ExtractedFact
      })
      .filter((x): x is ExtractedFact => x !== null)
      .slice(0, 8)
  } catch {
    return []
  }
}

function buildModelSettings(global: Settings, sessionSettings?: SessionSettings): Settings {
  return {
    ...global,
    ...sessionSettings,
  } as Settings
}

export async function extractFactsFromTranscript(options: {
  transcript: string
  existingSummaries?: string
  hasAgent: boolean
  sessionSettings?: SessionSettings
}): Promise<ExtractResult> {
  const { transcript, existingSummaries, hasAgent, sessionSettings } = options
  if (!transcript.trim()) return { facts: [] }

  const globalSettings = settingsStore.getState().getSettings()
  const settings = buildModelSettings(globalSettings, sessionSettings)

  try {
    const dependencies = await createModelDependencies()
    const configs = await platform.getConfig()
    const model = getModel(settings, globalSettings, configs, dependencies)

    const messages: Message[] = [
      createMessage('system', buildExtractSystemPrompt()),
      createMessage(
        'user',
        buildExtractUserPrompt({ transcript, existingSummaries, hasAgent })
      ),
    ]

    const result = await generateText(model, messages)
    const raw =
      result.contentParts
        ?.filter((c) => c.type === 'text')
        .map((c) => c.text)
        .join('')
        ?.replace(/<think>[\s\S]*?<\/think>/gs, '')
        .trim() ?? ''

    return { facts: parseFactsJson(raw), raw }
  } catch (e) {
    return { facts: [], error: e instanceof Error ? e.message : String(e) }
  }
}

export function applyFactsToBanks(options: {
  facts: ExtractedFact[]
  globalBank: MemoryBank
  agentBank?: MemoryBank | null
  agentId?: string
  settings: MemorySettings
  sourceSessionId?: string
  source: 'auto' | 'tool' | 'user'
}): { globalBank: MemoryBank; agentBank?: MemoryBank; added: MemoryEntry[] } {
  const { facts, settings, sourceSessionId, source, agentId } = options
  let globalBank = options.globalBank
  let agentBank = options.agentBank ?? undefined
  const added: MemoryEntry[] = []

  for (const fact of facts) {
    const scope = fact.scope === 'agent' && agentId ? 'agent' : 'global'
    const entry = createEntry({
      content: fact.content,
      tags: fact.tags,
      scope,
      agentId: scope === 'agent' ? agentId : undefined,
      source,
      sourceSessionId,
      maxEntryChars: settings.maxEntryChars,
    })
    if (!entry) continue

    if (scope === 'agent' && agentId) {
      if (!agentBank) {
        agentBank = emptyMemoryBank('agent', agentId)
      }
      agentBank = retainEntry(agentBank, entry, settings)
    } else {
      globalBank = retainEntry(globalBank, entry, settings)
    }
    added.push(entry)
  }

  return { globalBank, agentBank, added }
}

/** Fast non-LLM profile rebuild from entries (fallback / after CRUD). */
export function rebuildProfileLocal(bank: MemoryBank, maxChars = 2000): MemoryBank {
  return setProfileSummary(bank, simpleProfileFromEntries(bank.entries, maxChars))
}

export function transcriptFromMessages(messages: Message[], maxChars = 12000): string {
  const lines: string[] = []
  let used = 0
  // Take from the end (most recent)
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.role !== 'user' && m.role !== 'assistant') continue
    const text =
      m.contentParts
        ?.filter((p) => p.type === 'text')
        .map((p) => ('text' in p ? p.text : ''))
        .join('')
        .trim() || ''
    if (!text) continue
    const line = `${m.role}: ${text.slice(0, 2000)}`
    if (used + line.length > maxChars) break
    lines.unshift(line)
    used += line.length
  }
  return lines.join('\n')
}
