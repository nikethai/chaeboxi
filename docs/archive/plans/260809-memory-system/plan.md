# Plan: Application Memory (cross-session, cross-model)

**Status:** shipped (v1 + scale S0–S5)  
**Date:** 2026-08-09  
**Research:** [reports/research-oh-my-pi-memory.md](./reports/research-oh-my-pi-memory.md), [reports/research-memory-scale-optimization.md](./reports/research-memory-scale-optimization.md)  
**Scale plan:** memory quality, unified recall, index, soft-archive, repository, local semantic — implemented 2026-08-09

## Goal

Ship long-term **user memory** for Chaeboxi:

1. AI auto-saves durable facts from chat
2. User can save / edit / delete / disable entries
3. All future models share the same memory
4. Memory stays **lightweight** (compressed profile + short facts, hard token budget)
5. Management place in Settings (+ optional in-chat actions)

## Non-goals (v1)

- Full vector graph / polyphonic recall (mnemopi)
- Remote Hindsight cloud dependency
- Per-project coding memory as default
- Replacing Knowledge Base or session compaction

## Product model

```text
┌─────────────────────────────────────────────────────────┐
│ Memory Bank (persisted, local-first)                     │
│  • entries[]: id, text, tags, source, enabled, ts        │
│  • profileSummary: compressed "mental model" string      │
│  • settings: autoSave, injectBudgetTokens, scopes        │
└─────────────────────────────────────────────────────────┘
         │ retain/forget/edit              │ recall/inject
         ▼                                 ▼
   AI tools + auto-extract          system prompt block
   User manage UI                   (all providers/models)
```

### Entry shape (proposed)

```ts
type MemoryEntry = {
  id: string
  content: string           // short fact, max ~500 chars
  tags?: string[]           // e.g. preference, project, name
  source: 'user' | 'auto' | 'pin'
  sourceSessionId?: string
  enabled: boolean
  createdAt: number
  updatedAt: number
  // optional later: confidence, expiresAt, agentId
}

type MemoryBank = {
  entries: MemoryEntry[]
  profileSummary: string    // compressed inject text
  profileUpdatedAt?: number
}
```

### Compression policy (lightweight)

| Layer | What | Token budget (v1) |
|-------|------|-------------------|
| L0 Profile | 1 curated paragraph(s) of durable prefs/facts | **~800–1200 tokens** hard cap inject |
| L1 Entries | short facts, user-visible, searchable | max **200** entries; show top N by recency+pin |
| L2 Raw chat | never stored as memory | session storage only |

Pipeline (oh-my-pi local pattern, simplified):

1. **Extract** (after N user turns or on pin): LLM → candidate facts (JSON array)
2. **Dedupe/merge** against existing entries (normalize key ideas)
3. **Consolidate** profileSummary from enabled entries (cheap model / same user model)
4. **Inject** only profile + optional top relevant facts (token-capped)

## Architecture (Systems Designer)

### Boundaries

| Layer | Responsibility |
|-------|----------------|
| `packages/memory/` | pure store ops, extract/consolidate prompts, inject builder, token budget |
| Storage | new key e.g. `memoryBank` via `StoreStorage` (immediate write) |
| Generation | inject memory block in `injectModelSystemPrompt` or PreTurn path |
| Tools | optional `memory_retain` / `memory_forget` / `memory_search` toolset |
| UI | Settings → Memory manage; message action "Save to memory" |

### Data flow

```text
Chat turn complete
  → if autoSave: enqueue extract (debounce 5–15s / every N turns)
  → extract model call (non-blocking, best-effort)
  → merge entries → maybe re-consolidate profile
  → persist

Next chat (any model)
  → buildMemoryInjectBlock(bank, budget)
  → splice into system/metadata prompt
  → model sees same memory

User deletes entry in Settings
  → bank.entries filtered → re-consolidate profile → persist
```

### Relationship to existing features

| Feature | Relationship |
|---------|--------------|
| User Personal Info | **Seed / migrate** into Memory entries (source=`user`); UI can absorb or deep-link |
| Session compaction | Orthogonal (short-term context). Memory is long-term durable |
| Knowledge Base | Orthogonal (documents). Memory is conversational facts about the *user* |
| Agents | v1: shared global memory; v2: optional agent-scoped tags |

## Technology guidance

### Recommended v1 stack (KISS)

- **Storage:** existing platform storage (`settings`-like immediate key or dedicated `memoryBank` JSON)
- **Extract/consolidate:** existing `generateText` + user-selected cheap model (or active model)
- **Search for manage UI:** local string match / simple keyword (no embeddings v1)
- **Inject:** string builder with approximate token estimate (existing token-estimation package)

### Explicitly defer

- SQLite + embeddings (desktop already has KB path — reuse only if v2 needs semantic recall)
- npm `@oh-my-pi/pi-mnemopi` (Bun-oriented agent engine; heavy for chat client)
- Cloud sync

### Pros/cons of recommended path

| Pros | Cons |
|------|------|
| Works web + desktop + mobile via StoreStorage | Consolidation costs small LLM calls |
| Same memory for all providers | Extract quality depends on prompt + model |
| User full control (delete/disable) | Auto-save may store wrong facts → need easy delete + "disable auto" |
| Token-capped = lightweight | Profile can go stale if consolidate fails — show last updated |

## Phased ship plan

### Phase 0 — Product decisions (½ day)

Confirm:

1. Global-only memory for v1?
2. Auto-save default on or off?
3. Merge Personal Info into Memory UI?
4. Tools for model retain/forget in v1 or UI-only first?

### Phase 1 — Data + inject (MVP core)

**Deliver:**

- Types + Zod schema for `MemoryBank`
- Persist/load via storage
- `buildMemoryInjectBlock()` with hard token budget
- Wire inject into generation path (all models)
- Settings → **Memory** page: list, enable toggle, edit, delete, clear all
- Migrate `userPersonalInfo` entries → memory entries (one-time)

**Acceptance:**

- New session + different model still receives same profile text
- Disabling/deleting entry removes it from next inject within budget rules

### Phase 2 — User save + AI auto-save

**Deliver:**

- Message action / selection: **Save to memory**
- Auto-extract pipeline (debounced; skip if no new durable signal)
- Dedupe/merge rules; secret redaction (API keys, tokens patterns)
- Caps: max entry length, max entries, inject budget settings
- Activity indicator: "Memory updated" toast (subtle)

**Acceptance:**

- After multi-turn chat stating "I prefer X", next session inject contains X (or user can pin)
- User can delete the auto entry

### Phase 3 — Model tools + compression polish

**Deliver:**

- Tools: `memory_retain`, `memory_forget`, `memory_list` (optional search)
- Profile consolidation job (after batch of retains)
- Settings: auto-save on/off, budget slider, clear, export/import JSON
- Unit tests: inject budget, merge/dedupe, redaction

**Acceptance:**

- Inject never exceeds configured token budget in tests
- Tool path + UI path share same store API

### Phase 4 (optional) — Smart recall

- Optional embeddings / reuse KB stack for semantic top-k when entry count high
- Per-agent or workspace scopes
- Mental-model slots (preferences / work style / ongoing projects)

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Context bloat | Hard inject budget; profile only by default |
| Wrong / private facts auto-saved | Auto off-by-default or easy delete; redaction; show source |
| Cost of extract LLM | Debounce; cheap model; only when durable signal heuristics fire |
| Double sources (personal info + memory) | Migrate + single UI |
| Web storage wipe | Export/import; document backup with settings |
| OpenClaw path strips system | Same as personal info — special-case inject if needed |

## Decision framework

| Question | Choose if… |
|----------|------------|
| JSON store vs SQLite | Prefer JSON v1 until >~500 entries or need FTS |
| Auto-save default | Prefer **off** until extract quality proven |
| Tools in v1 | Prefer UI+auto first; tools in Phase 3 |
| Semantic search | Only when keyword list UX fails |

## Success metrics (product)

- % sessions with memory inject non-empty
- Median inject tokens
- User delete rate of auto entries (quality signal)
- Time to find/delete a memory in Settings < 10s

## Next actions

1. Answer Phase 0 questions
2. Formalize phase files under this plan dir if greenlit (`phase-01-data-inject.md`, …)
3. Spike: extract prompt quality on 10 sample chats (no UI)
4. Then implement Phase 1 via `/cook` or feature branch
