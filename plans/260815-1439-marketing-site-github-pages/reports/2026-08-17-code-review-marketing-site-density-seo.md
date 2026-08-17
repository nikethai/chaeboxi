# Code Review: Marketing Site Density + SEO/GEO

**Date:** 2026-08-17
**Plan:** `plans/260815-1439-marketing-site-github-pages/`
**Scope:** `website/` + `docs/deployment-guide.md` marketing note + `website/DESIGN.md` + `website/README.md`
**Out of scope:** implement fixes; renderer; `pages.yml` logic rewrite

**Score:** 7.5/10
**Verdict:** Request changes
**Status:** DONE_WITH_CONCERNS

---

## Code Review Summary

### Scope
- Files reviewed: `website/src/pages/index.astro`, `website/src/layouts/BaseLayout.astro`, `website/src/styles/{tokens,site}.css`, `website/src/lib/{site,faq,compare,json-ld,site.test}.ts`, `website/src/components/{CapabilityStrip,CompareTable,FaqList,SiteFooter}.astro`, `website/public/{robots.txt,sitemap.xml,llms.txt}`, `website/{DESIGN.md,README.md}`, `docs/deployment-guide.md` (marketing), plus supporting `download.astro`, `IslandNav.astro`, `ProviderMarquee.astro`, `astro.config.mjs`, local `website/dist/**`, live Pages vs GitHub `main`
- Lines of code analyzed: ~1,400 (website src + crawl files + docs)
- Review focus: density contract + SEO/GEO pass (origin/base, schema vs visible text, a11y, CSS, compare honesty, modularity)
- Updated plans: `plans/260815-1439-marketing-site-github-pages/plan.md`

### Overall Assessment
Local `website/` matches the locked density/SEO contract: `--space-section` is the main gap, Desire is gone, each screenshot used once, hero is a product frame (no H1 chip), How-it-runs + compare + visible FAQ exist, crawl files use `/chaeboxi/` prefix, JSON-LD graph is wired, OG/Twitter tags are present, canonicals in `dist/` are `https://nikethai.github.io/chaeboxi/…`. FAQ schema matches visible `FAQS`. Compare does **not** invent Chatbox MCP/computer-use/keychain features.

Not ready to call SEO shipped: `og.png` is a byte-identical favicon (bad `summary_large_image`), two compare/copy cells can be misread as competitor facts, and **live Pages / GitHub `main` still serve the pre-pass site** (H1 chip, Desire, thread screenshot twice, no `robots.txt`/`sitemap.xml`/`llms.txt`).

### Critical Issues
None in local source. No wrong origin/base in built HTML. No FAQ schema drift. No invented Chatbox feature list.

### High Priority Findings

1. **`og.png` is the favicon, not a card** — `website/public/og.png` and `website/public/favicon.png` share git SHA `d4da842b…` / 164560 bytes. `BaseLayout.astro:15,50,55` emits `twitter:card=summary_large_image` + that square app icon. Phase 05 said OG should be a product screenshot. Social/Slack/X previews will letterbox or crop the cube. Fix: 1200×630 (or similar) frame from `screenshot-shell.png` + wordmark; add `og:image:width/height/alt`.

2. **Pass not on live `main` / Pages** — `https://nikethai.github.io/chaeboxi/` still has H1 inline chip + Desire + reused thread shot; `robots.txt`, `sitemap.xml`, `llms.txt` 404. GitHub `main` `website/src/pages/index.astro` is the old file. `PRODUCT.homepage` already points at this origin (`src/shared/product.ts:11-18`). SEO files do not exist for crawlers until merge+deploy.

### Medium Priority Improvements

3. **`applicationCategory: 'DesktopApplication'`** — `website/src/lib/json-ld.ts:36`. That string is a schema.org **type**, not a Google category (`DeveloperApplication` / `UtilitiesApplication`). Rich Results Test will warn. Optional: `@type: ['SoftwareApplication','DesktopApplication']`. Do **not** add fake `aggregateRating` (Google requires rating/review for software rich results; inventing stars would be dishonest).

4. **Compare “API keys → Not this project”** — `website/src/lib/compare.ts:13-16`. Table cells read as facts. Juxtaposed with Chaeboxi “BYOK” this implies Chatbox AI has no API keys. Chatbox AI commercial *does* support custom keys. Hedge belongs in a footnote, not the cell. Safer: “Not claimed here” / omit the row.

5. **“the rest you already pay for”** — `website/src/components/CapabilityStrip.astro:7`. Same sentence lists Ollama (local/free). Contradicts FAQ (`faq.ts:15`: Ollama / LM Studio). Rewrite to “or a local runtime”.

6. **Empty compare header** — `website/src/components/CompareTable.astro:15` `<th scope="col"> </th>`. SR announces a blank column. Use `sr-only` “Criterion”.

7. **Mobile menu still no focus trap / scroll lock** — `IslandNav.astro:22-41`. Overlay z-index + Escape landed; background still tabbable. Residual from 2026-08-15.

8. **`site.css` 694 lines** — over the 200-line modularize rule. Split nav/hero/bento/compare-faq if it grows again. Components themselves are small (good).

9. **MCP row “Not this product” for Hosted ChatGPT** — `compare.ts:20-22`. ChatGPT now has agent/computer-use surfaces. Same hedge-as-absence risk. Keep Chaeboxi “Yes, on desktop”; ChatGPT/Chatbox cells should stay non-claims.

### Low Priority Suggestions

10. **Project-path `robots.txt`** — `website/public/robots.txt:16`. Google fetches `https://nikethai.github.io/robots.txt`, not `/chaeboxi/robots.txt`. README already says this; Search Console URL-prefix is the real discovery path. Fine as documented.

11. **Missing `og:image:alt` / dimensions** — `BaseLayout.astro:45-55`.

12. **How-it-runs echoes bento** — same “Your keys” / local / desktop triad twice. Allowed by `DESIGN.md` AIDA; leftover density.

13. **Organization has no `sameAs` GitHub** — `json-ld.ts:8-16`. Cheap GEO.

14. **SoftwareApplication has no `image`/`screenshot`** — `json-ld.ts:30-49`. Point at `screenshot-shell.png`.

15. **`screenshot-thread.png` 531709 bytes** — lazy, but still heavy. Hero shell is 79KB (good LCP).

16. **Sitemap has no `lastmod`** — `website/public/sitemap.xml`. `changefreq` ignored by Google.

17. **Tests don’t lock crawl-file contents** — `site.test.ts` covers URLs/FAQ/compare/JSON-LD only.

18. **`--ink-3` on small `.meta`** — `tokens.css:9` + `site.css:420-426`. ~3.7:1 on `#121214`; AA small-text is 4.5:1.

19. **Phase 03 still lists Desire** — `phase-03-landing-and-download.md:64-70`. `DESIGN.md` superseded it.

### Positive Observations
- `astro.config.mjs`: `site` + `base: '/chaeboxi'` + `trailingSlash: 'always'`. Built canonicals/assets correct (`dist/index.html` → `https://nikethai.github.io/chaeboxi/`).
- `pageUrl` / `assetUrl` tests match the project origin; no custom-domain drift.
- Desire CSS/markup gone locally. `screenshot-shell` hero once, `screenshot-thread` bento once.
- Hero is `.product-frame`, no H1 chip, no double bezel.
- `--space-section: clamp(2.75rem, 5vw, 4.5rem)` is `main` gap, not stacked section padding.
- FAQ visible `<dl>` and `faqPageNode()` share `FAQS` (test asserts length + first Q/A).
- Compare test blocks Chatbox cells from `/MCP|computer use|keychain/i`.
- JSON-LD: Organization + WebSite sitewide; SoftwareApplication + FAQPage on home; SoftwareApplication on download. `@id`s stable.
- `llms.txt` facts match FAQ/desktop-only/BYOK. Provider list matches `providers.ts`.
- Prior must-fixes still hold: nav toggle `z-index:50` > overlay `45`; IO script inside `<main>`; scale only on `.reveal .product-frame img`; heading skip fixed (`What you get` h2); marquee `sr-only` list + `aria-hidden` track; nav `safe-area-inset-top`.
- Honest desktop-only labels in bento, strip, FAQ, llms.txt.
- README + deploy-guide name origin, crawl prefix, Search Console URL-prefix, no `build:web`.

### Recommended Actions
1. Replace `og.png` with a real 1200×630 card; add alt/width/height.
2. Rewrite CapabilityStrip pay-for line; soften Chatbox/ChatGPT compare cells so they cannot be read as feature claims.
3. Label the compare stub header; optional: `applicationCategory` + `sameAs` + app `image`.
4. Merge/deploy so live `/chaeboxi/robots.txt|sitemap.xml|llms.txt` 200 and home loses Desire/chip.
5. Then finish phase 05 (Lighthouse / 390-768-1280 / keyboard). Do not invent ratings.

### Metrics
- Type coverage: website TS small + Astro strict; not measured
- Test coverage: `site.test.ts` 3 describes (URLs, FAQ/compare honesty, JSON-LD). `latest-release.test.ts` unchanged. Tests **not re-run** this session (no shell)
- Linting: website not on Biome
- Live vs local: local `dist` has the pass; live Pages does not
- File sizes: `site.css` 694 loc; `index.astro` 127; components <35 loc; `og.png`/`favicon.png` 164560 B identical; shell 79KB; thread 532KB

### Plan checklist (this pass)

| Gate | Result |
|---|---|
| Stay on `nikethai.github.io/chaeboxi/` (`base /chaeboxi`) | Pass (local). Live still old HTML |
| `--space-section` as main gap, not stacked pad | Pass |
| Desire deleted; screenshots unique | Pass (local). Fail (live) |
| Hero product frame, no H1 chip | Pass (local). Fail (live) |
| How-it-runs + compare + visible FAQ | Pass (local) |
| robots / sitemap / llms under prefix | Pass (local files). Fail (live 404) |
| JSON-LD org+site; app+FAQ home; app download | Pass |
| OG/Twitter complete | Partial (`og.png` is favicon) |
| Compare does not invent Chatbox features | Pass (no MCP/CU claims). Hedge cells still risky |
| FAQ schema == visible text | Pass |

### Unresolved questions
- Is the density/SEO pass waiting on merge, or should Pages have been dispatched already?
- Accept `summary_large_image` with a cube icon, or block on a real OG card?
- Keep Chatbox/ChatGPT columns as “not claimed here”, or drop competitor columns to independence + license only?

---

## Findings (file:line)

| Sev | File:line | Evidence |
|---|---|---|
| High | `website/public/og.png` + `BaseLayout.astro:50,55` | Same SHA as `favicon.png`; `summary_large_image` |
| High | live `/chaeboxi/` vs local `index.astro` | Live still Desire + H1 chip; crawl files 404 |
| Med | `json-ld.ts:36` | `applicationCategory: 'DesktopApplication'` |
| Med | `compare.ts:15` | Chatbox API keys = “Not this project” |
| Med | `CapabilityStrip.astro:7` | “already pay for” after Ollama |
| Med | `CompareTable.astro:15` | Empty `th scope="col"` |
| Med | `IslandNav.astro:22-41` | No focus trap |
| Med | `site.css:1-694` | Over 200-line split rule |
| Med | `compare.ts:22` | ChatGPT “Not this product” on computer-use row |
| Low | `public/robots.txt:16` | Project-path robots; Google uses origin root |
| Low | `BaseLayout.astro:45-55` | No `og:image:alt` / w / h |
| Low | `json-ld.ts:8-16,30-49` | No `sameAs`; no app `image` |
