# Code Review: Marketing Site (website/)

**Date:** 2026-08-15
**Plan:** `plans/260815-1439-marketing-site-github-pages/`
**Scope:** `website/`, `.github/workflows/pages.yml`, `docs/deployment-guide.md` (marketing section only)
**Out of scope:** renderer/Gemini dirty files; `PRODUCT.*` URL flip (gated until live Pages 200s)

**Score:** 8/10
**Verdict:** Request changes

---

## Code Review Summary

### Scope
- Files reviewed: `website/src/**`, `website/{package.json,astro.config.mjs,DESIGN.md,README.md,.npmrc,.gitignore,tsconfig.json,postcss.config.mjs}`, `website/src/lib/latest-release.{ts,test.ts}`, `website/dist/**` (built HTML), `.github/workflows/pages.yml`, `docs/deployment-guide.md` (marketing section), `pnpm-workspace.yaml`, `src/shared/product.ts` (confirm not flipped)
- Lines of code analyzed: ~1,300
- Review focus: plan lock decisions + a11y/CI/isolation
- Updated plans: `plans/260815-1439-marketing-site-github-pages/plan.md`

### Overall Assessment
Isolated Astro site matches the architecture contract: own lockfile, `.npmrc ignore-workspace=true`, `base: '/chaeboxi'` + `trailingSlash: 'always'`, 4 routes, build-time GitHub release map with fallback, honest desktop labels, no GSAP/anime/fake quotes, no `build:web`. Copy and legal pages are short and factual. Two mobile/HTML defects must land before ship.

### Critical Issues
1. **Mobile nav overlay covers the hamburger/X** (`website/src/styles/site.css`, `IslandNav.astro`). On `max-width: 767px`, `.island-nav__links` is `position: fixed; inset: 0` with no z-index; `.nav-toggle` is `position: relative` and earlier in the tree. Open menu paints over the X. Cannot close without following a link. No Escape either. Fix: `z-index` on toggle above overlay (keep island bar visible); handle Escape; optional `inert` on `#main`.
2. **Landing module script emitted after `</html>`** (`website/src/pages/index.astro` script is a sibling after `</BaseLayout>`). `website/dist/index.html` ends `</body></html> <script type="module">…IntersectionObserver…`. Invalid HTML. Move the script inside the layout (or a component that renders in `<body>`).
3. **Non-reveal bezel images stay at `scale(0.92)`** (`site.css` `.bezel img`). Bento thread screenshot is not `.reveal` / `.hero__visual`, so it never gets `.is-in`. Restrict the scale rule to `.reveal img` / `.hero__visual img`.

### High Priority Findings
- Bento section headings are `h3` with no `h2` (h1 → h3 skip). Use `h2` or wrap with a visually-hidden `h2`.
- Mobile menu: no focus trap, no body scroll lock, overlay not `inert` on background.
- Marquee: entire track is `aria-hidden` (plan: hide duplicate track only). Parent `aria-label` is the only SR text.

### Medium Priority Improvements
- Nav missing `env(safe-area-inset-top)` (footer has bottom inset).
- Desire “leave opacity 0.35” not implemented; card hover `scale(1.02)` missing. Acceptable if scoped down, but not the phase-03 motion spec.
- Legal pages still show Download in island nav (plan: optional omit). Fine.
- `postcss.config.mjs` empty, unused. Drop it.
- Footer “See NOTICE” is unlinked text.
- Terms do not name Chatbox commercial cloud (landing does). Low legal-copy gap.
- `pages.yml` does not run `pnpm test` before deploy. Optional.

### Low Priority Suggestions
- No `twitter:image` (og:image is set).
- JetBrains Mono is stylesheet-only (Satoshi has preload).
- Provider marquee is 16 names; PDR also lists VolcEngine/ChatGLM/OpenClaw/ComfyUI.
- `site.css` ~584 lines; split if it keeps growing.
- Phase-05 live Lighthouse / 390-768-1280 scroll not run in this review.

### Positive Observations
- Isolation is correct: not in `pnpm-workspace.yaml`; `.npmrc ignore-workspace=true`; workflow `build-cmd: pnpm --ignore-workspace build`. Root CI will not install Astro.
- Astro config matches the lock: `site` + `base: '/chaeboxi'` + `trailingSlash: 'always'`. Built hrefs/src use `/chaeboxi/`.
- Release mapper uses live v1.7.0 suffixes; intel excludes aarch64; empty API → `/releases/latest`. Tests cover that.
- Download page lists all platforms, Title Case buttons, unsigned macOS `xattr -cr` note.
- Desktop-only agents/MCP/computer-use labeled. No fake testimonials. No Inter/GSAP/picsum/`transition: all`/`user-scalable=no`.
- A11y baseline: skip link, `:focus-visible` ring, reduced-motion kills marquee/pin/scale, images have width/height/alt, `<a>` vs `<button>` correct.
- Privacy/terms short, factual (local-first, BYOK, no first-party LLM, no site cookies, GPLv3, NOTICE, provider terms, Issues).
- `pages.yml`: path filter, `contents: read` + `pages: write` + `id-token: write`, `withastro/action@v6`, `deploy-pages@v5`.
- Deployment guide: marketing site vs `build:web` is explicit. `PRODUCT` flip correctly not done.

### Recommended Actions
1. Raise `.nav-toggle` above the overlay; add Escape to close.
2. Move landing `<script>` inside `<body>` (component or layout slot).
3. Scope image scale to reveal/hero only.
4. Fix bento heading level.
5. Marquee: visible first track, `aria-hidden` on duplicate only.
6. Then phase 05: deploy, curl four live 200s, then PRODUCT PR.

### Metrics
- Type Coverage: website TS is small + `astro/tsconfigs/strict`; not measured
- Test Coverage: 3 unit tests for suffix map + fallback (prior QA). No page/render coverage
- Linting Issues: website not on Biome. No website lint job
- Fresh test/build: not re-run this session (no shell). Prior QA 2026-08-15: `node --test` 3/3; `astro build` 4 pages. Dist matches source

### Plan checklist

| Gate | Result |
|---|---|
| Isolated package (not in pnpm-workspace) | Pass |
| `base /chaeboxi`, `trailingSlash: always` | Pass |
| 4 pages `/` `/download` `/privacy` `/terms` | Pass |
| No `pnpm build:web` as the site | Pass |
| No GSAP/anime.js | Pass |
| Build-time GitHub release map + fallback | Pass |
| Honest desktop-only labels | Pass |
| No fake testimonials | Pass |
| skip link, focus-visible, reduced-motion, alt, a vs button | Pass (menu close / heading skip / marquee SR gaps) |
| Legal pages short and factual | Pass |
| `pages.yml` path-filtered + pages write | Pass |
| PRODUCT URL flip | Correctly not done |

### Unresolved questions
- Has repo Settings → Pages → Source been set to GitHub Actions?
- Have the four live routes 200d yet? (blocks PRODUCT flip)
