# Research: design-skill synthesis for the marketing site

Date: 2026-08-15

## Problem

User asked for a GitHub Pages marketing site **and** five design skills. Those skills fight each other and fight `docs/design-guidelines.md`.

## RNG (gpt-taste + high-end variance)

Prompt length seed = 164.

| Slot | Roll | Used? |
|---|---|---|
| Hero | Editorial Split | Yes |
| Type | Satoshi | Yes (also app lock) |
| Components | Inline images, Marquee, Feedback carousel | Inline + marquee yes; carousel → principles (no fake quotes) |
| GSAP | Pin + pin (dup) | Mapped to CSS sticky + scale/fade |
| Vibe | Soft Structuralism | Overridden to Studio Structuralism (dark) |
| Layout | Z-Axis Cascade | Yes on hero overlap + desire stack |

## Binding rules

1. Product tokens win over agency defaults (2rem squircle, white luxury, purple orbs).
2. Honesty wins over social proof theater (no invented testimonials).
3. YAGNI wins over GSAP (static Pages, reduced-motion, tiny JS).
4. Web Interface Guidelines are a ship gate, not a suggestion.
5. Independence plan “wait for domain” is superseded for *having a public URL*; custom domain stays later.

## Astro + Pages (2026)

Official path: `withastro/action@v6` + `actions/deploy-pages@v5`.
Must set `site` + `base: '/chaeboxi'` for project Pages.
Internal links must include `import.meta.env.BASE_URL`.
Human must set repo Pages source to GitHub Actions.

## Do not ship

`pnpm build:web` as the site. Renderer is the product, not the brochure.
