---
title: "Chaeboxi Marketing Site on GitHub Pages"
description: "Ship a 4-page static marketing site on GitHub Pages; do not publish the Vite web app."
status: in-progress
priority: P2
branch: "main"
tags: [feature, frontend, infra, docs]
blockedBy: []
blocks: []
created: "2026-08-15T07:40:33.812Z"
createdBy: "ck:plan"
source: skill
related:
  - plans/2026-08-10-chaeboxi-independence/plan.md
  - plans/2026-08-05-ui-ux-redesign/plan.md
  - docs/design-guidelines.md
  - src/shared/product.ts
---

# Chaeboxi Marketing Site on GitHub Pages

## Overview

Ship an isolated Astro site in `website/` to `https://nikethai.github.io/chaeboxi/`. Four pages only: landing, download, privacy, terms. After all four routes are live (not the phase-02 stub), flip `PRODUCT.*` off GitHub README anchors.

This completes the independence-plan homepage TODO. It does **not** wait for a custom domain. Domain is a later CNAME + `base: '/'` change.

**Hard no:** `pnpm build:web` on Pages. That is the chat app.

**Status (2026-08-15):** Phases 1–4 implementation complete. `website/` (4 pages) + `pages.yml` + legal + deploy-guide shipped. `PRODUCT.*` not flipped (gated on live 200s). Phase 5 in progress: local build/tests/dist grep done; live Pages + URL flip remain.

## Scope Challenge

- Existing: product identity in `src/shared/product.ts`, studio tokens in `docs/design-guidelines.md`, Releases as CDN, Fontshare Satoshi already in the app, no `website/` tree, no Pages workflow.
- Minimum: 4 static pages + Pages CI + legal + `PRODUCT` URL flip.
- Deferred: blog, CMS, waitlist, analytics, web-app host, i18n, custom domain.
- Complexity: new isolated package + 1 workflow + small app constant PR. 5 phases because design is a contract, not a vibe pass.
- Selected mode: **HOLD** (architecture already accepted; design skills raise quality, not feature count).

## Locked decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | Location | `website/` in this repo, **not** in pnpm workspace |
| 2 | Stack | Astro static. No Next, no renderer Vite, no Jekyll on `docs/` |
| 3 | URL v1 | Project Pages `https://nikethai.github.io/chaeboxi/` (`base: '/chaeboxi'`) |
| 4 | Pages | `/` `/download` `/privacy` `/terms` |
| 5 | Downloads | Link GitHub Releases. Bake latest asset URLs at **build time**. Never host binaries |
| 6 | Analytics | None in v1 (`TELEMETRY_ENABLED` stays false) |
| 7 | Motion | CSS + IntersectionObserver. **No GSAP, no anime.js** |
| 8 | Visual | Studio Editorial — Chaeboxi tokens + AIDA. See phase 01 |
| 9 | URL flip | Only after all four live routes 200 |
| 10 | Copy language | English. Honest desktop-only labels. No fake testimonials |

## Design sources (how they bind)

| Skill | Keep | Adapt / drop |
|---|---|---|
| gpt-taste | AIDA, 2–3 line H1, Satoshi, gapless bento, huge section padding | No GSAP runtime; no Picsum |
| high-end-visual-design | Double-bezel, island CTA, cubic-bezier, GPU-safe motion | No 2rem squircle; no white Soft Structuralism; no purple glass orbs |
| frontend-design | Distinctive, CSS-first, no Inter/AI-slop | No 3D, no stock atmosphere |
| design-system | Primitive → semantic → component tokens | No slide/Chart.js system |
| web-interface-guidelines | a11y, focus-visible, reduced-motion, semantic HTML | Applied in phase 05 |
| `docs/design-guidelines.md` | Void/indigo/Satoshi, no chrome gradients, no sparkles | Marketing may use **one** hero radial wash; not on chrome |

RNG seed = prompt length `164`. Picks + product overrides are in [phase 01](./phase-01-design-contract-and-tokens.md).

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Design contract and tokens](./phase-01-design-contract-and-tokens.md) | Completed |
| 2 | [Website scaffold and Pages CI](./phase-02-website-scaffold-and-pages-ci.md) | Completed |
| 3 | [Landing and download](./phase-03-landing-and-download.md) | Completed |
| 4 | [Legal pages and product URLs](./phase-04-legal-pages-and-product-urls.md) | Completed — PRODUCT flip follow-up after live 200s |
| 5 | [Verify and ship checklist](./phase-05-verify-and-ship-checklist.md) | In Progress — local verify done, live Pages not done |

## Review (2026-08-15)

**Score:** 8/10. **Verdict:** Request changes.

Report: [reports/2026-08-15-code-review-marketing-site.md](./reports/2026-08-15-code-review-marketing-site.md)

Architecture gates passed: isolated package, `/chaeboxi` + trailing slash, 4 pages, no `build:web`, no GSAP, bake+fallback releases, honest desktop labels, no fake quotes, legal short/factual, `pages.yml` path-filtered + `pages: write`. PRODUCT not flipped (correct).

Must-fix before ship (review-time):
1. Mobile menu overlay covers hamburger/X (`site.css` / `IslandNav.astro`)
2. Landing IO `<script>` emitted after `</html>`
3. `.bezel img` scale(0.92) stuck on non-reveal bento screenshot

**Post-review (2026-08-15):** those three look landed (toggle `z-index` above overlay; IO script inside `BaseLayout`; scale scoped to `.reveal` / `.hero__visual`). Residual review items (heading skip, marquee SR track, nav safe-area) are phase-05 polish, not reopen of 01–03.

## Next steps

1. Repo Settings → Pages → Source = GitHub Actions; dispatch `pages.yml`
2. Curl `/` `/download/` `/privacy/` `/terms/` → 200 with `/chaeboxi/` assets
3. Finish phase 05 checklist (a11y/motion/Lighthouse on live or `astro preview`)
4. Separate PR after live 200s: `PRODUCT.*` + `package.json` homepage + README placeholders

## Cross-plan

| Relationship | Plan | Note |
|---|---|---|
| Follows | `2026-08-10-chaeboxi-independence` | Supersedes “wait for domain” for public URL existence only |
| Reuses | `2026-08-05-ui-ux-redesign` | Token + type values; do not import renderer CSS |

## Success

- Visitor can install desktop without reading the README
- About → Homepage / Privacy / Terms open the site
- CSS/images work under `/chaeboxi/`
- App CI and desktop release pipelines unchanged
- Site does not look like generic AI SaaS

## Out of scope

Blog, changelog UI, Discord, waitlist, pricing, hosted web demo, Plausible, custom domain, i18n, importing `src/renderer`.

## Validation Log

### Verification Results
- **Tier:** Full (5 phases, 4 roles)
- **Claims checked:** 38
- **Verified:** 34 | **Failed:** 0 | **Unverified:** 4
- **Date:** 2026-08-15

#### Fact Checker
- `src/shared/product.ts` homepage / privacyUrl / termsUrl / openRouterReferer — VERIFIED (`src/shared/product.ts:11-19`)
- `PRODUCT.githubRepo` — VERIFIED (`src/shared/product.ts:10`)
- About consumes PRODUCT — VERIFIED (`src/renderer/routes/about.tsx:56-76`)
- OpenRouter + openai-headers referer — VERIFIED (`openrouter.ts:43`, `openai-headers.ts:27`)
- `remote.ts` returns `PRODUCT.homepage` when cloud off — VERIFIED (`src/renderer/packages/remote.ts:130`)
- `package.json` homepage GitHub — VERIFIED (`package.json:59`)
- Design tokens void/indigo — VERIFIED (`docs/design-guidelines.md:18-20`)
- Satoshi via Fontshare — VERIFIED (`src/renderer/index.html:16`)
- `pnpm-workspace.yaml` is `.` + `release/app` — VERIFIED
- No `website/` — VERIFIED (absent)
- No Pages workflow — VERIFIED (only ci/mobile/release)
- `.node-version` `v22.12.0` — VERIFIED
- Deployment guide out-of-scope web host + `xattr -cr` — VERIFIED (`docs/deployment-guide.md:109,133`)
- README legal still placeholder — VERIFIED (`README.md:53`)

#### Flow Tracer
- About Privacy/Terms: `<Anchor href={PRODUCT.privacyUrl|termsUrl}>` — VERIFIED
- About Homepage: `ListItem link={PRODUCT.homepage}` — VERIFIED
- Check Update: `platform.openLink(PRODUCT.releasesUrl)` — stays GitHub — VERIFIED
- OpenRouter `HTTP-Referer` + `X-Title` from PRODUCT — VERIFIED
- `getChatboxOrigin`-style helper: cloud off → homepage; cloud on → `chatboxai.app` (`remote.ts:127-130`) — VERIFIED. Flipping homepage does not re-enable Chatbox cloud.

#### Scope Auditor
- `PRODUCT` is a module const (process-global). URL flip is the intended single source — VERIFIED
- Site must not join root workspace or it leaks Astro into desktop CI — claim matches `pnpm-workspace.yaml` — VERIFIED
- No existing `website/` state to collide — VERIFIED

#### Contract Verifier (PRODUCT URL consumers)
Shipped callers of homepage/privacy/terms/referer:
1. `src/renderer/routes/about.tsx:56,59,76`
2. `src/shared/providers/definitions/models/openrouter.ts:43`
3. `src/shared/models/utils/openai-headers.ts:27`
4. `src/renderer/packages/remote.ts:130`
5. `package.json:59` (`homepage`)
Plan listed these. FAQ still points at `PRODUCT.githubRepo` (out of scope). No test snapshots of these URLs found.

#### Unverified
1. Exact Tauri asset names were assumed; live `v1.7.0` assets are now known: `Chaeboxi_1.7.0_aarch64.dmg`, `_x64.dmg`, `_x64-setup.exe`, `_amd64.AppImage`, `_amd64.deb`. Suffix map should use these patterns.
2. README heading ids are `#privacy-placeholder` / `#terms-placeholder`, not `#privacy` / `#terms`. PRODUCT anchors already miss the README. Flip to Pages fixes this.
3. GitHub Pages source (Actions vs branch) is a repo setting — cannot verify from git.
4. `withastro/action@v6` + `deploy-pages@v5` accepted from Astro docs (2026-08-15), not exercised in this repo.

#### Failures
None.

### Session 1 — 2026-08-15
**Trigger:** `/ck:plan validate` after plan write
**Questions asked:** 4

#### Questions & Answers

1. **[Assumptions]** Phase 04 flips PRODUCT.homepage / privacy / terms / OpenRouter referer to GitHub Pages. When should the app start using those URLs?
   - Options: After the full site is live (Recommended) | After the phase-02 stub is live | Keep app on GitHub until a custom domain
   - **Answer:** After the full site is live (Recommended)
   - **Rationale:** Avoids About opening a CI stub. PRODUCT PR is last.

2. **[Tradeoffs]** v1.7.0 assets are `Chaeboxi_*_aarch64.dmg`, `_x64.dmg`, `_x64-setup.exe`, `_amd64.AppImage`, `_amd64.deb`. How should /download work?
   - Options: Bake per-platform URLs at build time (Recommended) | One Latest Release button only | Hardcode v1.7.0 asset URLs
   - **Answer:** Bake per-platform URLs at build time (Recommended)
   - **Rationale:** Use the known suffix map; API fail → `/releases/latest`.

3. **[Scope]** Phase 04 legal pages: how finished should Privacy and Terms be?
   - Options: Short factual pages from the plan (Recommended) | Even shorter stub + LICENSE/NOTICE | Block on a lawyer draft
   - **Answer:** Short factual pages from the plan (Recommended)
   - **Rationale:** Enough to replace README placeholders. Not a law-firm policy.

4. **[Architecture]** How should the first implementation PR be sliced?
   - Options: Follow the 5 phases in order (Recommended) | One PR for the whole site | Scaffold + CI only first
   - **Answer:** Follow the 5 phases in order (Recommended)
   - **Rationale:** Reviewable; Pages stub proven before visual work; URL flip last.

#### Confirmed Decisions
- URL flip: after full 4-page site is live — keep
- Download: build-time suffix map from live v1.7.0 names — keep, now concrete
- Legal: short factual English pages — keep
- Execution: five sequential phases / PRs — keep

#### Action Items
- [x] Write v1.7.0 suffix map into phase 03
- [x] Re-state “no PRODUCT flip until all four routes 200” in phase 04
- [x] Note sequential PRs in phase 02

#### Impact on Phases
- Phase 02: one PR = scaffold + CI only
- Phase 03: concrete asset suffixes
- Phase 04: flip gated on live `/` `/download/` `/privacy/` `/terms/`

### Whole-Plan Consistency Sweep
- Files reread: `plan.md`, `phase-01-design-contract-and-tokens.md`, `phase-02-website-scaffold-and-pages-ci.md`, `phase-03-landing-and-download.md`, `phase-04-legal-pages-and-product-urls.md`, `phase-05-verify-and-ship-checklist.md`
- Decision deltas checked: 4 (URL flip timing, download bake, legal depth, sequential PRs)
- Reconciled stale references: 2 (`plan.md` overview + locked decision 9 still said “after stub”; now “after all four routes 200”)
- Unresolved contradictions: 0

### Session 2 — 2026-08-15 code review
**Trigger:** marketing-site implementation review (website/ + pages.yml + deploy-guide only)
**Result:** 8/10, Request changes. Report: `reports/2026-08-15-code-review-marketing-site.md`
**PRODUCT flip:** still correctly gated

### Session 3 — 2026-08-15 implementation status
**Trigger:** PM status update after site implementation
**Shipped:** `website/` 4 pages, `.github/workflows/pages.yml`, `docs/deployment-guide.md` marketing section, legal pages
**Not shipped:** `PRODUCT.*` / `package.json` homepage / README placeholder flip (gated on live Pages 200s)
**Local verify:** QA report `reports/2026-08-15-qa-marketing-site-tests.md` — 3/3 unit tests, `astro build` 4 pages, `/chaeboxi/` asset prefix
**Phase status:** 01–04 completed; 05 in-progress
**ck plan check:** CLI not available in this session; statuses hand-updated to the CLI contract (`completed` / `in-progress`)
