import type { MemoryBank, MemoryEntry } from '@shared/types/memory'
import type { UserPersonalInfoSettings } from '@shared/types/settings'
import { emptyMemoryBank } from '@shared/types/memory'
import { createEntry, retainEntry } from './bank-ops'
import { defaultMemorySettings } from '@shared/types/memory'

/**
 * Convert legacy userPersonalInfo entries into global memory bank entries.
 * Does not clear personal info — caller may leave field for one release.
 */
export function migratePersonalInfoToBank(
  personalInfo: UserPersonalInfoSettings | null | undefined,
  existingBank?: MemoryBank | null
): { bank: MemoryBank; migratedCount: number } {
  let bank = existingBank?.scope === 'global' ? existingBank : emptyMemoryBank('global')
  const settings = defaultMemorySettings()
  let migratedCount = 0

  const entries = personalInfo?.entries ?? []
  for (const pe of entries) {
    if (!pe?.key?.trim()) continue
    const content = pe.value?.trim() ? `${pe.key.trim()}: ${pe.value.trim()}` : pe.key.trim()
    const entry = createEntry({
      content,
      tags: ['personal', 'migrated'],
      scope: 'global',
      source: 'migrated',
      maxEntryChars: settings.maxEntryChars,
      pinned: false,
      enabled: true,
    })
    if (!entry) continue
    // Preserve id stability is not required; use createEntry id
    bank = retainEntry(bank, entry as MemoryEntry, settings)
    migratedCount++
  }

  // If personal info injection was on and we have entries but no profile, build simple profile
  if (migratedCount > 0 && !bank.profileSummary.trim()) {
    const lines = bank.entries
      .filter((e) => e.enabled)
      .map((e) => `- ${e.content}`)
      .join('\n')
    bank = {
      ...bank,
      profileSummary: lines.slice(0, 4000),
      profileUpdatedAt: Date.now(),
    }
  }

  return { bank, migratedCount }
}
