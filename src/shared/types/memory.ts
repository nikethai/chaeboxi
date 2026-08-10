import { z } from 'zod'

export const MemoryScopeSchema = z.enum(['global', 'agent'])
export type MemoryScope = z.infer<typeof MemoryScopeSchema>

export const MemorySourceSchema = z.enum(['user', 'auto', 'tool', 'migrated'])
export type MemorySource = z.infer<typeof MemorySourceSchema>

export const MemoryEntrySchema = z.object({
  id: z.string(),
  content: z.string(),
  tags: z.array(z.string()).default([]),
  scope: MemoryScopeSchema,
  agentId: z.string().optional(),
  source: MemorySourceSchema,
  sourceSessionId: z.string().optional(),
  sourceMessageId: z.string().optional(),
  enabled: z.boolean().default(true),
  pinned: z.boolean().default(false),
  createdAt: z.number(),
  updatedAt: z.number(),
  lastAccessedAt: z.number().optional(),
  /**
   * Soft-archived: kept on disk but hidden from inject/recall by default.
   * Set when soft-archive prune demotes an entry instead of hard-deleting.
   */
  archived: z.boolean().optional(),
  /** Monotonic per-entry sync revision; bumped on every mutation. */
  revision: z.number().optional(),
  /** Tombstone flag: entry kept on disk for sync but hidden from recall. */
  deleted: z.boolean().optional(),
})
export type MemoryEntry = z.infer<typeof MemoryEntrySchema>

/** Optional structured profile slots (S3) — short always-on inject fragments. */
export const MemoryProfileSlotsSchema = z.object({
  identity: z.string().optional(),
  prefs: z.string().optional(),
  projects: z.string().optional(),
})
export type MemoryProfileSlots = {
  identity: string
  prefs: string
  projects: string
}

export const MemoryBankSchema = z.object({
  scope: MemoryScopeSchema,
  agentId: z.string().optional(),
  entries: z.array(MemoryEntrySchema).default([]),
  profileSummary: z.string().default(''),
  profileUpdatedAt: z.number().optional(),
  profileSlots: MemoryProfileSlotsSchema.optional(),
  version: z.number().default(1),
  /** Monotonic bank-level sync revision; bumped on every mutation. */
  revision: z.number().optional(),
})
export type MemoryBank = z.infer<typeof MemoryBankSchema>

/**
 * How memory reaches the model system prompt.
 * - always: profile + facts under full budgets (classic)
 * - hybrid (default): profile + pinned only under small core budgets; search tools for the rest
 * - on_demand: policy stub only; rely on tools (+ optional host pre-search)
 */
export const MemoryRetrievalModeSchema = z.enum(['always', 'hybrid', 'on_demand']).default('hybrid')
export type MemoryRetrievalMode = z.infer<typeof MemoryRetrievalModeSchema>

export const MemorySettingsSchema = z.object({
  enabled: z.boolean().default(true),
  autoSave: z.boolean().default(true),
  retrievalMode: MemoryRetrievalModeSchema,
  /** Approximate token budget for global inject in `always` mode */
  injectBudgetTokensGlobal: z.number().default(1200),
  /** Approximate token budget for agent inject in `always` mode */
  injectBudgetTokensAgent: z.number().default(800),
  /** Hybrid core budget: profile + pinned (global) */
  injectBudgetTokensCoreGlobal: z.number().default(250),
  /** Hybrid core budget: profile + pinned (agent) */
  injectBudgetTokensCoreAgent: z.number().default(150),
  /** Auto-attach keyword-matching facts from the latest user message (hybrid / on_demand) */
  hostPreSearchEnabled: z.boolean().default(true),
  hostPreSearchLimit: z.number().default(5),
  maxEntriesGlobal: z.number().default(300),
  maxEntriesPerAgent: z.number().default(150),
  maxEntryChars: z.number().default(500),
  /** Run auto-extract every N completed user turns (default 3 — scale quality) */
  retainEveryNTurns: z.number().default(3),
  autoConsolidate: z.boolean().default(true),
  /**
   * When autoConsolidate is on, run LLM consolidate only after this many successful
   * retains since last LLM consolidate (local profile rebuild always runs).
   */
  consolidateEveryNRetains: z.number().default(5),
  showMemoryUpdatedToast: z.boolean().default(true),
  /**
   * If LLM extract finds nothing, pin a short form of the last user message.
   * Default off — primary source of bank pollution.
   */
  autoSaveFallbackPin: z.boolean().default(false),
  /**
   * When over max entries: disable+archive oldest unused instead of hard-delete.
   * Pinned entries are never archived by prune.
   */
  softArchiveOnPrune: z.boolean().default(true),
  /**
   * Local hybrid lexical+token-vector semantic boost for recall (no external embed API).
   */
  semanticSearchEnabled: z.boolean().default(true),
  /** Weight of semantic score in fusion [0..1]; lexical gets 1-weight */
  semanticFusionWeight: z.number().default(0.35),
})
export type MemorySettings = z.infer<typeof MemorySettingsSchema>

export function emptyMemoryBank(scope: MemoryScope, agentId?: string): MemoryBank {
  return {
    scope,
    agentId: scope === 'agent' ? agentId : undefined,
    entries: [],
    profileSummary: '',
    profileSlots: { identity: '', prefs: '', projects: '' },
    version: 1,
  }
}

export function emptyProfileSlots(): MemoryProfileSlots {
  return { identity: '', prefs: '', projects: '' }
}

export function defaultMemorySettings(): MemorySettings {
  return MemorySettingsSchema.parse({})
}
