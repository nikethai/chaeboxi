---
phase: 4
title: "Legal pages and product URLs"
status: completed
effort: "S"
priority: P1
dependencies: [3]
---

# Phase 4: Legal pages and product URLs

## Overview

Ship `/privacy` and `/terms`, then flip app + README URLs **only after** Pages is live. This is the independence-plan homepage follow-through.

**Status (2026-08-15):** completed. Legal pages + deploy-guide marketing section shipped. `PRODUCT.*` / `package.json` homepage / README flip is a follow-up after live Pages 200s (phase 05).

## Context Links

- `src/shared/product.ts`
- `src/renderer/routes/about.tsx`
- `src/shared/providers/definitions/models/openrouter.ts`
- `src/shared/models/utils/openai-headers.ts`
- `src/renderer/packages/remote.ts`
- `README.md` privacy/terms placeholders
- `package.json` `homepage`
- `plans/2026-08-10-chaeboxi-independence/plan.md` (domain wait — superseded for URL existence)

## Requirements

- Functional: real legal pages; About / OpenRouter referer / package homepage use the site
- Non-functional: no URL flip before live Pages; legal copy stays short and honest; GPLv3 + NOTICE remain

## Architecture

Live origin v1:

`https://nikethai.github.io/chaeboxi/`

| Constant | New value |
|---|---|
| `PRODUCT.homepage` | `https://nikethai.github.io/chaeboxi/` |
| `PRODUCT.privacyUrl` | `https://nikethai.github.io/chaeboxi/privacy/` |
| `PRODUCT.termsUrl` | `https://nikethai.github.io/chaeboxi/terms/` |
| `PRODUCT.openRouterReferer` | same as homepage |
| `package.json` `homepage` | same as homepage |

`releasesUrl` / `feedbackUrl` / `changelogUrl` stay on GitHub.

### Legal copy (required facts, not lawyer-cosplay)

**Privacy**

- Local-first: chats/settings on device (or storage the user chose)
- BYOK: keys used only to call configured providers
- No first-party hosted LLM; `CHATBOX_CLOUD_ENABLED` is false
- No first-party analytics/Sentry until Chaeboxi-owned accounts exist
- Third-party providers process prompts under **their** terms
- Site itself: no cookies/analytics in v1
- Contact: GitHub Issues

**Terms**

- Software under GNU GPLv3 (`LICENSE`)
- Independent product; derived from earlier GPLv3 client — see `NOTICE`
- No warranty; user responsible for provider API terms
- Not affiliated with Chatbox commercial cloud / license marketplaces

Same studio layout as marketing pages (BaseLayout). Prose measure ~40rem. No marketing CTAs above the fold on legal pages (footer Download is OK).

### Flip order (blocking) — Validation Session 1

Flip `PRODUCT.*` **only after the full site is live**, not after the phase-02 stub.

1. `/` `/download/` `/privacy/` `/terms/` all 200 on `https://nikethai.github.io/chaeboxi/`
2. Human opens all four in a browser
3. Then a **separate** PR: `product.ts` + `package.json` homepage + README + deployment-guide

Do not ship the constant PR on a red Pages deploy. Do not wait for a custom domain.

<!-- Updated: Validation Session 1 - flip after full site; short factual legal pages -->

## Related Code Files

- Create: `website/src/pages/privacy.astro`, `website/src/pages/terms.astro`
- Modify: `src/shared/product.ts`, `package.json` (`homepage` only)
- Modify: `README.md` (replace placeholder legal sections with site links)
- Modify: `docs/deployment-guide.md` — add “Marketing site = GitHub Pages (`website/`). Still do not publish `build:web`.”
- Modify: `plans/2026-08-10-chaeboxi-independence/plan.md` — one-line follow-up that Pages is the interim homepage
- Indirect (no code change): About, OpenRouter, openai-headers, `remote.ts` consume `PRODUCT`

## Implementation Steps

1. Write privacy + terms in English. Keep each under ~400 words.
2. Footer + nav (legal can omit Download in header; keep GitHub).
3. Deploy via Pages workflow. Verify `/privacy/` and `/terms/` refresh without 404 (trailingSlash always).
4. PR 2: `PRODUCT` + `package.json` + README + deployment-guide.
5. Grep `github.com/nikethai/chaeboxi#privacy` and `#terms` — should be gone from shipped sources.

## Success Criteria

- [x] `/privacy/` and `/terms/` render in BaseLayout
- [x] Copy states BYOK, on-device storage, no first-party LLM, provider terms, GPLv3
- [x] NOTICE / derivative origin mentioned on terms
- [ ] `PRODUCT.homepage` is the Pages URL after live verify — follow-up after live 200s
- [ ] OpenRouter referer is the Pages URL — follow-up after live 200s
- [ ] README placeholders removed — follow-up after live 200s
- [x] Deployment guide documents Pages vs `build:web`

## Risk Assessment

| Risk | Mitigation |
|---|---|
| Flip before live → 404 from the app | Two-step PRs; verify URLs first |
| Over-claiming compliance | Short factual pages; not a privacy policy mill |
| Trailing-slash 404 | `trailingSlash: 'always'` + links with slash |
| Independence plan “wait for domain” conflict | Document override: Pages now, domain later |

## Security Considerations

- Legal pages are public static HTML
- Do not collect email
- Do not add trackers “just for marketing”
- OpenRouter referer change is intentional (ranking). Homepage must stay 200.
