# Chaeboxi logo — locked choice

**Status:** Selected by product owner (2026-08-05)

| ID | File | Role |
|----|------|------|
| **K** | `K-open-cube-dark.jpg` | Primary / dark indigo tile (original) |
| **K2** | `K2-open-cube-light.jpg` | Light periwinkle tile (lighter bg variant) |

Concept: open isometric cube (“boxi”) with open face accent.

## Not selected

- Round 1 bubble/network marks
- Round 2 H / J / G / F / I
- SVG studio / k-precise procedural marks (rejected)

## Shipped into app (2026-08-05)

Primary source: **K2** → `app-icon-master-1024.png`

Replaced:
- `src-tauri/icons/**` (PNG, ICNS, ICO, iOS, Android) via `tauri icon`
- `src/renderer/static/icon.png`, `logo192.png`, `favicon.ico`
- `assets/icon.*`, `assets/icons/*`, `icons/*.webp`, `resources/icon-*`, `doc/statics/icon.png`
- Splash in `src/renderer/index.html` (img instead of Chatbox SVG)
- Export branding in `src/renderer/lib/format-chat.tsx` (inline data URI, Chaeboxi name)

UI imports (`Sidebar`, `Welcome`, `About`) pick up `static/icon.png` automatically.

**Note:** macOS Dock / Windows taskbar update after rebuild (`pnpm dev` / production bundle). Kill old app if icon is cached.
