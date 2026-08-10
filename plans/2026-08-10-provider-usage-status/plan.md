# Plan: Provider Plan Usage Status (Full Product Feature)

**Status:** COMPLETE / Implemented — re-reviewed after HIGH fixes (2026-08-10)  
**Review score:** 8.7/10 · **Ship:** **YES**  
**Reports:**
- [implementation-complete.md](./reports/implementation-complete.md)
- [code-review](./reports/2026-08-10-code-review-provider-usage-status.md)
- [re-review after HIGH](./reports/2026-08-10-code-review-provider-usage-status-rereview.md)
- [QA tests](./reports/2026-08-10-qa-provider-usage-status-tests.md)

**Product name (working):** Provider Usage Status  
**Scope:** Track and surface the **user’s provider subscription / plan usage** (ChatGPT Plus/Pro, Qwen Token/Coding Plan, Gemini Antigravity, SuperGrok, and local usage for all configured providers).  
**Non-scope:** Chaeboxi/Chatbox AI license billing, first-party monetization, CE `stripChatboxPaidFeatures` reversal.

**v1 stance:** Ship as a **complete product surface**, not a thin MVP. v1 includes the full hub, per-provider cards, adapters (real or honest-unknown), local rollups, statusline integration, error-driven quota state, budgets/alerts, tests, and docs. Implementation is ordered below for build safety; **all phases ship together**.

### Post-review follow-ups
- [x] **HIGH:** Enforce `pauseWhenExceeded` in `generation.ts` (critical level; non-fatal on eval failure)
- [x] **HIGH:** Gemini Antigravity fetches catalog hints via `fetchAvailableModels` when OAuth+projectId
- [x] **HIGH:** `useUsageBudgetState` subscribe + tick recompute
- [x] **HIGH:** Soft-refresh on service subscribe (`showLoading=false`)
- [x] **MED:** Removed duplicate `listConfiguredProviders` continue; rebackfill no longer mutates rollup in place
- [ ] **MED (post-ship):** Backfill vs live-record race; pass HTTP status into classifier; biome format usage files
- [ ] **LOW (post-ship):** per-provider budget UI; service modularization; generation→rollup integration test

---

## 1. Goals & success criteria

### User goals
1. See **which plan** they are on for subscription-backed providers (Plus/Pro, Coding Plan, etc.).
2. See **usage status** where the provider exposes it (used/limit/reset), or an honest **unknown** state with dashboard link.
3. See **usage inside Chaeboxi** under each provider (tokens, est. cost, models) over a period — always available when chats have `Message.usage`.
4. Get **proactive feedback** when approaching a user soft budget or when the provider reports / errors as exhausted.
5. Act: open provider settings, open external dashboard, switch model/provider after limit.

### Success criteria (v1 done)
- [x] Settings has a first-class **Usage** page listing all providers with credentials/config.
- [x] Every subscription OAuth / plan-preset provider shows plan identity + dual metrics (provider quota + local). *(provider remaining usually unknown by design)*
- [x] Progress bars only when `quota.state === 'known'`; never invent remaining %.
- [x] Active-session statusline shows provider plan/usage chip with popover (not a second composer chip).
- [x] Quota/rate-limit errors update usage state and message UX consistently.
- [x] Soft budgets (optional) warn at thresholds; do not hard-block chat by default. *(pauseWhenExceeded enforced at critical)*
- [x] Local rollups stay fast with large histories (incremental index, not full rescan on every paint).
- [x] Unit coverage for aggregator, budget, error classification, adapters (mocked). *(integration gen→rollup still open)*
- [x] Design-guidelines-aligned UI (dark-first, quiet chrome, statusline as telemetry SoT).

### Non-goals
- Perfect parity with ChatGPT/Qwen web billing dashboards.
- Undocumented high-frequency scraping of provider internal APIs (adapters may use **existing** client paths only; anything unofficial is best-effort + feature-flagged + degrades to `unknown`).
- Hard server-side enforcement of provider limits (impossible for BYOK).
- Chatbox AI license UI in CE.

---

## 2. Product principles

| Principle | Rule |
|---|---|
| **Honesty** | Dual labels: “In this app” vs “Provider plan”. `unknown` is first-class. |
| **Local is always true** | Chaeboxi-observed usage is authoritative for *this app only*. |
| **Provider is best-effort** | Real meters only when adapter can prove numbers. |
| **Quiet by default** | Statusline quiet; depth lives in Settings / popover. |
| **No fake limits** | No hard-coded “Plus = 40 messages” bars. |
| **Per-credential** | Status is for current `ProviderSettings` (current OAuth account / key), not “all keys ever”. |

---

## 3. Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│ UI                                                               │
│  Settings → Usage (hub)                                          │
│  Settings → Provider → Plan & usage card                         │
│  SessionStatusBar → plan/usage segment + popover                 │
│  MessageErrTips / banner → exhausted / near-budget               │
└───────────────────────────────┬─────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│ ProviderUsageService  (renderer package)                         │
│  getStatus(providerId) / getAllStatuses()                         │
│  refresh(providerId) / markExhausted(providerId, meta)           │
│  recordLocalUsage(event) · evaluateBudgets()                     │
└───────────────┬─────────────────────────────┬───────────────────┘
                │                             │
     ┌──────────▼──────────┐       ┌──────────▼──────────────────┐
     │ LocalUsageStore      │       │ QuotaAdapter registry        │
     │ rollup by day×prov   │       │ openai-codex, gemini-ag,     │
     │ ×model               │       │ qwen-plan, xai-oauth,        │
     │ + budget settings    │       │ default (unsupported)        │
     └──────────▲──────────┘       └──────────▲──────────────────┘
                │                             │
     generation completes              OAuth tokens / planId /
     Message.usage written             model catalog / rate headers /
                                       classified errors
```

### Core types (shared contract)

```ts
// conceptual — implement under packages/usage-tracking or shared/providers/usage

type UsagePeriod = '7d' | '30d' | 'calendar-month'

type LocalUsageSnapshot = {
  period: UsagePeriod
  inputTokens: number
  outputTokens: number
  cachedInputTokens: number
  reasoningTokens: number
  estimatedCostUsd: number
  messageCount: number
  byModel: Array<{ modelId: string; inputTokens: number; outputTokens: number; estimatedCostUsd: number }>
}

type ProviderQuotaSnapshot = {
  state: 'known' | 'partial' | 'unknown' | 'exhausted' | 'unsupported' | 'error'
  used?: number
  limit?: number
  unit?: 'tokens' | 'requests' | 'credits' | 'percent' | 'messages' | 'custom'
  resetsAt?: string // ISO
  models?: Array<{ modelId: string; exhausted?: boolean; label?: string }>
  detail?: string
  source: 'provider-api' | 'response-headers' | 'model-catalog' | 'inferred-error' | 'none'
  updatedAt: number
  errorMessage?: string
}

type ProviderPlanInfo = {
  label: string           // "ChatGPT Pro", "Qwen Coding Plan"
  planId?: string
  region?: string
  authMode: 'oauth' | 'api_key' | 'none'
  accountHint?: string    // email / truncated account id
}

type ProviderUsageStatus = {
  providerId: string
  providerName: string
  connected: boolean
  plan?: ProviderPlanInfo
  quota: ProviderQuotaSnapshot
  local: LocalUsageSnapshot
  links?: { dashboardUrl?: string; docsUrl?: string; settingsPath: string }
}

type UsageBudgetConfig = {
  enabled: boolean
  period: UsagePeriod
  /** Optional global soft caps across all providers */
  tokenLimit?: number
  costLimitUsd?: number
  /** Per-provider overrides keyed by providerId */
  perProvider?: Record<string, { tokenLimit?: number; costLimitUsd?: number }>
  warnAtPercent: number // default 80
  criticalAtPercent: number // default 100 — warn only, no hard stop by default
}
```

### Module layout

```text
src/shared/providers/usage/           # pure types + adapter interface + registry hooks
  types.ts
  adapter.ts                          # ProviderQuotaAdapter interface
  classify-quota-error.ts             # map ApiError / body / status → exhausted | rate_limit
  plan-labels.ts                      # planId/planType → display labels

src/renderer/packages/usage-tracking/
  index.ts
  service.ts                          # ProviderUsageService facade
  local-rollup.ts                     # day×provider×model aggregation
  local-store.ts                      # persist rollup + last quota snapshots
  budget.ts                           # soft budget evaluation
  pricing.ts                          # re-export / wrap cost-tracking calculator
  adapters/
    openai-codex.ts
    gemini-antigravity.ts
    qwen-plan.ts
    xai-oauth.ts
    default.ts
  hooks/
    useProviderUsageStatus.ts
    useAllProviderUsage.ts
    useUsageBudgetState.ts

src/renderer/components/usage/
  UsageHubPage.tsx                    # or routes/settings/usage.tsx owns page
  ProviderUsageCard.tsx
  QuotaMeter.tsx                      # only when known
  LocalUsageBreakdown.tsx
  UsageBudgetSettings.tsx
  ProviderUsagePopover.tsx            # statusline popover
  UsageEmptyState.tsx

src/renderer/routes/settings/usage.tsx
```

Storage keys: extend `StorageKey` (or dedicated key) for rollup index + last quota cache + budget config. Prefer **immediate write** for budget settings; **debounced** for rollup rows.

---

## 4. Provider adapter matrix (v1 complete)

Every connected provider gets **local usage**. Subscription providers also get a specialized adapter.

| Provider | Plan identity (v1) | Provider quota (v1) | Local usage | Dashboard link |
|---|---|---|---|---|
| **OpenAI · Codex OAuth** | `oauth.planType` → Plus/Pro/Team | Best-effort: error-driven exhausted; optional session/header probes if already available in client without new reverse-eng | Yes | ChatGPT / Codex usage help URL |
| **OpenAI · API key** | “Platform API” | Rate-limit headers when present (`x-ratelimit-*` style) as **RPM/TPM remaining**, labeled *rate limit not subscription* | Yes | platform.openai.com usage |
| **Gemini · Antigravity OAuth** | `oauth.planType` + email | Model catalog `quotaInfo.isExhausted` → partial/exhausted list; plan refresh notes in copy | Yes | Antigravity / Google AI plan docs |
| **Gemini · AI Studio key** | API key mode | Local + rate-limit headers if any | Yes | AI Studio |
| **Qwen · Token/Coding/Standard** | `planId` + `region` from presets | Plan-specific: show plan type; usage API only if Phase research finds stable official endpoint; else `unknown` + console link | Yes | QwenCloud / Model Studio docs URLs already in presets |
| **xAI · SuperGrok OAuth** | OAuth mode label | Error-driven exhausted + local; plan if token claims exist | Yes | console.x.ai / SuperGrok |
| **xAI · API key** | API key mode | Local + headers if any | Yes | console.x.ai |
| **All other providers** | n/a | `unsupported` for subscription quota | Yes | provider `urls` if present |

### Adapter interface

```ts
interface ProviderQuotaAdapter {
  id: string
  supports(providerId: string, settings: ProviderSettings): boolean
  getPlan(settings: ProviderSettings): ProviderPlanInfo | undefined
  /** Network optional; must tolerate offline / failure → unknown|error */
  fetchQuota(ctx: {
    settings: ProviderSettings
    signal?: AbortSignal
  }): Promise<ProviderQuotaSnapshot>
  getLinks(settings: ProviderSettings): { dashboardUrl?: string; docsUrl?: string }
}
```

### Research spike (still required inside v1, before UI freeze for meters)

For Codex / Qwen / xAI: confirm in-repo or official:

1. Any existing response fields for remaining quota?
2. Safe endpoints already used by OAuth clients?
3. Rate-limit headers on chat responses?

**Decision rule:** If not proven in ≤1 day spike each, ship adapter as `unknown`/`partial`/`error-driven` — still full product (honest UI), not a cut feature.

---

## 5. Local usage system (full)

### Write path
On successful assistant generation (existing path in `stores/session/generation.ts` that sets `usage`):

1. Emit `LocalUsageEvent { providerId, modelId, usage, estimatedCost, at }`
2. Upsert rollup row for `day = YYYY-MM-DD`
3. Invalidate React Query / jotai usage atoms for that provider

### Read path
- Aggregate by period (7d / 30d / calendar month)
- Filter by provider; optional model breakdown
- Reuse `cost-tracking` pricing maps for estimates; always label **estimate**

### Backfill
On first install of feature:

- One-time scan of sessions to seed rollup (background, cancellable, progress on Usage page)
- Mark `usageRollupVersion` so re-backfill can re-run after schema bumps

### What counts
- Assistant messages with `usage` only
- Include tool-loop finals once (same as today’s message usage write)
- Exclude failed generations without usage
- Compaction/summary messages: include if they have usage (they consume provider quota)

---

## 6. Soft budgets & alerts (full product)

### Config (Settings → Usage → Budgets)
- Global token and/or $ soft limits per period
- Optional per-provider overrides
- Warn at 80% (default), critical at 100%
- Toggle: enable/disable budgets
- **Default: soft warn only** (banner + statusline color); no hard stop unless user enables “Pause generation when budget exceeded” (optional advanced toggle — ship it)

### Surfaces
1. Usage hub: progress toward budget
2. Statusline: muted → warning → critical colors
3. One-shot toast per threshold per period (no spam; store last notified level)
4. Chat banner when active provider exhausted or budget critical

---

## 7. UI/UX specification

### 7.1 Settings → Usage (hub)

**Nav:** add `usage` item in `settings/route.tsx` (near Model Provider / Chat). Icon e.g. chart/gauge.

**Sections:**
1. **Period selector** — 7d / 30d / This month  
2. **Overview strip** — total tokens, est. cost, providers with alerts  
3. **Provider list** — cards for each configured provider:
   - Name + connection badge
   - Plan chip (if any)
   - Local usage summary
   - Quota meter or “Remaining unknown”
   - Exhausted / near-budget badges
   - Actions: Open settings · Refresh · Open dashboard  
4. **Budgets** — collapsible config  
5. **Empty / backfill** — if no rollup yet

### 7.2 Provider settings card (`$providerId`)

New **Plan & usage** `SettingsSection` (after Connection for subscription providers; still show local-only for others):

- Plan label + account hint  
- Quota state UI  
- Local period usage + top models  
- Refresh + dashboard links  
- Deep-link from hub

### 7.3 Session statusline

Extend `SessionStatusBar` (design SoT for tok/$):

- New segment **plan** (only when active provider has plan or budget/exhausted):
  - Examples: `plan Pro`, `plan · exhausted`, `plan 82%` (only if known)
- Click → `ProviderUsagePopover` with dual sections + link to Settings Usage
- Compact/quick chat: omit or show exhausted only

### 7.4 Errors & banners

- Map provider 429 / quota strings via `classify-quota-error` → mark exhausted + improved `MessageErrTips` CTA: “View usage”  
- Align with existing `token_quota_exhausted` / `rate_limit_exceeded` keys; add provider-agnostic copy where needed  
- Success after exhausted: clear exhausted on successful generation + optional refresh

### 7.5 Visual rules (design-guidelines)
- No gradient glows; solid brand indigo for meters  
- Quiet cards; mono for numbers  
- Progress only for known quotas and budgets  
- Exhausted: attention chip, not screaming modal

---

## 8. Data flow sequences

### Fresh open Usage page
1. Load budget config + rollup from storage  
2. Parallel `getStatus` for listed providers  
3. Adapters fetch with TTL cache (default 10 min); show stale + “Updated Xm ago”  
4. Render

### After chat turn
1. Write message usage (existing)  
2. Increment rollup  
3. Evaluate budgets → maybe toast/banner  
4. Statusline local numbers update; provider quota unchanged unless error

### On quota error
1. Classify error  
2. `markExhausted(providerId, { model?, until? })`  
3. UI: badge + tips + optional statusline  

---

## 9. Implementation phases (all in v1 ship)

Phases are **build order**, not release cuts. Feature flag `providerUsageStatus` optional during development; **remove or default ON at release**.

### Phase A — Domain foundation
**Deliverables**
- Types, adapter interface, registry
- Local rollup store + backfill
- Budget config in settings schema (Zod)
- `ProviderUsageService`
- Unit tests: rollup, budget math, error classification

**Files**
- `src/shared/providers/usage/*`
- `src/renderer/packages/usage-tracking/*`
- `src/shared/types/settings.ts` (budget fields)
- Storage key enum + migration if needed

### Phase B — Adapters (subscription providers complete)
**Deliverables**
- Codex, Gemini Antigravity, Qwen, xAI adapters + default
- Plan labels + dashboard/docs links
- Spike results documented in `docs/` or `claudedocs/`
- Adapter unit tests with fixtures

**Integration points**
- Reuse OAuth token readers from `openai-codex-auth`, `gemini-antigravity-auth`, `xai-auth`
- Reuse Qwen plan presets
- Gemini model list exhausted flags from `gemini-antigravity-models.ts`

### Phase C — Generation hooks & error path
**Deliverables**
- Hook after usage write in generation pipeline
- Classify + mark exhausted on failure paths
- Clear exhausted on success
- Optional capture of rate-limit headers when stream completes (if SDK/response accessible)

**Files**
- `src/renderer/stores/session/generation.ts`
- `src/shared/models/errors.ts` + i18n scan keys
- `MessageErrTips.tsx` CTA to Usage

### Phase D — Full UI
**Deliverables**
- Settings Usage route + nav item
- Provider page Plan & usage section
- Statusline segment + popover
- Budget settings UI
- Empty, loading, error, offline states
- i18n strings (en minimum; follow project i18n patterns)

**Files**
- `src/renderer/routes/settings/usage.tsx`
- `src/renderer/routes/settings/route.tsx`
- `src/renderer/routes/settings/provider/$providerId.tsx`
- `src/renderer/components/usage/*`
- `src/renderer/components/chat/SessionStatusBar.tsx`
- CSS / design tokens as needed (no new visual language)

### Phase E — Polish, performance, docs, QA
**Deliverables**
- Rollup performance with large session sets (benchmark; index-only path)
- Debounce/coalesce refresh
- Accessibility: meters with aria-valuenow, keyboard popover
- Docs: `docs/` short user/dev note on honesty model + adapter extension
- Manual QA checklist for 4 subscription providers + 1 BYOK
- Feature flag cleanup / default on

---

## 10. Testing plan

| Layer | Coverage |
|---|---|
| Unit | Rollup aggregation, period windows, budget thresholds, error classifier, plan labels |
| Adapter | Mock fetch/catalog; exhausted partial; failure → error/unknown |
| Integration | Generation writes usage → rollup increments; error marks exhausted |
| UI | Usage hub renders known vs unknown; statusline popover; budget warn once |
| Regression | CE still strips Chatbox license; no license UI regression |

Commands:
```bash
pnpm test -- src/renderer/packages/usage-tracking
pnpm test -- src/shared/providers/usage
pnpm check
pnpm lint
```

---

## 11. Risks & mitigations

| Risk | Mitigation |
|---|---|
| No real remaining quota APIs | Full product still ships with local + plan + unknown + error-driven |
| Unofficial endpoints break | Feature-flag per adapter; degrade silently |
| Account risk (Google OAuth) | No aggressive polling; reuse existing risk copy |
| User confuses local vs provider | Dual sections, fixed copy patterns |
| Large history backfill jank | Background job + progress; never block chat |
| Cost estimate wrong | “Estimated” label; reuse existing pricing module |
| Scope creep into Chatbox license | Explicit non-goal; do not touch strip path |

---

## 12. Acceptance checklist (release gate)

1. Usage hub lists providers and period stats correctly after backfill.  
2. OpenAI Codex OAuth shows plan type; exhausted after simulated 429.  
3. Gemini Antigravity shows plan + exhausted models when catalog says so.  
4. Qwen shows plan preset identity + local usage + docs link.  
5. xAI OAuth shows subscription mode + local usage.  
6. BYOK provider shows local-only with `unsupported` subscription quota.  
7. Soft budget fires one warning at threshold.  
8. Statusline plan segment + popover works on desktop session (non-compact).  
9. No Chatbox AI license surface reintroduced.  
10. Tests green; typecheck/lint clean.

---

## 13. Timeline estimate (single engineer)

| Phase | Effort |
|---|---|
| A Foundation | 2–3 d |
| B Adapters + spikes | 3–4 d |
| C Generation/errors | 1–2 d |
| D Full UI | 3–4 d |
| E Polish/QA/docs | 2 d |
| **Total** | **~2–3 weeks** |

Parallelizable: B adapters after A types; D UI can start on mocks after A service interface frozen.

---

## 14. Decisions locked by this plan

| Decision | Choice |
|---|---|
| Scope | Provider plans (not Chaeboxi subscription) |
| v1 completeness | Full product (hub + cards + statusline + budgets + adapters + tests) |
| Meter honesty | No fake remaining % |
| Hard stop | Optional user toggle; default off |
| CE license | Untouched |
| Primary entry | Settings → Usage + provider cards + statusline |

---

## 15. Open items (resolve during Phase B spikes, not product blockers)

1. Codex: any safe remaining-quota signal beyond planType + errors?  
2. Qwen: official usage API for Coding/Token plan keys?  
3. Capture rate-limit headers through current AI SDK stream path without invasive rewrites?  
4. Exact dashboard URLs per plan/region for Qwen CN vs intl.

If spikes fail: adapters remain full-featured honest stubs — **still ship**.

---

## 16. Next step after approval

1. Create worktree/plan folder under `plans/` if project convention requires.  
2. Implement Phase A → E in order.  
3. Use cook workflow for implementation; keep adapter spikes evidence in claudedocs.  
4. Ship behind flag only during development; default ON for release.
