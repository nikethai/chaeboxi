# Research Report: Memory Flow Scale & Optimization (Chaeboxi)

**Date:** 2026-08-09  
**Scope:** Audit current Chaeboxi memory pipeline; research industry patterns; recommend scale path for save/query/inject without premature complexity.  
**Companion:** [research-oh-my-pi-memory.md](./research-oh-my-pi-memory.md), [plan.md](../plan.md), [docs/memory.md](../../../docs/memory.md)

## Executive Summary

Chaeboxi’s memory v1 is the **right product shape** for a desktop chat client: distillation-first fact banks, hybrid inject (core profile + pinned), host keyword pre-search, model tools, local-only JSON persistence. That matches Mem0-style “facts not raw history” and Letta-style “core vs archival” without heavy deps.

It will **not** scale cleanly past a few hundred–low thousands of facts as written. Bottlenecks are not “we need a vector DB tomorrow” — they are:

1. **O(n) full-bank scan** on every hybrid/on_demand turn (host pre-search + tool recall)
2. **Whole-document rewrite** of the bank JSON on every retain
3. **Write quality** (auto-save every turn + raw-message fallback) that pollutes the bank and accelerates cap/pruning pressure
4. **Weak dedupe** (first-200-char fingerprint) → near-duplicates fill the 300-entry cap
5. **Eager LLM consolidate** on auto-save path (cost + profile churn)

Industry consensus 2025–2026: **hybrid retrieval** (lexical + optional dense), **scoped stores**, **token-capped inject**, **lazy consolidation**. For personal local-first agents, **SQLite + FTS5 (+ optional vec)** is the proven scale step — not cloud vector services — until multi-device sync is a product goal.

**Brutal take:** Fix quality + indexing before storage tech. A clean 500-fact bank with scored search beats a 10k-fact dump with substring `includes`.

## Research Methodology

- **Code audit:** `src/shared/types/memory.ts`, `packages/memory/*`, `memoryStore.ts`, `stream-text.ts`, `message-utils.ts`, `generation.ts`, `docs/memory.md`
- **Web research:** hybrid agent memory, Mem0/Zep/Letta, SQLite FTS local memory, consolidation patterns (max 5 research tool calls)
- **Gemini CLI:** unavailable (exit 127); used WebSearch
- **Date range of materials:** 2025–2026 product/architecture writeups + arxiv notes
- **Key terms:** hybrid retrieval, distillation-first memory, FTS5, core vs archival, consolidation, token budget

## Architecture Analysis (current Chaeboxi)

### Data flow (as implemented)

```text
User turn
  → stream-text: inject buildMemoryInjectBlock (hybrid: profile+pinned + host pre-search)
  → optional memory_* tools (retain/recall/list/forget/update/reflect)
  → turn complete → maybeAutoSaveMemory
        → LLM extract facts (every N turns, default N=1)
        → fallback: pin last user message if extract empty
        → retainEntry merge + prune (max 300 / 150)
        → optional consolidateBank (LLM profile rewrite, top 80 facts)
        → replaceGlobalBank / replaceAgentBank → full JSON setItemNow
```

### Storage model

| Key | Shape | Write mode |
|-----|--------|------------|
| `memory-settings` | settings blob | immediate |
| `memory-bank-global` | full `MemoryBank` JSON | immediate whole rewrite |
| `memory:agent:{id}` | full agent bank JSON | immediate whole rewrite |

### Query model

| Path | Algorithm | Complexity |
|------|-----------|------------|
| Host pre-search | tokenize query, score all enabled entries | O(entries × tokens) per turn |
| `searchEntries` (tools/UI) | `content.includes` + tag includes | O(n), **no score** (sort pin+recency) |
| Inject core | profile string + pinned under token budget | O(pinned) — fine |

### What is already good

- Hybrid / always / on_demand modes + non-tool hybrid fallback
- Hard inject budgets (core ~250/150 tokens)
- Pinned facts as “core memory”
- Secret redaction on write
- Scope split: global vs agent
- Tools + host pre-search ordering policy (memory before web)
- Immediate writes (no debounce loss of settings-critical data)
- Caps + prune (pinned-first)

### What breaks at scale

| Pressure point | At ~300 facts | At ~3k–10k facts |
|----------------|---------------|------------------|
| Host pre-search full scan | OK (~ms) | Noticeable on main thread; every turn |
| Tool `searchEntries` | Acceptable | False negatives (substring), no ranking quality |
| Full bank rewrite | Small JSON | Write amp, race risk, jank on retain storms |
| Auto-save every turn | Costly LLM + noise | Bank filled with junk → prune thrash |
| Single profile string | OK | Loses structure; one bad consolidate hurts all injects |
| Fingerprint dedupe | Misses paraphrases | Cap fills with near-dupes |

### Schema gaps (field exists or missing)

- `lastAccessedAt` on entry: **defined, unused** for ranking/prune
- No `importance` / `confidence` / `expiresAt` / invalidation
- No inverted index or token cache
- No content hash beyond crude fingerprint
- Consolidate takes max 80 facts — arbitrary, not importance-aware

## Key Industry Findings

### 1. Distillation-first wins for chat memory

Mem0-class systems store **extracted facts**, not raw turns. Zep is history-first + graph; heavier and better for temporal entity questions. Chaeboxi already chose distillation-first — keep it.

Claimed benefits in Mem0 research direction: large token savings vs full-context replay (~90% class of claims), lower latency when only top-k facts inject.

### 2. Hybrid retrieval is the default, not pure vectors

Multiple 2026 architecture writeups: **keyword/BM25 + dense vectors**, merge via rank fusion; pure embedding search misses exact names/IDs; pure keyword misses paraphrase. Gains often cited ~15–30% recall on agent memory workloads.

Chaeboxi today: keyword-ish only (host scorer better than tool search). No FTS, no BM25, no embeddings.

### 3. Core vs archival (Letta / OS metaphor)

Always-on small “core” + on-demand archival is the production pattern. Chaeboxi hybrid mode **already implements this product-wise**. Do not abandon hybrid for always-inject as default.

### 4. Local scale path = SQLite FTS (± vec), not cloud first

Local-first agents (OpenClaw-style, sqlite-memory, memweave): SQLite single file + FTS5 + optional sqlite-vec. Practical personal scale often discussed to ~10^5–10^6 chunks; personal fact banks rarely need that.

For Chaeboxi (web + desktop + mobile via `StoreStorage`):

- **JSON banks stay valid** until entry counts and query quality force upgrade
- Desktop already has knowledge-base SQLite path — **reuse for memory v2 index**, not for v1 rewrite
- Web may stay IndexedDB/JSON longer with in-memory inverted index

### 5. Consolidation should be lazy

RecMem-style research: consolidate when patterns **recur**, not every interaction. Eager LLM consolidate every auto-save:

- burns tokens
- can drop nuance / invent summary drift
- fights with user edits

Prefer: local profile rebuild always; LLM consolidate on schedule / after batch / on user “Rebuild”.

### 6. Operating targets (useful numbers)

From memory-layer product literature (approximate targets, not hard SLOs):

- ~**10k** memories per user as a design ceiling for personal agents
- Retrieval of top ~**20** under ~**50 ms** (warm, local)
- Inject always under fixed token budget (Chaeboxi already)

Chaeboxi defaults (300 global / 150 agent) are **product caps**, not technical limits. Raising caps without index + quality controls is the wrong move.

## Comparative Analysis

| Approach | Fit for Chaeboxi | When |
|----------|------------------|------|
| A. Keep JSON + improve index/score in process | **Best next** | Now → ~2–5k facts |
| B. SQLite FTS (desktop) + JSON/IDB web | Scale step | When A saturates or multi-MB banks |
| C. Embeddings / reuse KB stack | Semantic recall | When users complain “memory doesn’t find X” with good keywords |
| D. Graph (Zep/Graphiti class) | Low for personal prefs | Temporal multi-entity enterprise memory |
| E. Cloud Mem0/Zep | Conflicts local-only CE | Only if sync product later |

## Design Recommendations

### Principle order (YAGNI / KISS / DRY)

1. **Raise signal** (extract quality, kill noise writes)
2. **Unify query path** (one scorer for host + tools + UI)
3. **Index before new storage**
4. **Lazy consolidate**
5. **Storage upgrade** only when measured (entry count, p95 presearch ms, write size)

### Target architecture (evolutionary)

```text
┌──────────────────────────────────────────────────────────┐
│ Memory API (unchanged surface)                           │
│  retain | recall | list | forget | update | inject       │
└───────────────────────────┬──────────────────────────────┘
                            │
         ┌──────────────────┼──────────────────┐
         ▼                  ▼                  ▼
   Entry store         Query index         Profile layer
   (facts + meta)      (token/FTS/±vec)     (core inject)
         │                  │                  │
   JSON v1 → SQLite v2   in-mem → FTS5     local rebuild
                                           + rare LLM
```

### Concrete scale tiers

| Tier | Entries | Storage | Query | Write |
|------|---------|---------|-------|-------|
| **T0 (shipped)** | ≤300/150 | Monolithic JSON | Linear scan | Full rewrite |
| **T1 (optimize)** | ≤2–5k | JSON or sharded keys | Inverted token index + shared scorer; update `lastAccessedAt` | Coalesced writes; optional entry patches |
| **T2 (scale)** | 5k–50k | SQLite (desktop) / structured IDB | FTS5 + filters (scope, tags, pinned) | Row-level upsert |
| **T3 (semantic)** | any | T2 + embedding col or KB bridge | Hybrid rank fusion | Async embed on retain |

### Save-path improvements

1. **Default `retainEveryNTurns` ≥ 3–5** (every turn is wrong at scale)
2. **Remove or hard-gate raw-message fallback** (main pollution source)
3. **Stronger dedupe:** normalize + optional near-dup (tag overlap + Jaccard on tokens); later embedding similarity
4. **Conflict policy:** on retain, if contradiction tags (prefer explicit update/forget tools over silent merge)
5. **Coalesce disk writes** (100–300ms debounce for bank, still flush on app background)
6. **Consolidate:** local always; LLM only on N new facts / idle / user action
7. **Prune:** pin > recent access (`lastAccessedAt`) > enabled > updatedAt; never drop pin

### Query-path improvements

1. **Single `recallEntries(query, banks, opts)`** used by host pre-search, tools, settings search
2. Port host scorer (token overlap + pin boost) into tools; add:
   - exact id match
   - tag exact boost
   - recency / access decay
3. **Inverted index** rebuild on bank change: `token → entryId[]` (memory only first)
4. Cap work: early exit when top-k scores stabilize
5. Optional later: BM25 via FTS5; dense via existing desktop embed path

### Inject-path (keep)

- Hybrid default is correct
- Do not grow core budgets with bank size
- Host pre-search limit 5 is fine; improve ranking not limit
- Multi-agent rooms: keep global + current speaker only (do not inject all agents)

## Technology Guidance

| Choice | Pros | Cons | Verdict |
|--------|------|------|---------|
| Stay on StoreStorage JSON | Cross-platform parity, simple | Full rewrite, no FTS | **T0–T1** |
| In-process inverted index | Fast, no schema migration | Rebuild on load | **Do next** |
| SQLite FTS5 desktop | Real scale, portable file | Platform split | **T2 desktop** |
| Reuse knowledge-base embeddings | Already in app | Wrong UX if coupled; cost | **T3 optional** |
| Mem0/Zep cloud | Mature | Privacy, CE scope, ops | **No for CE default** |
| Graph memory | Temporal relations | Overkill personal prefs | **Defer** |

## Implementation Strategy (phased, no code now)

### Phase S0 — Measure (½ day)

- Log: entry counts, presearch ms, bank JSON bytes, auto-save fact accept rate, user delete rate of auto facts
- Success: know whether problem is quality vs speed vs both

### Phase S1 — Quality (1–2 days) — **highest ROI**

- Gate/remove raw pin fallback
- Raise default `retainEveryNTurns`
- Debounce / batch LLM consolidate
- Use `lastAccessedAt` on recall hits
- Shared scored search for tools + host

### Phase S2 — Index (2–3 days)

- Inverted token index per bank in store
- Invalidate on retain/update/delete/import
- Optional write coalesce

### Phase S3 — Cap policy & mental models (optional)

- Soft cap with “archive disabled” instead of hard drop
- Profile slots: prefs / projects / identity (short strings) instead of one blob

### Phase S4 — Storage upgrade (only if S0 metrics demand)

- Desktop: SQLite rows + FTS5, migrate from JSON
- Web: keep JSON + index or structured IDB
- Preserve export/import JSON as interchange format

### Phase S5 — Semantic hybrid (user pain driven)

- Embed on retain (async)
- Hybrid fusion at recall
- Do **not** inject embeddings into system prompt

## Risk Analyst

| Risk | Severity | Mitigation |
|------|----------|------------|
| Auto-save noise destroys trust | High | Quality gates S1; toast accuracy; easy forget |
| Main-thread presearch jank | Med at 1k+ | Index S2; move heavy to worker if needed |
| Full rewrite races | Med | Serialize bank writes; version field already present |
| LLM consolidate drift | Med | Lazy consolidate; user rebuild |
| Premature vector DB | High process risk | YAGNI until S0/S1 fail |
| Platform split SQLite | Med | Abstract `MemoryRepository` interface early in S2/S4 |
| Privacy | Low today | Keep local-only; redaction; clear bank |

## Decision Framework

| Question | Answer now |
|----------|------------|
| Need vectors this quarter? | **No**, unless measured recall failures |
| Raise maxEntries to 5k? | **Only after** S1+S2 |
| Always inject mode for power users? | Keep optional; hybrid default |
| Per-project memory? | Later; tags + filter first |
| Cloud sync? | Out of CE memory scope |

## Next Actions

1. **Accept S1 as next engineering work** (quality > storage)
2. Add lightweight metrics in dev builds (counts, presearch timing)
3. Spike inverted index on global bank with 5k synthetic facts → p95 latency budget
4. Spike only if needed: map desktop KB SQLite patterns to a `MemoryRepository`
5. Update `docs/memory.md` Architecture section when S2/S4 land

## Unresolved Questions

1. Target max facts per user in product (1k? 10k?) — drives T2 timing
2. Web/mobile must match desktop search quality day-1 of T2?
3. Accept LLM cost of extract every N turns vs cheaper heuristic gate?
4. Should agent banks share global index or stay isolated files forever?
5. Is “archive” UX (disabled + hidden) preferable to hard prune?

## Resources

- Chaeboxi: `docs/memory.md`, `packages/memory/*`, plan `260809-memory-system`
- Hybrid agent memory patterns (industry blogs 2026)
- Mem0 / Zep / Letta comparisons (distillation vs history-first vs OS core/archival)
- SQLite FTS5 + sqlite-vec local agent memory (OpenClaw / sqlite-memory class)
- Lazy consolidation (RecMem-style recurrence gating)

## Appendix A — Bottleneck map (code)

| Component | File | Issue |
|-----------|------|-------|
| Host pre-search | `host-presearch.ts` | Full entry loop every turn |
| Tool search | `bank-ops.ts` `searchEntries` | Substring, unscored |
| Persist | `persistence.ts` | Whole bank rewrite |
| Auto-save | `auto-save.ts` | N=1 + raw fallback + consolidate |
| Dedupe | `bank-ops.ts` `contentFingerprint` | 200-char prefix only |
| Prune | `bank-ops.ts` `pruneEntries` | No access frequency |
| Inject | `inject.ts` | Fine; keep hybrid |
| Schema | `types/memory.ts` | `lastAccessedAt` unused |

## Appendix B — Suggested metrics

```text
memory.entries.global
memory.entries.agent.{id}
memory.bank_bytes.global
memory.presearch.ms
memory.presearch.hits
memory.autosave.extracted
memory.autosave.fallback_pinned
memory.autosave.applied
memory.user_deletes.auto_source
memory.inject.tokens
```
