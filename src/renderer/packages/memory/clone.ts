import type { MemoryBank, MemorySettings } from '@shared/types/memory'
import { MemoryBankSchema, MemorySettingsSchema, defaultMemorySettings, emptyMemoryBank } from '@shared/types/memory'

/** Deep-clone via JSON to strip Immer proxies / non-serializable junk. */
export function plainClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function normalizeBank(bank: unknown, scope: 'global' | 'agent', agentId?: string): MemoryBank {
  try {
    const raw = bank && typeof bank === 'object' ? plainClone(bank) : emptyMemoryBank(scope, agentId)
    const parsed = MemoryBankSchema.parse({
      ...raw,
      scope,
      agentId: scope === 'agent' ? agentId ?? (raw as MemoryBank).agentId : undefined,
      entries: Array.isArray((raw as MemoryBank).entries) ? (raw as MemoryBank).entries : [],
      profileSummary: typeof (raw as MemoryBank).profileSummary === 'string' ? (raw as MemoryBank).profileSummary : '',
      profileSlots:
        (raw as MemoryBank).profileSlots && typeof (raw as MemoryBank).profileSlots === 'object'
          ? (raw as MemoryBank).profileSlots
          : { identity: '', prefs: '', projects: '' },
      version: typeof (raw as MemoryBank).version === 'number' ? (raw as MemoryBank).version : 1,
      // Sync metadata must survive normalization/clone round-trips.
      revision: typeof (raw as MemoryBank).revision === 'number' ? (raw as MemoryBank).revision : undefined,
    })
    return parsed
  } catch {
    return emptyMemoryBank(scope, agentId)
  }
}

export function normalizeSettings(raw: unknown): MemorySettings {
  try {
    const base = defaultMemorySettings()
    if (!raw || typeof raw !== 'object') return base
    return MemorySettingsSchema.parse({ ...base, ...plainClone(raw as object) })
  } catch {
    return defaultMemorySettings()
  }
}
