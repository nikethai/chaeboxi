/**
 * Lightweight in-process memory metrics (S0).
 * Dev/diagnostic only — no UI charts. Read via getMemoryMetrics() or logger.
 */

export type MemoryMetricsSnapshot = {
  entriesGlobal: number
  entriesAgentTotal: number
  bankBytesGlobal: number
  presearchLastMs: number
  presearchLastHits: number
  presearchCount: number
  autosaveExtracted: number
  autosaveFallbackPinned: number
  autosaveApplied: number
  recallCount: number
  consolidateLlmCount: number
  writeFlushCount: number
  writeCoalescedCount: number
  updatedAt: number
}

const state: MemoryMetricsSnapshot = {
  entriesGlobal: 0,
  entriesAgentTotal: 0,
  bankBytesGlobal: 0,
  presearchLastMs: 0,
  presearchLastHits: 0,
  presearchCount: 0,
  autosaveExtracted: 0,
  autosaveFallbackPinned: 0,
  autosaveApplied: 0,
  recallCount: 0,
  consolidateLlmCount: 0,
  writeFlushCount: 0,
  writeCoalescedCount: 0,
  updatedAt: 0,
}

function touch() {
  state.updatedAt = Date.now()
}

export function getMemoryMetrics(): MemoryMetricsSnapshot {
  return { ...state }
}

export function resetMemoryMetrics(): void {
  state.entriesGlobal = 0
  state.entriesAgentTotal = 0
  state.bankBytesGlobal = 0
  state.presearchLastMs = 0
  state.presearchLastHits = 0
  state.presearchCount = 0
  state.autosaveExtracted = 0
  state.autosaveFallbackPinned = 0
  state.autosaveApplied = 0
  state.recallCount = 0
  state.consolidateLlmCount = 0
  state.writeFlushCount = 0
  state.writeCoalescedCount = 0
  touch()
}

export function recordBankStats(options: {
  entriesGlobal?: number
  entriesAgentTotal?: number
  bankBytesGlobal?: number
}): void {
  if (typeof options.entriesGlobal === 'number') state.entriesGlobal = options.entriesGlobal
  if (typeof options.entriesAgentTotal === 'number') state.entriesAgentTotal = options.entriesAgentTotal
  if (typeof options.bankBytesGlobal === 'number') state.bankBytesGlobal = options.bankBytesGlobal
  touch()
}

export function recordPresearch(ms: number, hits: number): void {
  state.presearchLastMs = ms
  state.presearchLastHits = hits
  state.presearchCount += 1
  touch()
}

export function recordAutosave(event: 'extracted' | 'fallback_pinned' | 'applied', count = 1): void {
  if (event === 'extracted') state.autosaveExtracted += count
  if (event === 'fallback_pinned') state.autosaveFallbackPinned += count
  if (event === 'applied') state.autosaveApplied += count
  touch()
}

export function recordRecall(): void {
  state.recallCount += 1
  touch()
}

export function recordConsolidateLlm(): void {
  state.consolidateLlmCount += 1
  touch()
}

export function recordWriteFlush(coalesced = false): void {
  state.writeFlushCount += 1
  if (coalesced) state.writeCoalescedCount += 1
  touch()
}

/** Pretty one-liner for logs / console. */
export function formatMemoryMetrics(): string {
  const m = getMemoryMetrics()
  return [
    `mem.metrics entries.g=${m.entriesGlobal}`,
    `agent_entries=${m.entriesAgentTotal}`,
    `bank_bytes=${m.bankBytesGlobal}`,
    `presearch.ms=${m.presearchLastMs}`,
    `presearch.hits=${m.presearchLastHits}`,
    `autosave.applied=${m.autosaveApplied}`,
    `autosave.fallback=${m.autosaveFallbackPinned}`,
    `recall=${m.recallCount}`,
    `writes=${m.writeFlushCount}`,
  ].join(' ')
}
