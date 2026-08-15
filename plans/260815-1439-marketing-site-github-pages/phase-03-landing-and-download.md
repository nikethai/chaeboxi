---
phase: 3
title: "Landing and download"
status: completed
effort: "L"
priority: P1
dependencies: [2]
---

# Phase 3: Landing and download

## Overview

Build `/` and `/download` against the phase 01 contract. Real screenshot. Real release assets. No stock photos. No fake quotes.

**Status (2026-08-15):** completed. Landing + download shipped; review must-fixes (nav z-index, IO script in layout, bezel scale scope) landed. Viewport scroll check remains in phase 05.

## Context Links

- Phase 01 contract
- README feature list + “What Chaeboxi is not”
- `docs/deployment-guide.md` artifact table + unsigned macOS `xattr -cr` note
- Existing screenshot: README GitHub user-attachment (re-export into `website/public/`)

## Requirements

- Functional: landing AIDA; download lists macOS arm64, macOS Intel, Windows, Linux with baked or fallback URLs
- Non-functional: LCP screenshot has width/height + `fetchpriority="high"`; below-fold lazy; `prefers-reduced-motion` honored; no horizontal scrollbar

## Architecture

### Pages

| Route | File |
|---|---|
| `/` | `website/src/pages/index.astro` |
| `/download` | `website/src/pages/download.astro` |

Shared: `BaseLayout.astro` (skip link, nav, footer, meta, `color-scheme`, theme-color, OG tags), `IslandNav.astro`, `SiteFooter.astro`.

### Release data (build time)

`website/src/lib/latest-release.ts`:

1. `fetch('https://api.github.com/repos/nikethai/chaeboxi/releases/latest')` during `astro build` (Node).
2. Map assets by **suffix** (verified on `v1.7.0`; version prefix changes):

   | Platform | Match |
   |---|---|
   | macOS Apple Silicon | `_aarch64.dmg` |
   | macOS Intel | `_x64.dmg` (not `aarch64`) |
   | Windows | `_x64-setup.exe` |
   | Linux AppImage | `_amd64.AppImage` |
   | Linux deb | `_amd64.deb` |

3. On failure or missing asset: CTA href = `https://github.com/nikethai/chaeboxi/releases/latest`.
4. Persist nothing to git. Optional `PUBLIC_RELEASE_TAG` env for reproducibility.

<!-- Updated: Validation Session 1 - bake per-platform URLs; suffixes from live v1.7.0 -->

Do not call the API in the browser.

### Landing sections (in order)

1. Island nav
2. Editorial-split hero (locked copy in phase 01). Two CTAs only.
3. Provider marquee — **real** names from PDR inventory. CSS animation, paused on hover/focus, off under reduced-motion. `aria-hidden` on the duplicate track.
4. Gapless 4-cell bento (Local-first, BYOK, 16+ providers, Agents/MCP **desktop**). `grid-template-columns: repeat(12, 1fr); grid-auto-flow: dense`. Example spans: 7×2, 5×1, 5×1, 12×1 **or** 8×2 + 4×1 + 4×1 — verify zero empty cells at md+.
5. Desire: sticky “On your machine” title + Z-axis screenshot stack (1–2 real frames). Desktop-only capabilities called out in body, not as universal checkmarks.
6. What it is not — three short lines from README. This is the principles carousel substitute (static is fine; no autoplay).
7. Download band → `/download`
8. Footer

### Download page

- H1: `Download Chaeboxi`
- Four platform rows, always all visible (do not hide via UA). Optional quiet “likely your OS” hint via small client script is OK; never the only path.
- Each row: platform name, package type, button `Download {platform}` linking baked asset or latest-release fallback.
- Callout: unsigned Apple Silicon may show “app is damaged” → `xattr -cr /Applications/Chaeboxi.app` (from deployment-guide).
- Link to Releases notes. No auto-updater promise.

### Layout / a11y (must)

- `<a>` for navigation, `<button>` only for non-nav
- Visible `:focus-visible` ring (brand, 2px)
- Skip link to `#main`
- Images: explicit `width` `height` `alt`
- `touch-action: manipulation`
- `env(safe-area-inset-*)` on nav/footer
- `overflow-x: hidden` on `<main>`
- Headings sequential; one `h1` per page
- `text-wrap: balance` on headings
- Title Case on buttons: `Download macOS (Apple Silicon)` not `Download`

### Motion

- Hero/screenshot: IO fade-up 700ms `--ease-out`
- Desire images: scale 0.92→1, leave opacity 0.35
- Sticky pin desktop only (`min-width: 768px`)
- Reduced motion: static
- Hover on cards: `scale(1.02)` inside `overflow-hidden`, 700ms. Not 1.05 (too toy)

## Related Code Files

- Create: layout/nav/footer/bento/marquee/download-row components under `website/src/components/`
- Create: `website/src/lib/latest-release.ts`
- Create: `website/public/og.png`, `website/public/screenshot-shell.png` (export from current app; do not hotlink user-attachments long-term)
- Modify: `website/src/pages/index.astro`
- Delete: stub-only copy

## Implementation Steps

1. `BaseLayout` + island nav + footer. Mobile overlay menu with hamburger→X.
2. Export one current dark-shell screenshot (empty or thread). Compress. Set dimensions.
3. Implement hero math: left type, right overlapping screenshot, H1 2 lines at desktop 1280 and 768.
4. Provider marquee from a typed `providers.ts` list (names only).
5. Bento: draw the 12-col spans on paper first; then CSS. Mobile: `grid-cols-1`.
6. Desire sticky + screenshot stack.
7. “What it is not” from README.
8. Download page + build-time release mapper + fallback.
9. OG/Twitter meta on layout (`og:title` Chaeboxi, `og:image` absolute via `site`+`base`).

## Success Criteria

- [x] H1 is 2–3 lines at 1280 and 768
- [x] Bento has no empty cell at md+
- [x] No meta-labels, no hero badges, no fake quotes
- [x] Desktop-only features are labeled desktop
- [x] Download works if GitHub API fails (fallback URL)
- [x] All four platforms listed
- [x] Unsigned macOS note present
- [x] Reduced-motion: no marquee/pin/scale
- [ ] No horizontal scrollbar at 390 / 768 / 1280 — phase 05 live/preview matrix

## Risk Assessment

| Risk | Mitigation |
|---|---|
| API rate limit / fail in CI | Fallback to `/releases/latest` |
| Asset name pattern drift | Suffix map + fallback; do not regex-guess silently |
| Hero wraps to 5 lines on iPhone | Smaller clamp; allow 3 lines on &lt;400px only |
| Overlap breaks tap targets | Remove overlap &lt;768px |
| Screenshot is stale | Use a current build; recapture if UI drifted |

## Security Considerations

- Unauthenticated GitHub API in CI only
- External links `rel="noopener"`
- No user input, no forms in v1
- Do not embed tokens
