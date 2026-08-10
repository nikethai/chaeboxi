import type { MemorySettings } from '@shared/types/memory'
import type { SessionSettings } from '@shared/types'

/**
 * Whether post-turn auto-extract may write memory for this chat.
 * Requires global master + global autoSave; session may only opt out (false).
 */
export function isSessionMemoryAutoSaveAllowed(
  memorySettings: Pick<MemorySettings, 'enabled' | 'autoSave'>,
  sessionSettings?: Pick<SessionSettings, 'memoryAutoSave'> | null
): boolean {
  if (!memorySettings.enabled || !memorySettings.autoSave) return false
  return sessionSettings?.memoryAutoSave !== false
}

/**
 * Whether the model may call memory_retain for this chat.
 * Not gated by global autoSave (matches existing tool behavior).
 * Session may opt out with memoryAutoSave: false.
 */
export function isSessionMemoryToolRetainAllowed(
  memorySettings: Pick<MemorySettings, 'enabled'>,
  sessionSettings?: Pick<SessionSettings, 'memoryAutoSave'> | null
): boolean {
  if (!memorySettings.enabled) return false
  return sessionSettings?.memoryAutoSave !== false
}
