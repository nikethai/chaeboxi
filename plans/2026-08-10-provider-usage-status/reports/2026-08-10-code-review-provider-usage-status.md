## Code Review Summary

**Score: 7.5 / 10**  
**Safe to ship:** Yes, with concerns (fix HIGH items recommended before/shortly after ship)  
**Status:** `DONE_WITH_CONCERNS`

### Scope
- Files reviewed:
  - `src/shared/providers/usage/*`
  - `src/renderer/packages/usage-tracking/*`
  - `src/renderer/components/usage/*`
  - `src/renderer/routes/settings/usage.tsx`
  - `src/renderer/routes/settings/route.tsx`
  - `src/renderer/routes/settings/provider/$providerId.tsx`
  - `src/renderer/components/chat/SessionStatusBar.tsx`
  - `src/renderer/components/chat/MessageErrTips.tsx`
  - `src/renderer/stores/session/generation.ts`
  - `src/shared/types/settings.ts` (`usageBudget`)
  - `src/renderer/storage/StoreStorage.ts`
  - `docs/provider-usage-status.md`
  - `claudedocs/provider-usage-adapter-spikes.md`
- Approx LOC: ~2.5k new/changed (domain + UI + hooks)
- Review focus: Provider Usage Status v1 product rules + plan acceptance
- Updated plans: `plans/2026-08-10-provider-usage-status/plan.md`

### Verification (fresh)
| Check | Result |
|---|---|
| `pnpm exec vitest run src/shared/providers/usage src/renderer/packages/usage-tracking` | 5 files, **24 passed** |
| `pnpm check` (`tsc --noEmit`) | **pass** |
| `biome check` on usage paths | **format/import-order errors** (not type bugs) |
| Product rules spot-check | dual honesty, known-only meters, CE strip OK |

### Overall Assessment
Solid foundation: honest dual model, clean adapter registry, pure rollup/budget math with unit tests, Settings hub + provider card + statusline + error path wired. Adapters correctly refuse fake remaining %. CE `chatbox-ai` excluded; no license UI reintroduced.

Gaps: UI toggle `pauseWhenExceeded` not enforced; Gemini `catalogHints` never wired from model catalog (and catalog drops exhausted models); budget hook does not subscribe to rollup updates; usage hooks re-fetch + set loading on every service emit (chat thrash if Usage page open).

---

### Critical Issues
None for security / data loss / CE license regression.

---

### High Priority Findings

1. **`pauseWhenExceeded` is dead UI**  
   - Files: `src/renderer/components/usage/UsageBudgetSettings.tsx`, `src/shared/types/settings.ts`, `src/renderer/stores/session/generation.ts`  
   - Schema + Settings switch exist; **no check in `generate()`** before stream.  
   - Impact: user enables “Pause generation when budget exceeded” → generations still run.  
   - Fix: at start of `generate()`, if `usageBudget.enabled && pauseWhenExceeded`, evaluate budget; if `critical`, abort with clear message + Usage CTA. Or hide toggle until implemented.

2. **Gemini Antigravity catalog partial/exhausted never surfaces in product**  
   - Files: `src/renderer/packages/usage-tracking/adapters/gemini-antigravity.ts`, `src/shared/providers/oauth/gemini-antigravity-models.ts` (~224 filters `isExhausted`), `service.getStatus` `catalogHints` never passed from hooks/UI  
   - Adapter + tests support `catalogHints`; runtime always falls to `unknown`.  
   - Plan acceptance #3 partially unmet.  
   - Fix: when listing models, retain exhausted entries (or side-channel list) and pass as `catalogHints` into `getStatus` / refresh models path.

3. **`useUsageBudgetState` does not react to local usage updates**  
   - File: `src/renderer/packages/usage-tracking/hooks/useUsageBudgetState.ts`  
   - `useMemo` deps = config/period/providerId only; reads `providerUsageService.getLocalSnapshot` but no `subscribe()`.  
   - Statusline budget warn/critical + Usage overview badge stay stale until settings change.  
   - Fix: subscribe to service (or tick version) and recompute.

4. **Subscribe → full refresh thrash**  
   - Files: `hooks/useAllProviderUsage.ts`, `hooks/useProviderUsageStatus.ts`  
   - On every `recordLocalUsage` emit: `setLoading(true)` + `getAllStatuses` / `getStatus`. Usage page can flicker; SessionStatusBar does extra work each turn.  
   - Fix: soft refresh without loading flag; update local from rollup only when quota cache still fresh; debounce.

---

### Medium Priority Improvements

5. **Backfill race with live recording**  
   - `service.backfillFromSessions` rebuilds `rows = []` then replaces store; concurrent `recordLocalUsage` can be wiped.  
   - Serialize with a write lock or merge post-scan.

6. **HTTP status not passed into quota classification on generation errors**  
   - `ApiError` has no `status`; `handleGenerationError` omits status → pure-429 bodies without quota/rate text may not classify.  
   - Prefer attaching status on `ApiError` when available, or parse from message.

7. **`listConfiguredProviders` duplicate condition**  
   - `service.ts` ~214–216 identical `continue` twice — dead copy-paste.

8. **Rebackfill mutates internal rollup**  
   - `useAllProviderUsage.rebackfill`: `rollup.backfillComplete = false` mutates service state in place. Prefer service method `resetBackfillFlag()`.

9. **No generation→rollup integration test**  
   - Plan testing table asks for it; only pure unit tests exist.

10. **Biome format / import order dirty on new files**  
    - Pre-commit may auto-fix; clean with `pnpm format` before merge.

11. **`service.ts` ~485 lines**  
    - Over project modularization guideline (200); split backfill / listing / quota cache later.

---

### Low Priority Suggestions / NITs

12. **Per-provider budget overrides** in schema, no UI (`perProvider`). OK for v1.  
13. **`useSettingsStore((s) => s)`** whole-store select in usage hooks → broad re-renders.  
14. **Rate-limit header capture** deferred (documented) — acceptable honesty.  
15. **i18n keys** new Trans strings not in `for-key-scan` (project pattern for ChatboxAI errors); verify extract pipeline.  
16. **Statusline tone classes** on inner `Text` work with `.session-statusline-plan.is-warn .session-statusline-val`; prefer single class on button for clarity.  
17. **`recordFromMessage` skips** when input+output are 0 (cached-only edge).

---

### Product rules checklist

| Rule | Status |
|---|---|
| Dual honesty “In this app” vs “Provider plan” | **Pass** — cards, popover, hub copy |
| Progress bars only when `quota.state === 'known'` | **Pass** — `QuotaMeter.tsx` |
| Soft budgets default warn-only | **Pass** — disabled + `pauseWhenExceeded: false` default; toast path exists |
| No Chatbox AI license UI reintroduced | **Pass** |
| CE `chatbox-ai` stripped from usage listing | **Pass** — `service.listConfiguredProviders` |
| Plan identity adapters (Codex/Gemini/Qwen/xAI) | **Pass** (labels/links) |
| Provider remaining % | **Pass** (honest unknown/partial/unsupported) |
| Statusline plan segment + popover | **Pass** (non-compact) |
| Error → exhausted + Usage CTA | **Pass** (best-effort text/code) |

---

### Positive Observations
- Honesty model encoded in types + UI + docs; no fake Plus message meters.  
- Adapter registry with default unsupported; spikes documented.  
- Pure rollup/budget/classifier unit tests green.  
- Generation hooks non-fatal try/catch; won’t break chat.  
- Storage keys + budget Zod with `.catch` for migration safety.  
- Settings nav + route tree include `/settings/usage`.

---

### Recommended Actions (priority)
1. Enforce or hide `pauseWhenExceeded`.  
2. Wire Gemini `catalogHints` (or document “error-driven only” and drop partial claim).  
3. Subscribe `useUsageBudgetState` to service; stop loading flicker on soft refresh.  
4. Backfill concurrency guard.  
5. `pnpm format` on usage packages; optional integration test.  
6. Pass HTTP status into classifier when available.

---

### Metrics
- Type coverage: `tsc --noEmit` clean for this work  
- Unit tests (usage packages): **24 passed / 0 failed**  
- Integration tests (generation→rollup): **none**  
- Linting (usage paths): format/import errors present; repo-wide lint already noisy  
- Score: **7.5/10**

---

### Plan TODO verification (from plan.md success criteria)

| Criterion | Done? |
|---|---|
| Settings Usage page | Yes |
| Subscription providers plan + dual metrics | Yes (provider remaining mostly unknown by design) |
| Progress only when known | Yes |
| Statusline plan chip + popover | Yes |
| Quota errors update state + MessageErrTips | Yes |
| Soft budgets warn; no hard block by default | Yes (warn path); pause toggle incomplete |
| Incremental local rollup | Yes (day index + backfill) |
| Unit tests aggregator/budget/classifier/adapters | Yes |
| Design-aligned quiet UI | Mostly yes |

---

### Unresolved questions
1. Ship with non-functional pause toggle, or block until enforced?  
2. Should Gemini model refresh return exhausted models as hints instead of filtering them out?  
3. Accept Usage-page re-fetch-on-every-chat for v1?

---

### Status line for controller
```
Status: DONE_WITH_CONCERNS
Summary: Provider Usage Status is product-coherent and typecheck/unit-test green; honesty + CE strip solid. Score 7.5/10; shippable with high-priority fixes for pause toggle, Gemini catalog wiring, and budget hook staleness/refresh thrash.
Concerns/Blockers: pauseWhenExceeded UI dead; Gemini catalogHints unwired; useUsageBudgetState stale; subscribe full-refresh thrash.
```
