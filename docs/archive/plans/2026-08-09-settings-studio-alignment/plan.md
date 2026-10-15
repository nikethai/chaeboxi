# Plan: Settings studio alignment (app spirit)

**Status:** implemented (Phase 0–2 core; Phase 3 provider detail polish optional)  
**Date:** 2026-08-09  
**Depends on:** portal-pickers-rail-settings (primitives exist; content still admin)  
**Design contract:** `docs/design-guidelines.md`

---

## Diagnosis (why it still feels off)

Last cycle fixed **chrome** (nav edge, page headers, tokens, form radius). Content panes still read as **generic admin**:

| What chat/studio does | What settings still does |
|---|---|
| Quiet hierarchy, measure (`--chatbox-col`) | Full-bleed stacks, uneven `gap="xl"` / `Title order={5}` |
| Soft lift surfaces (composer shadow language) | Flat void + free-floating Mantine controls |
| Preference density (label ↔ control) | Classic top-label form fields everywhere |
| Shadows over hard rules | Mantine `Divider`, default outline buttons |
| Shared primitives as default | `SettingsPageHeader` only; `SettingsSection` / `SettingsCard` almost unused |
| Callouts = quiet brand tint | Many pages still raw `Alert` / loose helper text |

Primitives exist (`SettingsPageHeader`, `SettingsSection`, `SettingsCard`, `SettingsCallout`, `settings-surfaces.css`) but **pages never adopted the layout language** — so spirit stops at the nav rail.

---

## Product target (locked recommendation)

**Studio preference panels** — Linear / Cursor / Arc settings DNA, same tokens as chat.

Not:

- denser admin form suite  
- card-soup SaaS dashboard  
- new gradients / mesh / pill radius revolt  

**Yes:**

1. **Content measure** — settings body max-width ~`40rem`–`42rem` (slightly tighter than chat col), centered or left-padded consistently; wide list pages (provider list + detail) keep split pane.
2. **Section = soft panel** — `SettingsSection` wraps a **single** `SettingsCard` (or list surface). Section title sits **above** the card (micro label), not inside as heavy H5.
3. **Preference rows** — for switches / single selects: left title + optional one-line helper; right control; hairline between rows inside the card. Not label-above-field stacks for toggles.
4. **Field groups** — multi-line inputs / long selects stay stacked **inside** the card with quieter labels (`size="sm"`, secondary).
5. **Lists** (skills, commands, MCP, providers) — row surfaces with hover lift; primary CTA in header actions; empty state uses `SettingsCallout` + one CTA.
6. **Chrome stays** — nav active pill, soft edge, page header already good; do not redesign shell again.

### Visual sketch

```
[ Settings / General ]                    [ ×  esc ]

General Settings
Language, theme, data…

LANGUAGE & APPEARANCE          ← micro section label (ink-2, 0.75rem, tracking)
┌─────────────────────────────────────────┐
│ Language              [ English     ▾ ] │  preference row
│ Theme                 [ Dark        ▾ ] │
│ Font size             ────●────  14     │
└─────────────────────────────────────────┘  panel + hairline shadow

DATA
┌─────────────────────────────────────────┐
│ …                                       │
└─────────────────────────────────────────┘
```

---

## Non-goals (this cycle)

- Rewriting settings business logic / store keys  
- New settings IA or nav regroup (can be a later pass)  
- Replacing Tabler icons with a new set  
- Mobile IA redesign beyond existing responsive shell  
- Provider API forms full rewrite (token + row/card only where cheap)

---

## Architecture

### New / extend primitives

| Piece | Role |
|---|---|
| `SettingsPage` (optional thin wrapper) | `max-w` + padding rhythm for all content routes |
| `SettingsSection` | title/desc **above** card; gap tokens |
| `SettingsCard` | panel surface; optional `divide` for row children |
| **`SettingsPrefRow`** (new) | title, description?, control (right), optional danger |
| **`SettingsListRow`** (new, optional) | list item: icon, title, meta, trailing switch/actions |
| `settings-surfaces.css` | row dividers, pref-row layout, section micro-label, content measure |

Keep existing `SettingsCallout` / page header.

### CSS tokens (reuse)

- Surfaces: `--chatbox-background-secondary` / rail / primary  
- Edge: same hairline mix as `--settings-shadow` / rail  
- Radius: 9 outer card, 7 controls (concentric)  
- Type: Satoshi already global; section label `0.75rem` / `600` / letter-spacing slightly open; page title stays as now  
- Motion: existing 140–150ms; no new stagger on every field  

### Global form overrides (keep + tighten)

Already in `settings-surfaces.css` — extend for:

- `.settings-pref-row`  
- `.settings-section-label` (micro)  
- `.settings-content-measure`  
- Switch / Checkbox / Slider track alignment with brand  
- Soften Mantine `Divider` inside settings (or ban usage in favor of row hairlines)

---

## Phases

### Phase 0 — Design tokens + primitives (foundation)

**Files**

- `src/renderer/components/settings/SettingsPrefRow.tsx` (create)  
- `src/renderer/components/settings/SettingsPage.tsx` (create — measure + pad)  
- `src/renderer/components/settings/SettingsSection.tsx` (adjust label style)  
- `src/renderer/components/settings/SettingsCard.tsx` (optional `divided` prop)  
- `src/renderer/components/settings/settings-surfaces.css`  
- `src/renderer/static/globals.css` only if measure vars belong with shell tokens  
- `docs/design-guidelines.md` — expand Settings surfaces section with row + measure rules  

**Acceptance**

- Pref row works light + dark  
- Card nested controls concentric (11 → 9)  
- No gradients  

---

### Phase 1 — High-traffic preference pages (template pages)

Apply measure + section/card/pref-row as the **canonical pattern**.

| Route | Notes |
|---|---|
| `settings/general.tsx` | Display / theme / data groups → panels + rows |
| `settings/chat.tsx` | Avatars as card; switches as rows; sliders in card |
| `settings/default-models.tsx` | Select rows inside one card |
| `settings/web-search.tsx` | Provider choice + keys in panels |
| `settings/document-parser.tsx` | Same |

**Acceptance**

- No bare `Title order={5}` section headers on these pages  
- Primary toggles are pref rows  
- Visual: open next to chat — same void/panel/ink language  

---

### Phase 2 — Catalog / list settings

| Route | Pattern |
|---|---|
| `settings/skills.tsx` | Header actions + list rows in card / soft list |
| `settings/commands.tsx` | Same |
| `settings/hooks.tsx` | Already uses `SettingsCard` — align rows |
| `settings/mcp.tsx` + mcp components | Section headers via `SettingsSection`; list chrome |
| `settings/memory.tsx` + memory header | Already partial; align body |
| `routes/copilots.tsx` / agents | Header already; list density |

**Acceptance**

- Empty states: `SettingsCallout` + one CTA (no blue Alert slab)  
- Row hover matches nav hover lift language  

---

### Phase 3 — Provider + remaining

| Route | Pattern |
|---|---|
| `settings/provider/*` | Keep split list; list pane already rail-like — ensure detail form uses cards + measure |
| `settings/hotkeys.tsx` | Keyboard rows as pref/list rows |
| `settings/knowledge-base.tsx` | Same as catalog |
| leftover pages | Sweep for raw Alert / Title / Divider |

**Acceptance**

- Provider detail no longer “white form on void” in light mode  
- Light + dark QA on general, chat, provider, skills  

---

### Phase 4 — QA + docs

- Manual: dark + light — general, chat, skills, provider list/detail, MCP  
- `pnpm check` + focused tests if any  
- Update `docs/design-guidelines.md` Settings surfaces with final rules  
- Plan status → implemented  

---

## Implementation principles

1. **Rewrite layout, not logic** — same `useSettingsStore` / handlers.  
2. **One pattern per control type** — toggle → PrefRow; multi-field → stacked in Card; catalog → ListRow.  
3. **Replace, don’t layer** — drop page-local `Title order={5}` + random Stacks when Section exists.  
4. **i18n** — keep `t()`; no copy rewrite except empty-state helpers if missing.  
5. **KISS** — no design-system monorepo; 2 small components + CSS.  

---

## Risks

| Risk | Mitigation |
|---|---|
| Large page diffs | Phase by route group; ship Phase 1 first if needed |
| Pref-row breaks long labels / RTL | Wrap title stack; control `flex-shrink-0`; test AR |
| Nested cards double shadow | Section title outside card; one surface per group |
| Provider forms huge | Only shell + card wrap; no field-by-field rewrite |

---

## Success criteria

- User opens Settings after using chat and it still feels like **Chaeboxi studio**, not a different product.  
- Same radius, ink, indigo, soft edges as rail/composer.  
- Headers + bodies consistent across Phase 1–2 pages minimum.  
- Light and dark both acceptable (no washed Alert blues, no hard grey slabs).  

---

## Suggested execution order after approval

1. Phase 0 primitives  
2. Phase 1 (general + chat as golden examples)  
3. Phase 2 lists  
4. Phase 3 provider + sweep  
5. Phase 4 QA  

Optional: stop after Phase 1 for visual sign-off, then continue.

---

## Unresolved / confirm with user

None required for spirit direction — **studio preference panels** is the recommended choice.  
Optional: content max-width **40rem** vs match `--chatbox-col` (48rem). Recommendation: **40rem** for denser forms; lists can go full content pane width.
