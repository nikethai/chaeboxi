/**
 * MemoryRepository abstraction (S4).
 * JSON store remains the source of truth; local FTS index powers scale queries.
 * Desktop can later swap in SQLite-backed implementation without changing callers.
 */

import type { MemoryBank } from '@shared/types/memory'
import { emptyMemoryBank } from '@shared/types/memory'
import {
  listAgentBankIds as listAgentBankIdsJson,
  loadAllAgentBanks as loadAllAgentBanksJson,
  loadAgentBank as loadAgentBankJson,
  loadGlobalBank as loadGlobalBankJson,
  loadMemorySettings,
  saveAgentBank as saveAgentBankJson,
  saveGlobalBank as saveGlobalBankJson,
  saveMemorySettings,
  type CoalesceOptions,
} from './persistence'
import { buildQueryIndex, MemoryQueryIndex } from './query-index'
import { rebuildSemanticForBank, type SemanticVectors } from './semantic'
import { recallEntries, type RecallHit } from './recall'
import type { MemorySettings } from '@shared/types/memory'

export interface MemoryRepository {
  loadSettings(): Promise<MemorySettings>
  saveSettings(settings: MemorySettings): Promise<void>
  loadGlobal(): Promise<MemoryBank>
  saveGlobal(bank: MemoryBank, options?: CoalesceOptions): Promise<void>
  loadAgent(agentId: string): Promise<MemoryBank>
  saveAgent(agentId: string, bank: MemoryBank, options?: CoalesceOptions): Promise<void>
  /** Enumerate every agent id with a persisted bank, including inactive agents. */
  listAgentBankIds(): Promise<string[]>
  /** Load every persisted agent bank for snapshot building. */
  loadAllAgentBanks(): Promise<Array<{ agentId: string; bank: MemoryBank }>>
  getGlobalIndex(): MemoryQueryIndex
  getAgentIndex(agentId: string): MemoryQueryIndex
  getSemanticVectors(scope: 'global' | 'agent', agentId?: string): SemanticVectors
  rebuildIndexes(scope: 'global' | 'agent', bank: MemoryBank, agentId?: string): void
  recall(options: {
    query: string
    globalBank?: MemoryBank | null
    agentBank?: MemoryBank | null
    agentId?: string
    limit?: number
    settings?: MemorySettings | null
  }): RecallHit[]
  flush(): Promise<void>
}

/**
 * Local FTS + JSON repository (default for all platforms).
 * Uses inverted index (S2) + BM25-ish scoring + optional semantic fusion (S5).
 */
export class LocalFtsMemoryRepository implements MemoryRepository {
  private globalIndex = new MemoryQueryIndex()
  private agentIndexes = new Map<string, MemoryQueryIndex>()
  private globalSemantic: SemanticVectors = new Map()
  private agentSemantic = new Map<string, SemanticVectors>()

  async loadSettings() {
    return loadMemorySettings()
  }

  async saveSettings(settings: MemorySettings) {
    await saveMemorySettings(settings)
  }

  async loadGlobal() {
    const bank = await loadGlobalBankJson()
    this.rebuildIndexes('global', bank)
    return bank
  }

  async saveGlobal(bank: MemoryBank, options?: CoalesceOptions) {
    this.rebuildIndexes('global', bank)
    await saveGlobalBankJson(bank, options)
  }

  async loadAgent(agentId: string) {
    const bank = await loadAgentBankJson(agentId)
    this.rebuildIndexes('agent', bank, agentId)
    return bank
  }

  async saveAgent(agentId: string, bank: MemoryBank, options?: CoalesceOptions) {
    this.rebuildIndexes('agent', bank, agentId)
    await saveAgentBankJson(agentId, bank, options)
  }

  async listAgentBankIds() {
    return listAgentBankIdsJson()
  }

  async loadAllAgentBanks() {
    return loadAllAgentBanksJson()
  }

  getGlobalIndex() {
    return this.globalIndex
  }

  getAgentIndex(agentId: string) {
    let idx = this.agentIndexes.get(agentId)
    if (!idx) {
      idx = new MemoryQueryIndex()
      this.agentIndexes.set(agentId, idx)
    }
    return idx
  }

  getSemanticVectors(scope: 'global' | 'agent', agentId?: string): SemanticVectors {
    if (scope === 'global') return this.globalSemantic
    if (!agentId) return new Map()
    return this.agentSemantic.get(agentId) ?? new Map()
  }

  rebuildIndexes(scope: 'global' | 'agent', bank: MemoryBank, agentId?: string): void {
    if (scope === 'global') {
      this.globalIndex = buildQueryIndex(bank)
      this.globalSemantic = rebuildSemanticForBank(bank.entries)
      return
    }
    const id = agentId ?? bank.agentId
    if (!id) return
    this.agentIndexes.set(id, buildQueryIndex(bank))
    this.agentSemantic.set(id, rebuildSemanticForBank(bank.entries))
  }

  recall(options: {
    query: string
    globalBank?: MemoryBank | null
    agentBank?: MemoryBank | null
    agentId?: string
    limit?: number
    settings?: MemorySettings | null
  }): RecallHit[] {
    const settings = options.settings
    const semanticEnabled = settings?.semanticSearchEnabled !== false
    // Merge global + agent semantic maps for fusion lookup
    const merged: SemanticVectors = new Map()
    if (semanticEnabled) {
      for (const [k, v] of this.globalSemantic) merged.set(k, v)
      if (options.agentId) {
        const ag = this.agentSemantic.get(options.agentId)
        if (ag) for (const [k, v] of ag) merged.set(k, v)
      }
    }

    return recallEntries({
      query: options.query,
      globalBank: options.globalBank,
      agentBank: options.agentBank,
      globalIndex: this.globalIndex,
      agentIndex: options.agentId ? this.getAgentIndex(options.agentId) : null,
      semanticVectors: semanticEnabled ? merged : null,
      settings: settings
        ? {
            semanticSearchEnabled: settings.semanticSearchEnabled,
            semanticFusionWeight: settings.semanticFusionWeight,
          }
        : null,
      limit: options.limit,
      enabledOnly: true,
    })
  }

  async flush() {
    const { flushAllMemoryWrites } = await import('./persistence')
    await flushAllMemoryWrites()
  }
}

let defaultRepo: MemoryRepository | null = null

export function getMemoryRepository(): MemoryRepository {
  if (!defaultRepo) {
    defaultRepo = new LocalFtsMemoryRepository()
  }
  return defaultRepo
}

/** Test helper */
export function setMemoryRepositoryForTests(repo: MemoryRepository | null): void {
  defaultRepo = repo
}

export function emptyAgentBank(agentId: string): MemoryBank {
  return emptyMemoryBank('agent', agentId)
}
