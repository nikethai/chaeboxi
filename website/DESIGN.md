# Chaeboxi marketing site — design contract

Source: `plans/260815-1439-marketing-site-github-pages/phase-01-design-contract-and-tokens.md`
Updated: 2026-08-17 cinematic impression pass

## Vibe

Studio Editorial. Void `#121214`, Satoshi, JetBrains Mono, indigo `#5b63d4`. One hero radial wash (indigo ≤ 12%). No chrome gradients. No sparkles. No Inter / Jakarta / Space Grotesk.

## RNG + overrides

- Hero: Cinematic stack. Wide H1, then a full-bleed product frame. App chrome is the image, not a double bezel around a PNG.
- Type: Satoshi
- Components: provider marquee, 3-step strip, gapless bento, compare table, visible FAQ
- Motion: CSS stagger + scale/fade. No GSAP
- Vibe override: Studio Structuralism (dark), not white Soft Structuralism
- Radius: 11 / 16, not 2rem squircle
- Atmosphere: fixed film grain + indigo wash ≤ 12%. No chrome gradients.

## AIDA

Nav island → cinematic H1 + stage frame → marquee → how-it-runs strip → gapless bento → who-it's-for → desktop tools → compare table → first ten minutes → FAQ → download plate → footer.

Inner page `/why/` is the long argument. No sticky desire chapter. Do not reuse the same screenshot twice. No fake testimonials.

## H1

`Local-first AI copilot.` — `clamp(3rem, 7vw, 5.5rem)`, `text-wrap: balance`, max 2–3 lines. No inline screenshot chip.

## Spacing

`--space-section: clamp(2.75rem, 5vw, 4.5rem)` as the **gap** between `main` children. Do not stack section padding-top and padding-bottom on top of that gap.

## Bans

Fake testimonials. Universal MCP/computer-use claims. Meta-labels (`SECTION 01`). Picsum. Motion libraries. Double-bezel on every tile.
