---
phase: 1
title: "Design contract and tokens"
status: completed
effort: "S"
priority: P1
dependencies: []
---

# Phase 1: Design contract and tokens

## Overview

Write the marketing design contract and a three-layer token file **before** any page layout. Implementers treat this file as law. Do not invent a second palette.

**Status (2026-08-15):** completed. `website/DESIGN.md` + `website/src/styles/tokens.css` shipped.

## Context Links

- `docs/design-guidelines.md`
- `plans/2026-08-05-ui-ux-redesign/mock-dark-shell.html`
- `src/renderer/static/globals.css` (token names only — do not import)
- Vercel Web Interface Guidelines (fetched 2026-08-15)

## Requirements

- Functional: one written contract + `website/src/styles/tokens.css` (or plan-local draft copied in phase 02)
- Non-functional: no raw hex in components later; every color/space/type/radius/shadow/easing is a token

## Architecture

### Python RNG (seed = 164)

```
hero     Editorial Split
type     Satoshi
comp     Inline Typography Images, Infinite Marquee, Feedback Carousel
gsap     Scroll Pinning Split (duplicate roll)
vibe     Soft Structuralism
layout   Z-Axis Cascade
```

### Product overrides (required)

| RNG pick | Override | Why |
|---|---|---|
| Soft Structuralism (white/silver) | **Studio Structuralism** — void `#121214`, airy spacing, floating double-bezel | App is dark-first. White consumer look breaks brand |
| Ethereal-style purple orbs | Banned | Generic AI slop + design-guidelines no-gradient chrome |
| Feedback Carousel | **Principles carousel** (what it is / is not). No fake quotes | No testimonials exist. Inventing them is a lie |
| GSAP pin (both rolls) | CSS `position: sticky` + IntersectionObserver | GH Pages + reduced-motion + YAGNI. Map, do not install GSAP |
| Second pin (duplicate) | Image scale/fade via CSS (`transform`/`opacity` only) | Fulfills gpt-taste second paradigm without a second pin |
| `rounded-[2rem]` double-bezel | Bezel yes, radius **11 / 16** | Studio radii. 32px squircle is Apple-clone, not Chaeboxi |
| Picsum / stock | Real app screenshot only | Product is the asset |
| Meta-labels `SECTION 01` | Banned | gpt-taste + studio |

### Locked vibe

**Studio Editorial.** OLED void, Satoshi display, JetBrains Mono meta, solid indigo `#5b63d4`, hairline `#2a2a32`, layered shadow not hard border. One hero radial wash (`indigo` ≤ 12% opacity, behind content). No chrome gradients. No sparkles. No Inter / Plus Jakarta / Space Grotesk.

### AIDA (landing)

1. **Nav** — floating island, detached (`mt-6`), void/80 + `backdrop-blur` **only on the sticky nav**. Wordmark left, Download + GitHub right. Mobile: hamburger → X morph, overlay `bg-void/80` + blur, staggered link reveal.
2. **Attention** — Editorial Split: type left (~7/12), screenshot right (~5/12) overlapping the type by ~40px (Z-axis). H1 **max 2–3 lines**. Container `min(100%, 72rem)`. H1 `clamp(2.75rem, 4.6vw, 5rem)` + `text-wrap: balance`. **No stamp badges, no hero stats, no pill tags under H1.**
3. **Interest** — gapless 12-col bento `grid-flow-dense`, 4 cells that fill the grid: Local-first, BYOK, Providers, Agents/MCP (desktop label). Mix one large screenshot tile + three type tiles.
4. **Desire** — sticky chapter title left, stacked proof right (desktop). Image enters `scale(.92)` → `1`, leaves `opacity .35`. `prefers-reduced-motion`: no pin, no scale, static stack.
5. **Action** — full-width download band + footer (Privacy, Terms, GitHub, Releases, NOTICE).

### Headline (locked)

- H1: `Local-first AI copilot.`
- Inline image: 7rem × 2.25rem pill of the real screenshot inside the H1 after `Local-first` **or** immediately under the two CTAs — not both.
- Sub: `Bring your own keys. Chats stay on your device. GPLv3.`
- Primary CTA: `Download Desktop` → `/download`
- Secondary CTA: `View Source` → GitHub repo
- Button contrast: light ink on indigo primary; ink on hairline secondary. Nested trailing-icon circle on primary only.

### Token architecture (3 layers)

Primitives from the app. Semantic names are **site-owned** (`--site-*`) so we do not pretend this is the renderer theme.

```css
/* primitive */
--ink-void: #121214;
--ink-rail: #16161a;
--ink-panel: #1c1c21;
--ink-lift: #24242b;
--ink-1: #ececec;
--ink-2: #a8a8ae;
--ink-3: #6e6e76;
--line-1: #2a2a32;
--indigo: #5b63d4;
--font-sans: "Satoshi", "Segoe UI", system-ui, sans-serif;
--font-mono: "JetBrains Mono", ui-monospace, monospace;
--radius-1: 7px;
--radius-2: 11px;
--radius-3: 16px;
--ease-out: cubic-bezier(0.32, 0.72, 0, 1);
--space-section: clamp(6rem, 12vw, 12rem); /* py-24..py-48 */

/* semantic */
--color-bg: var(--ink-void);
--color-fg: var(--ink-1);
--color-muted: var(--ink-2);
--color-brand: var(--indigo);
--color-line: var(--line-1);

/* component */
--button-bg: var(--color-brand);
--button-fg: #fff;
--card-shell-pad: 6px;
--card-radius-outer: var(--radius-3);
--card-radius-inner: 10px;
--nav-blur: 16px;
```

`html { color-scheme: dark; }` and `<meta name="theme-color" content="#121214">`.

### Double-bezel (adapted)

Outer: `pad 6px`, `radius 16`, `bg lift/40`, hairline `white/8`. Inner: `radius 10`, `bg panel`, inset highlight `inset 0 1px 0 white/8`. No `shadow-md`. Ambient shadow only.

### Motion rules

- Animate `transform`/`opacity` only. Never `transition: all`.
- Duration 700ms, `--ease-out`.
- `prefers-reduced-motion: reduce` → disable pin, scale, marquee, stagger; keep focus states.
- Grain if used: **fixed** `pointer-events: none` overlay, opacity ≤ 0.03. Optional. App forbids grain on chrome; site may use one fixed overlay.

### Icon + type

- Phosphor Light or Tabler outline — not fat Lucide on this site.
- Satoshi via Fontshare (same as `src/renderer/index.html`) + JetBrains Mono. `preconnect` + `preload` + `font-display: swap`.
- Brand name `Chaeboxi` has `translate="no"`.

### Copy bans

- “What can I help with?”
- “AI-powered” / sparkles / “the future of”
- Claiming MCP / computer use / browser agent work on web/mobile
- Fake user quotes
- Hiding GPLv3 or NOTICE / upstream origin (one honest footer line)

## Related Code Files

- Create: `website/src/styles/tokens.css` (phase 02 may create the folder)
- Create: this contract stays in the plan; copy a short `website/DESIGN.md` in phase 02
- Modify: none in the app

## Implementation Steps

1. Confirm tokens against `docs/design-guidelines.md` locked table (void/rail/panel/indigo/Satoshi).
2. Draft `tokens.css` with primitive / semantic / component layers. No hex outside primitives.
3. Write `website/DESIGN.md` (1 page): AIDA, overrides, headline, bans. Link this phase.
4. Do not build page sections yet.

## Success Criteria

- [x] Token file has three layers; components will only use semantic/component vars
- [x] DESIGN.md records RNG picks **and** the product overrides
- [x] H1 line-limit, bento cell count (4), and CTA contrast are written down
- [x] No GSAP/anime.js in the contract

## Risk Assessment

| Risk | Mitigation |
|---|---|
| Implementer “improves” into purple glass AI landing | Overrides table is blocking |
| Token drift from app | Primitives copied by value, not imported |
| Grain/blur kills mobile | Blur only on sticky nav; grain fixed overlay only |

## Security Considerations

None. Tokens are public brand values.
