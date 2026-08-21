# Code Review — Continuity Phase 0

**Date:** 2026-08-21  
**Score:** 8/10  
**critical_count:** 0  
**Reviewer focus:** bugs, regressions, security, YAGNI/KISS/DRY, discovery vs plan, Phase 0 gate

## Code Review Summary

### Scope

- Files reviewed:
  - `src/renderer/packages/history-search/linear-scan.ts`
  - `src/renderer/packages/history-search/linear-scan.test.ts`
  - `src/renderer/packages/history-search/index.ts`
  - `src/renderer/packages/imported-context/untrusted-reference-block.ts`
  - `src/renderer/packages/imported-context/untrusted-reference-block.test.ts`
  - `src/renderer/packages/imported-context/index.ts`
  - `src/renderer/stores/sessionHelpers.ts` (search extract only)
  - `src/renderer/pages/SearchDialog.tsx` (caller, no Phase 0 edit)
  - `plans/260820-2357-next-feature-growth/plan.md`
  - `plans/260820-2357-next-feature-growth/phase-00*.md`
  - `plans/260820-2357-next-feature-growth/adrs/*`
  - `plans/260820-2357-next-feature-growth/discovery/*`
  - `plans/260820-2357-next-feature-growth/reports/phase-0-2026-08-21.md`
  - `plans/260820-2357-next-feature-growth/reports/phase-0-qa-2026-08-21.md`
- Lines of code analyzed: ~370 new spike LOC + search call-site + discovery/ADR markdown
- Review focus: Phase 0 spikes + discovery correctness vs plan
- Updated plans: `plan.md`, `phase-00-discovery.md`

### Overall Assessment

Phase 0 gate held. Search extract is a 1:1 move of the previous linear scan (substring via escaped `/i` regex, cap 50 on the global path, threads yes, forks no). Untrusted block is user-role only and omits `system`/`tool`. No MVP storage/IPC/UI/FTS/send wiring in product code.

Not 10/10: the security spike still has delimiter breakout and non-prefix packing; tests do not cover `searchSessions` cap/I/O; QA note wrongly claims a `u` flag.

### Critical Issues

None.

### High Priority Findings

None that ship today. The two untrusted-block issues below are **SHOULD FIX before send-path wiring**, not current-product defects (builder is not imported by generation).

### Medium Priority Improvements

See Warnings.

### Low Priority Suggestions

See Suggestions.

### Positive Observations

- Matcher extract preserves `_searchSessions` control flow, `migrateSession`/`migrateMessage`, newest-first current thread then newest-first archived threads.
- Cap 50 extracted as `LINEAR_HISTORY_SEARCH_RESULT_CAP`; global `searchSessions` still stops after adding a session that crosses the cap.
- Fork + tool-call + unicode case-fold tests document the real contract.
- ADRs stay discovery-only: `chaeboxi_imported.db`, `importedArchives`, `continuationLineage` do not exist in `ts`/`rs`.
- Threat models match the approved generation order (system → memory → untrusted user block → new instruction).
- Field work (recruit, real ZIP, desktop I/O timing) is honestly unmarked as done.

### Recommended Actions

1. Keep Phase 1 closed until `plan.md` exit criteria pass.
2. Before wiring `buildUntrustedImportedContextBlock` to send: strip wrapper tags; prefix-pack; reason codes.
3. Add a `searchSessions` test for the global cap (and keep SearchDialog loading race out of this spike).
4. Do not commit unrelated `src/renderer/routeTree.gen.ts` import-order churn.
5. Treat in-memory 10k-message timing as CPU-only; still need volunteer `session:*` IPC numbers.

### Metrics

- Type Coverage: Phase 0 files not in `tsc` error list. Repo `pnpm check` still red (pre-existing).
- Test Coverage: not measured. Focused suite 14/14 pass.
- Linting Issues: 0 on focused paths (`biome check` 7 files).

## Structured review

### score

8/10

### critical_count

0

### Critical issues (MUST FIX)

None.

### Warnings (SHOULD FIX)

1. **Delimiter breakout in untrusted excerpts** — `src/renderer/packages/imported-context/untrusted-reference-block.ts:39-41`, `67-72`  
   `sanitizeExcerptText` only drops NULs. Excerpt/title/source can contain `</untrusted-imported-context>`. That defeats the wrapper H1 relies on once this is sent as one user message. Strip/replace both wrapper tags (and collapse newlines in metadata fields) before Phase 1 send wiring.

2. **Block packing is not prefix-stable** — `untrusted-reference-block.ts:83-86`  
   On size overflow the loop `continue`s, so a later smaller excerpt can replace an earlier user-selected one. User selection order should be a prefix: omit the rest after budget.

3. **Omitted reasons are prose, not codes** — `untrusted-reference-block.ts:55,60,84` vs ADR 004  
   ADR wants `omittedReasons` codes (not text). Spike emits `omitted system message ${id}`. Fine for a prototype; map to codes (`role_ineligible`, `empty`, `block_size_limit`) before lineage persistence.

4. **`searchSessions` cap/hidden-skip untested** — `sessionHelpers.ts:912-947`  
   Matcher tests exist; the global cap, serial `getItem`, and `sortSessions` hidden skip are not. A future edit can change stop-after-50 without failing `linear-scan.test.ts`.

5. **QA report claims a Unicode `u` flag that is not in code** — `reports/phase-0-qa-2026-08-21.md` vs `linear-scan.ts:16-17`  
   Runtime is `new RegExp(..., 'i')` only. Vietnamese test still passes (BMP). Do not document `/iu` as current behavior.

6. **Do not land `routeTree.gen.ts` with this change** — import reorder only, unrelated to Continuity.

### Suggestions

- Magic `+ 8` in block size accounting (`untrusted-reference-block.ts:76`); count the real joined string or drop the fudge.
- `used += chunk.length` ignores join `\n`; cap can overshoot `MAX_BLOCK_CHARS` by ~N excerpts.
- `text.slice(0, 8000)` is UTF-16 code units; can split surrogates.
- Add a matcher test that `foo.*bar` does **not** match `fooXbar` (escape unit test does not prove `RegExp` behavior).
- 10k-message `< 200ms` test is CPU-only and can flake on a loaded host; keep it documentary, not a CI gate, unless stabilized.
- `sessionHelpers.test.ts` still mocks `migrateSession` though `sessionHelpers.ts` no longer imports it (`history-search` does). Stale mock will break if `searchSessions` tests are added here.
- Search-baseline should list reasoning parts as not searched (`getMessageText(..., includeReasoning=false)`).
- Searching the literal `image` can hit `[image]` placeholders (`includeImagePlaceHolder` default true). Pre-existing; document, do not “fix” in Phase 0.
- `isUntrustedImportedContextText` is unused outside tests (acceptable spike helper).
- Empty eligible selection still returns a wrapper-only user block; Phase 1 caller must not send `includedCount === 0`.

### Summary of what was implemented vs gated

**Implemented (approved Phase 0):**

| Workstream | In repo |
| --- | --- |
| A Demand | Protocols only (screener, tasks, consent, measurement). No recruiting. |
| B Export | ChatGPT v1 choice documented; Claude deferred. No adapter, no fixtures from real ZIPs. |
| C Search | Linear scan extracted + unit tests. No FTS/SQLite history index. |
| D Security | Two threat models + untrusted-block builder/tests. **Not** wired to send. |
| E ADRs | Five discovery ADRs. No `imported:*` keys, no IPC, no Zod lineage field. |

**Gated (must stay out until Phase 1 opens):**

- Imported-source storage / `chaeboxi_imported.db`
- Archive inspect/publish IPC and ZIP libraries in the renderer
- Search index / FTS5
- Importer UI / reconciliation UI
- `continuationLineage` on Session
- Generation-path prepend of the untrusted block
- Tool/memory defaults on a continuation session

**Search identity (verified against pre-extract `_searchSessions`):**

- Case-insensitive substring (same metacharacter escape, `/i`, no `/g`)
- Global cap 50 matching **messages** (can overshoot on the last session; same as before)
- Current-session path still uncapped
- Current `messages` + `threads`, not `messageForksHash`
- Hidden sessions skipped via existing `sortSessions`
- `getMessageText` still skips tool-call parts

**Untrusted block identity vs plan:**

- `result.role` is always `'user'`
- `system` and `tool` omitted
- Not referenced from `session/generation` or InputBox

## Verification

### Passed

- `pnpm exec vitest run src/renderer/packages/history-search/linear-scan.test.ts src/renderer/packages/imported-context/untrusted-reference-block.test.ts src/renderer/stores/sessionHelpers.test.ts` — 14/14
- `pnpm exec biome check src/renderer/packages/history-search src/renderer/packages/imported-context src/renderer/stores/sessionHelpers.ts` — clean
- Grep: no `ImportedSource`, `inspectImportedArchive`, `chaeboxi_imported`, `importedArchives`, `continuationLineage` in `ts`/`tsx`/`rs`

### Failed

- `pnpm check` (`tsc --noEmit`) — pre-existing: `general.tsx` syncConfig, `gemini-antigravity.ts` thinkingConfig, website `.ts` import extensions. **No Phase 0 files in the error list.**

### Not run

- Full `pnpm test`
- `pnpm test:coverage`
- `pnpm build:renderer` / `pnpm build:web`
- Desktop I/O timing of `session:*` search

### Unavailable

- In-repo CI claim (local gates only)
- Volunteer desktop corpus / real ChatGPT ZIP

### Platforms

| Target | Affected | Evidence |
| --- | --- | --- |
| Desktop | Search extract used by SearchDialog on all runtimes | Node unit tests; I/O unmeasured |
| Web | Same renderer search path | Reasoned; no extra web code |
| Mobile | Same | Reasoned; no extra mobile code |

## Unresolved questions

- Confirm volunteer desktop `session:*` search p95 before any FTS decision (ADR 003 already says wait).
- Are repo `tsc` failures tracked separately? They are outside this spike.
