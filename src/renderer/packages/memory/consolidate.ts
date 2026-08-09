import { getModel } from '@shared/models'
import type { MemoryBank } from '@shared/types/memory'
import type { Message, SessionSettings, Settings } from '@shared/types'
import { createMessage } from '@shared/types'
import { createModelDependencies } from '@/adapters'
import { generateText } from '@/packages/model-calls'
import platform from '@/platform'
import { settingsStore } from '@/stores/settingsStore'
import { setProfileSummary, simpleProfileFromEntries } from './bank-ops'
import { buildConsolidateSystemPrompt, buildConsolidateUserPrompt } from './prompts/extract'

function buildModelSettings(global: Settings, sessionSettings?: SessionSettings): Settings {
  return { ...global, ...sessionSettings } as Settings
}

/**
 * LLM consolidation of enabled entries into profileSummary.
 * Falls back to local bullet list on failure.
 */
export async function consolidateBank(
  bank: MemoryBank,
  options?: { sessionSettings?: SessionSettings; maxFacts?: number }
): Promise<MemoryBank> {
  const enabled = bank.entries
    .filter((e) => e.enabled)
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return b.updatedAt - a.updatedAt
    })
    .slice(0, options?.maxFacts ?? 80)

  if (enabled.length === 0) {
    return setProfileSummary(bank, '')
  }

  const facts = enabled.map((e) => e.content)
  const globalSettings = settingsStore.getState().getSettings()
  const settings = buildModelSettings(globalSettings, options?.sessionSettings)

  try {
    const dependencies = await createModelDependencies()
    const configs = await platform.getConfig()
    const model = getModel(settings, globalSettings, configs, dependencies)

    const messages: Message[] = [
      createMessage('system', buildConsolidateSystemPrompt()),
      createMessage('user', buildConsolidateUserPrompt(facts)),
    ]

    const result = await generateText(model, messages)
    const summary =
      result.contentParts
        ?.filter((c) => c.type === 'text')
        .map((c) => c.text)
        .join('')
        ?.replace(/<think>[\s\S]*?<\/think>/gs, '')
        .trim() ?? ''

    if (summary) {
      return setProfileSummary(bank, summary.slice(0, 4000))
    }
  } catch {
    // fall through
  }

  return setProfileSummary(bank, simpleProfileFromEntries(bank.entries, 2000))
}
