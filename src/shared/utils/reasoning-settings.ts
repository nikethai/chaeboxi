import type { ProviderOptions, SessionSettings, Settings } from '../types'
import type { OpenAIReasoningEffort } from '../types/settings'

export type ReasoningDropdownValue = 'null' | OpenAIReasoningEffort

type WithProviderOptions = Pick<SessionSettings | Settings, 'providerOptions'>

export function getReasoningDropdownValue(settings?: WithProviderOptions): ReasoningDropdownValue {
  return settings?.providerOptions?.openai?.reasoningEffort ?? 'null'
}

export function applyOpenAIReasoningEffort(
  settings: WithProviderOptions | undefined,
  value: ReasoningDropdownValue
): ProviderOptions {
  return {
    ...(settings?.providerOptions || {}),
    openai: {
      ...settings?.providerOptions?.openai,
      reasoningEffort: value === 'null' ? undefined : value,
    },
  }
}
