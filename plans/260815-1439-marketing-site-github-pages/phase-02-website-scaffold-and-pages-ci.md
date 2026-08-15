---
phase: 2
title: "Website scaffold and Pages CI"
status: completed
effort: "M"
priority: P1
dependencies: [1]
---

# Phase 2: Website scaffold and Pages CI

## Overview

Create an isolated Astro app in `website/` and a Pages workflow that builds **only that folder**. Prove `https://nikethai.github.io/chaeboxi/` serves HTML + CSS. Stub page is enough.

**Status (2026-08-15):** completed. Isolated `website/` + `pages.yml` shipped; local `astro build` green. Live Pages source + first 200 is phase 05 (human repo setting).

<!-- Updated: Validation Session 1 - sequential PRs; this phase is its own PR; no PRODUCT flip -->

## Context Links

- https://docs.astro.build/en/guides/deploy/github/
- `.github/workflows/ci.yml` (do not hook this job into quality CI)
- `docs/deployment-guide.md` (web hosting is currently out of scope — update in phase 04)

## Requirements

- Functional: `pnpm --dir website build` emits static files; Actions deploys them
- Non-functional: app `pnpm install` / `pnpm test` / release.yml unchanged; no Astro in root deps

## Architecture

```
website/                     # own package.json + pnpm-lock.yaml
  astro.config.mjs           # site + base
  src/pages/index.astro      # stub
  src/styles/tokens.css
  public/                    # favicon, later screenshots
.github/workflows/pages.yml
```

**Not** added to `pnpm-workspace.yaml`. Root desktop CI must not install Astro.

### Astro config

```js
// website/astro.config.mjs
import { defineConfig } from 'astro/config'
export default defineConfig({
  site: 'https://nikethai.github.io',
  base: '/chaeboxi',
  output: 'static',
  trailingSlash: 'always',
})
```

All internal links use `import.meta.env.BASE_URL` (Astro `<a href={`${import.meta.env.BASE_URL}download/`}>`). Never hardcode `/download` without base.

Later custom domain: `site: 'https://example.com'`, `base: '/'`. Design for that now.

### Workflow

File: `.github/workflows/pages.yml`

- `on.push.branches: [main]` with `paths: ['website/**', '.github/workflows/pages.yml']`
- plus `workflow_dispatch`
- permissions: `contents: read`, `pages: write`, `id-token: write`
- build job: `withastro/action@v6` with `path: website`, `node-version` from `.node-version` if the action accepts it (else 22)
- deploy job: `actions/deploy-pages@v5`, environment `github-pages`

Do **not** run on every app commit.

### Human step (cannot automate in-repo)

Repo **Settings → Pages → Source = GitHub Actions**. First `workflow_dispatch` after merge.

### Stub page

Dark void background, Satoshi, wordmark, one sentence, “CI stub”. Enough to verify CSS + `base` assets.

## Related Code Files

- Create: `website/package.json`, `website/pnpm-lock.yaml`, `website/astro.config.mjs`, `website/src/pages/index.astro`, `website/src/styles/tokens.css`, `website/DESIGN.md`, `website/.gitignore` (`dist/`, `node_modules/`)
- Create: `.github/workflows/pages.yml`
- Modify: none in `src/` yet
- Delete: none

## Implementation Steps

1. `pnpm create astro@latest website` (minimal, no git, TypeScript, no example extras) **or** hand-roll the same files. Keep it tiny.
2. Add Tailwind only if it stays local to `website/`. Acceptable. Do not add Mantine/MUI.
3. Drop in `tokens.css` from phase 01. Wire it in the root layout.
4. Set `site` + `base`. Confirm `astro build` writes asset URLs under `/chaeboxi/`.
5. Add `pages.yml` as specified.
6. Merge or dispatch. Confirm the live stub URL loads CSS (view-source: no `/assets/` missing the `/chaeboxi` prefix).
7. Do not touch `PRODUCT.ts`. This PR is scaffold + CI only (Validation Session 1).

## Success Criteria

- [x] `website/` has its own lockfile
- [x] Root `pnpm-workspace.yaml` unchanged
- [x] `astro build` succeeds locally
- [x] Pages workflow is path-filtered
- [ ] Live stub at `https://nikethai.github.io/chaeboxi/` (or Actions preview URL) shows styled HTML — phase 05
- [ ] Refresh on `/chaeboxi/` does not 404 — phase 05

## Risk Assessment

| Risk | Mitigation |
|---|---|
| `base` forgotten → broken CSS | Check built `index.html` asset hrefs before merge |
| `withastro/action` needs lockfile | Commit `website/pnpm-lock.yaml` |
| Pages source still “Deploy from branch” | Checklist: set to GitHub Actions |
| Workflow runs on app-only pushes | `paths` filter |
| SPA 404 myth | Multi-page Astro; no client router required |

## Security Considerations

- Workflow `pages: write` + `id-token: write` only on this workflow
- No secrets needed
- Do not enable `actions/checkout` persist-credentials beyond default
- Do not print `GITHUB_TOKEN`
