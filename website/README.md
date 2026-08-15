# Chaeboxi marketing site

Static Astro site for GitHub Pages. Not the chat app. Do not deploy `pnpm build:web` here.

```bash
pnpm install
pnpm dev
pnpm test
pnpm build
```

Live origin (project Pages): `https://nikethai.github.io/chaeboxi/`

`base` is `/chaeboxi`. Custom domain later: set `site` to the domain and `base` to `/`.

Workflow: `.github/workflows/pages.yml` (path-filtered). Repo setting: Pages source = GitHub Actions.

`PRODUCT.*` in the desktop app flips only after all four routes are live.
