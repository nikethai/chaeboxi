---
phase: 5
title: "Verify and ship checklist"
status: in-progress
effort: "S"
priority: P1
dependencies: [4]
---

# Phase 5: Verify and ship checklist

## Overview

Prove the site on real Pages, prove the app links, and run the web-interface + design-contract checklist. No new features.

**Status (2026-08-15):** in-progress. Local verify done (unit tests + `astro build` + dist `/chaeboxi/` grep; see QA report). Live Pages 200s, human Pages source, Lighthouse/a11y matrix, and PRODUCT flip not done.

## Context Links

- Phase 01 contract
- https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md
- `docs/design-guidelines.md` anti-patterns
- `src/shared/product.ts`

## Requirements

- Functional: every route 200 on the live origin; About links resolve
- Non-functional: a11y/focus/motion/perf gates below; desktop + 390px

## Architecture

Verification only. If a check fails, fix in the owning phase files (02–04), do not add a new stack.

### Manual matrix

| Surface | Check |
|---|---|
| `/chaeboxi/` | Hero 2–3 lines, both CTAs work, no hero badges |
| `/chaeboxi/download/` | Four platforms; fallback if a URL 404s |
| `/chaeboxi/privacy/` `/terms/` | Readable, footer consistent |
| Refresh each URL | No 404 |
| 390 / 768 / 1280 | No horizontal scroll; overlap gone on mobile |
| `prefers-reduced-motion` | Marquee/pin/scale off |
| Keyboard | Skip link, tab through nav, visible focus |
| About in app | Homepage / Privacy / Terms open Pages |
| `pnpm test` / CI | Unchanged green (app tests) |

### Web Interface Guidelines (must pass)

- Icon-only controls have `aria-label`
- `<a>` vs `<button>` correct
- Images have `alt` + width/height
- Decorative icons `aria-hidden`
- `:focus-visible` not `outline: none` alone
- `prefers-reduced-motion`
- No `transition: all`
- No `user-scalable=no`
- `color-scheme: dark` + theme-color
- `…` not `...` in UI copy
- Headings hierarchical; skip link
- Fonts preconnect/preload + `font-display: swap`

### Design contract (must pass)

- Satoshi + JetBrains Mono; no Inter/Jakarta
- No purple gradient wash, no sparkles
- Double-bezel cards use 11/16 radius
- Tokens only (no stray hex in components)
- Honest desktop labels
- No fake testimonials
- AIDA present; section padding uses `--space-section`

### Perf (good enough)

- Lighthouse (mobile + desktop) on live or `astro preview`: Performance ≥ 90, A11y ≥ 95, no CLS from screenshot
- Hero image not lazy; others lazy
- JS payload tiny (no GSAP). Fail the review if a motion library landed

## Related Code Files

- Modify: only fixes discovered by this checklist
- Create: optional `website/README.md` (dev + deploy one-pager) if not already there

## Implementation Steps

1. `pnpm --dir website build && pnpm --dir website preview` — click every route.
2. Enable reduced-motion in OS and re-check.
3. Keyboard-only pass.
4. After deploy: curl live URLs (200). View-source asset paths include `/chaeboxi/`.
5. Open About in desktop or `dev:web` and click Homepage/Privacy/Terms.
6. Grep `website/src` for Inter, `transition: all`, Picsum, GSAP, `chatboxai.app`.
7. Write residual bugs back into phase 03/04; do not expand scope.

## Success Criteria

- [ ] All four live routes 200 with CSS
- [ ] Guidelines + design-contract lists above checked
- [ ] App About destinations are the site
- [x] Root CI still does not install Astro
- [x] No motion library in `website/package.json`
- [ ] Human confirmed Pages source = GitHub Actions

## Risk Assessment

| Risk | Mitigation |
|---|---|
| Preview ≠ Pages `base` | Always test built asset prefixes |
| About still cached old constants | Confirm shipped `product.ts` |
| Lighthouse blocked by Fontshare | preconnect; self-host later if it fails |

## Security Considerations

- Confirm no analytics snippets landed “for debugging”
- Confirm no GitHub token in client bundle
- OG image is a product screenshot, not a user chat
