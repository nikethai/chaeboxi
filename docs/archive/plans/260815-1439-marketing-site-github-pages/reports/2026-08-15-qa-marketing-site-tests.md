# QA Report: Marketing Site (website/)

**Date:** 2026-08-15
**Workspace:** `/Users/huynguyen/Personal/chaeboxi`
**Scope:** `website/` only. No `src/renderer` or desktop app edits. No commit.

---

## Test Results Overview

| Suite | Command | Tests | Result | Exit |
|-------|---------|------:|--------|-----:|
| **Website unit** | `cd website && pnpm --ignore-workspace test` | **3 / 3 pass** | **PASS** | **0** |
| **Astro build** | `cd website && pnpm --ignore-workspace build` | 4 pages | **PASS** | **0** |

### Website test breakdown (`src/lib/latest-release.test.ts`)

| Suite | Test | Status | Duration |
|-------|------|--------|----------|
| `matchAsset` | does not treat aarch64 dmg as intel | PASS | 0.39ms |
| `mapReleaseAssets` | maps the v1.7.0 suffix set | PASS | 0.21ms |
| `mapReleaseAssets` | falls back when the API returns nothing | PASS | 0.07ms |
| **Total** | **3** | **PASS** | **90ms** |

Exact TAP footer:

```
# tests 3
# suites 2
# pass 3
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 90.450208
```

No failures. No skips. No flakes observed (single deterministic `node:test` run).

---

## Coverage Metrics

Not generated. Website uses `node --test`, no `test:coverage` script.

Covered logic: `matchAsset` aarch64 vs intel, v1.7.0 suffix map, empty-API fallback to `FALLBACK_RELEASE_URL`.
Uncovered: live GitHub Releases fetch, Astro page render (covered by build + HTML grep, not unit tests).

---

## Failed Tests

None.

---

## Performance Metrics

| Step | Time |
|------|------|
| Website unit tests | 90ms |
| Astro build | 918ms (4 pages) |
| Vite static entrypoints | 394ms |
| Client bundle | 2 modules, 8ms |
| Route gen | download 426ms, index/privacy/terms 1–2ms |

No slow tests. No coverage of memory / Lighthouse this run.

---

## Build Status

**SUCCESS** — `astro build` exit 0. No warnings. No deprecations.

```
[build] output: "static"
[build] directory: /Users/huynguyen/Personal/chaeboxi/website/dist/
[build] 4 page(s) built in 918ms
[build] Complete!
```

Routes written:

| File | Bytes | Status |
|------|------:|--------|
| `website/dist/index.html` | 7739 | EXISTS |
| `website/dist/download/index.html` | 5384 | EXISTS |
| `website/dist/privacy/index.html` | 4006 | EXISTS |
| `website/dist/terms/index.html` | 3857 | EXISTS |

Also present: `_astro/download.H--Q_Opv.css` (8897), `favicon.png`, `og.png`, `screenshot-shell.png`, `screenshot-thread.png`.

---

## Dist Grep Checks

### Asset hrefs start with `/chaeboxi/`

All local `href`/`src` on index + download (and privacy/terms) start with `/chaeboxi/`.

CSS/images:

- `/chaeboxi/_astro/download.H--Q_Opv.css` on all 4 HTML files
- `/chaeboxi/favicon.png`
- `/chaeboxi/screenshot-shell.png`
- `/chaeboxi/screenshot-thread.png`

No relative `./` or `../` asset hrefs.

### Download buttons → GitHub Releases

Baked **v1.7.0** (preferred path; `/releases/latest` fallback not needed this build):

- `https://github.com/nikethai/chaeboxi/releases/download/v1.7.0/Chaeboxi_1.7.0_aarch64.dmg`
- `https://github.com/nikethai/chaeboxi/releases/download/v1.7.0/Chaeboxi_1.7.0_x64.dmg`
- `https://github.com/nikethai/chaeboxi/releases/download/v1.7.0/Chaeboxi_1.7.0_x64-setup.exe`
- `https://github.com/nikethai/chaeboxi/releases/download/v1.7.0/Chaeboxi_1.7.0_amd64.AppImage`
- `https://github.com/nikethai/chaeboxi/releases/download/v1.7.0/Chaeboxi_1.7.0_amd64.deb`

Footer + download page also link `https://github.com/nikethai/chaeboxi/releases`.
Landing primary CTAs go to `/chaeboxi/download/` (correct).

### Forbidden strings

| Needle | Hits in `website/dist` |
|--------|------------------------|
| `url("../..")` / `url(../..` | NONE (CSS has 0 `url()`) |
| `Inter` (word, not IntersectionObserver) | NONE |
| `GSAP` / `gsap` | NONE |
| `picsum` / `picsum.photos` | NONE |

Fonts: Satoshi (Fontshare) + JetBrains Mono. Motion: inline IntersectionObserver only.

---

## Workspace Isolation

`pnpm-workspace.yaml`:

```yaml
packages:
  - .
  - release/app
```

`website` is **not** a workspace package. Confirmed.

---

## Critical Issues

None. All acceptance gates green.

---

## Recommendations

1. Optional: add a post-build assertion script (href prefix, no Inter/GSAP/picsum, release URL) so CI does not rely on manual grep.
2. Coverage: none for `fetchLatestRelease` / network fail path; unit already covers empty-asset fallback.
3. Phase-05 live Pages / Lighthouse / a11y matrix still pending (not this QA pass).

---

## Next Steps

1. Ship / deploy `website/dist` to GitHub Pages (`/chaeboxi/` base).
2. Phase-05 live 200s + About-in-app URL check.
3. Optional CI grep on dist after `pnpm --ignore-workspace build`.

---

## Unresolved Questions

None for this acceptance set.
