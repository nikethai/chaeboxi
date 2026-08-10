## Code Review Summary (Re-review after HIGH fixes)

**Score: 8.7 / 10**  
**Safe to ship:** **Yes**  
**Status:** `DONE`  
**Prior score:** 7.5/10 → +1.2 after HIGH remediation

### Scope
- Files re-verified:
  - `src/renderer/stores/session/generation.ts` (pauseWhenExceeded)
  - `src/renderer/packages/usage-tracking/hooks/useUsageBudgetState.ts`
  - `src/renderer/packages/usage-tracking/hooks/useProviderUsageStatus.ts`
  - `src/renderer/packages/usage-tracking/hooks/useAllProviderUsage.ts`
  - `src/renderer/packages/usage-tracking/adapters/gemini-antigravity.ts`
  - `src/renderer/packages/usage-tracking/service.ts` (listConfiguredProviders, rebackfill path)
- Review focus: prior HIGH findings only + residual MED/LOW
- Updated plans: `plans/2026-08-10-provider-usage-status/plan.md`

### Verification (fresh)
| Check | Result |
|---|---|
| `pnpm exec vitest run src/shared/providers/usage src/renderer/packages/usage-tracking` | 5 files, **24 passed** |
| `pnpm check` (`tsc --noEmit`) | **pass** (exit 0) |
| `biome check` on usage paths | still format/import-order noise (not functional) |

### HIGH fix verification

| # | Prior finding | Status | Evidence |
|---|---|---|---|
| 1 | `pauseWhenExceeded` dead UI | **Fixed** | `generation.ts` ~520–548: when `enabled && pauseWhenExceeded`, `evaluateBudget`; on `critical` sets message error + returns before stream |
| 2 | Gemini `catalogHints` unwired | **Fixed** | `gemini-antigravity.ts`: `fetchAntigravityCatalogHints` via `v1internal:fetchAvailableModels` when OAuth token + projectId; maps `quotaInfo.isExhausted` |
| 3 | `useUsageBudgetState` stale | **Fixed** | subscribe → `tick` forces recompute after rollup/emit |
| 4 | Subscribe loading thrash | **Fixed** | both hooks: `load(force, showLoading)`; subscribe uses `showLoading=false` |
| 5 (was MED) | duplicate `continue` in listConfiguredProviders | **Fixed** | single CE strip + credential gate |
| 6 (was MED) | rebackfill mutates rollup in place | **Fixed** | `rebackfill` only calls `backfillFromSessions` + `load` (no `rollup.backfillComplete = false`) |

### Critical Issues
**None.**

### High Priority Findings
**None remaining** from prior list.

### Medium Priority (post-ship OK)

1. **Backfill vs live-record race**  
   - `backfillFromSessions` rebuilds local `rows=[]` then assigns `this.rollup`; concurrent `recordLocalUsage` can be overwritten mid-scan.  
   - `backfillRunning` only serializes backfills, not live writes.  
   - Impact: rare token undercount until next rebackfill.  
   - Fix: queue writes during backfill, or merge post-scan with events since start.

2. **HTTP status still not on classifier path**  
   - `ApiError` has `responseBody` only (no `status`).  
   - `handleGenerationError` omits status → pure-429 bodies without quota text may miss exhaust.  
   - Text-based classifier still covers most quota strings.

3. **Quiet re-sync still full `getAllStatuses` on emit**  
   - No loading thrash (fixed); still may fan adapter work when TTL cold. Acceptable v1 (10m cache).

4. **Biome format/import order** on usage package paths — clean with `pnpm format` before merge.

5. **No generation→rollup integration test** (plan testing table still open).

### Low Priority
- `service.ts` ~485 LOC — modularize later  
- Gemini network catalog path untested (hints path covered)  
- per-provider budget UI still schema-only  
- whole-store `useSettingsStore((s) => s)` in hooks  

### Product rules checklist (unchanged pass)
Dual honesty · known-only meters · soft budget default · CE strip · adapters · statusline · error CTA · **pause toggle now enforced** · **Gemini partial via live catalog**

### Positive Observations
- HIGH set fixed with minimal surface and non-fatal try/catch around pause/eval.  
- Gemini adapter self-fetches catalog when hints absent — no UI plumbing required.  
- Quiet re-sync API (`showLoading`) is clean pattern.  
- Budget hook tick subscribe is simple and correct.

### Recommended Actions
1. **Ship** Provider Usage Status as-is.  
2. Follow-up: backfill write lock / merge (MED).  
3. Follow-up: attach HTTP status to `ApiError` or parse from message (MED).  
4. `pnpm format` usage paths; optional gen→rollup integration test.

### Metrics
- Type coverage: tsc clean  
- Unit tests: **24 passed / 0 failed**  
- Integration tests: none  
- Prior HIGH open: **0**  
- Score: **8.7/10** (was 7.5)

### Ship decision
**SHIP YES.** Remaining MED items are post-ship polish; no critical/high functional gaps for v1 acceptance.

### Unresolved questions
1. Accept rare backfill race undercount until follow-up, or block on write-queue? → recommend ship + follow-up.  
2. Should pause also fire at `warn`? (product says critical/exceeded only — current code correct.)

---

### Status line for controller
```
Status: DONE
Summary: Re-review after HIGH fixes: all 4 HIGHs + list/rebackfill cleanups verified; 24 tests + tsc green. Score 8.7/10. Ship YES.
Concerns/Blockers: residual MED only (backfill race, ApiError status, biome format, no integration test) — not ship blockers.
```
