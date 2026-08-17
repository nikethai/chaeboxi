# Chaeboxi marketing site

Static Astro site for GitHub Pages. Not the chat app. Do not deploy `pnpm build:web` here.

```bash
pnpm install
pnpm dev
pnpm test
pnpm build
```

Live origin (project Pages): `https://nikethai.github.io/chaeboxi/`

`base` is `/chaeboxi`. Stay on this origin. Do not add a second public hostname without redirects.

Crawl files (project path, not `nikethai.github.io/` root):

- `https://nikethai.github.io/chaeboxi/robots.txt`
- `https://nikethai.github.io/chaeboxi/sitemap.xml`
- `https://nikethai.github.io/chaeboxi/llms.txt`

Submit the sitemap in Search Console as a **URL-prefix** property for `/chaeboxi/`. Google still reads `robots.txt` from the github.io origin root; the project files remain the source of truth for this site.

Workflow: `.github/workflows/pages.yml` (path-filtered). Repo setting: Pages source = GitHub Actions.

`PRODUCT.homepage` / privacy / terms / OpenRouter referer already use this origin. Enable Pages or those in-app links 404 until the first deploy.
