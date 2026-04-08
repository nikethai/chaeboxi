import type { ProviderSettings } from '@shared/types'

function trimPromptSegment(value?: string): string | null {
  if (!value) {
    return null
  }

  const trimmed = value.trim().replace(/^[,\s]+|[,\s]+$/g, '').trim()
  return trimmed.length > 0 ? trimmed : null
}

export function composeImageGenerationPrompt(providerSettings: ProviderSettings | undefined, rawPrompt: string): string {
  const segments = [
    trimPromptSegment(providerSettings?.imagePromptCharacterPrepend),
    trimPromptSegment(providerSettings?.imagePromptPositiveTagsPrepend),
    trimPromptSegment(rawPrompt),
  ].filter((segment): segment is string => Boolean(segment))

  return segments.join(', ')
}
