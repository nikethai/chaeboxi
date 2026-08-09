# Plan: Portal pickers + rail edge + full settings suite polish

**Status:** implemented (pending visual QA in app)  
**Date:** 2026-08-09  
**Repo plan copy (on implement):** `plans/2026-08-09-portal-pickers-rail-settings/`  
**Design contract:** `docs/design-guidelines.md`  
**Skills applied:** make-interfaces-feel-better, frontend-design, ui-ux-pro-max, high-end-visual-design (depth/spacing only — no gradient/mesh revolt)

---

## Locked decisions (user)

| # | Question | Decision |
|---|---|---|
| 1 | Picker positioning | **Portal pickers** (not CSS overflow-chain only) |
| 2 | Settings scope | **Full settings suite this cycle** |
| 3 | Theme QA | **Light + dark** both required before done |
| 4 | Empty `@` / `$` / `/` when none configured | **Recommended choice below** |

### Decision 4 — empty picker CTA (recommended)

**Choose: in-picker empty state with primary deep-link CTA.**

| State | UI |
|---|---|
| Agents exist, query matches none | Quiet text: “No agents found” (no CTA) |
| **Zero agents configured** | Title: “No agents yet” · helper one line · **primary button** “Create agent” → `navigateToSettings('/settings/agents')` |
| Skills: zero enabled / none at all | Same pattern → `/settings/skills` |
| Commands: zero | Same → `/settings/commands` |

**Why this wins**

- Stays inside the composer discovery path (`@` / `$` / `/`) already locked in design guidelines — no second empty-home chrome.
- Recoverable: user who discovers `@` is not dead-ended.
- KISS: one empty component in shared panel; no new blank-home widgets.
- Filter-empty vs catalog-empty are different (don’t push Settings when the user only mistyped).

**Reject**

- Silent empty list (feels broken).  
- Always-visible agents combobox on blank home (guidelines forbid).  
- Auto-open Settings modal on `@` (jarring).

---

## Problem summary

| ID | Symptom | Root cause | Priority |
|---|---|---|---|
| **A** | Agent/skill/command picker clipped on empty home | Absolute `bottom-full` inside ancestors with `overflow: hidden` (`.blank-home`, `Page`) | **P0** |
| **B** | Sidebar ↔ main divider feels cheap / thick grey edge | Hard double border + utilitarian resizer | **P1** |
| **C** | Settings read as generic admin, not AI studio | Shell half-tokenized; content panes still SaaS form chrome | **P1** (full suite) |

Evidence (code):

- Pickers: `AgentPicker.tsx`, `SkillPicker.tsx`, `CommandPicker.tsx`, `PresetPicker.tsx`, `OpenClawCommandPicker.tsx` — shared pattern `absolute … bottom-full … z-50`
- Clippers: `globals.css` `.blank-home { overflow: hidden }`, `Page.tsx` content `overflow-hidden`
- Partial dock-only fix: `.composer-card-picker-open` + `:has()` on `.session-dock` — insufficient for blank home
- Rail: `Sidebar.tsx` drawer `borderRight` + `.studio-rail` border + `.sidebar-resizer`
- Settings: `routes/settings/route.tsx` + per-page routes; chrome tokens in `globals.css` (`.settings-shell`, `.settings-nav-*`)

---

## Design principles (non-negotiable)

Stay inside `docs/design-guidelines.md`:

- Dark-first tokens; **ship parity for light**
- Accent solid indigo; **no gradients / purple glows**
- Radius 7 / 9 / 11; Satoshi + mono meta
- Shadows over hard full-height borders
- No emoji as product chrome icons (agent `emojiAvatar` tolerated until a later identity pass)
- High-end skill → depth, spacing, soft ambient shadow, motion timing — **not** new font stack / mesh / 2rem squircles / banned Tabler

### make-interfaces-feel-better checklist for this work

- Concentric radius on nested settings cards / picker shell  
- Shadows over hard section walls  
- Press `scale(0.96)` on CTAs where appropriate  
- Min 40×40 hit targets (resizer strip, close, nav rows)  
- No `transition: all`  
- Enter/exit picker: opacity + small `translateY`; respect `prefers-reduced-motion`  
- Tabular nums only where numbers animate (not required for pickers)

---

## Architecture

### A — Composer pickers (portal)

```
InputBox (.composer-card)
  └── anchor ref (composer surface rect)
  └── when open: portal → document body (or app overlay root)
        └── ComposerPickerPanel (fixed position)
              header · scroll body · empty CTA · listbox a11y
```

**Shared shell:** `ComposerPickerPanel` used by Agent / Skill / Command / Preset / OpenClaw.

**Positioning algorithm**

1. Measure anchor `getBoundingClientRect()`  
2. Prefer **above** composer (`bottom = viewportH - top + gap`)  
3. If `spaceAbove < min(preferredH, contentH) + 12` → flip **below**  
4. `maxHeight = min(320, availableSpace - 8)`  
5. Width = anchor width (match composer card)  
6. Reposition on resize / scroll / visualViewport (desktop + web)  
7. z-index: above composer, below modal/dialog layer (use existing stacking tokens if any; else one CSS var `--chatbox-z-composer-picker`)

**Stack choice (KISS):** React `createPortal` + `getBoundingClientRect` + rAF/resize listeners. No new floating-ui dependency unless measurement edge cases force it. Mantine `Portal` is fine if already idiomatic; keep logic local.

**Interaction preserve**

- Keyboard: ↑↓, Enter, Esc (existing InputBox handlers)  
- `onMouseDown` preventDefault on rows (focus stays in textarea)  
- Click outside / Esc dismiss (existing dismissed flags)  
- `role="listbox"` / `option` + `aria-activedescendant` if not already

### B — Rail edge

```
.studio-rail | main
  soft trailing edge (shadow / hairline mix ≤8% ink)
  .sidebar-resizer: 6–8px transparent hit; 1–2px brand line only hover/drag
```

- Remove **double** border (drawer paper **or** `.studio-rail`, single source)  
- No thick grey “scrollbar” affordance at rest

### C — Settings suite

```
settings-shell
  settings-nav (rail language)
  settings-content
    SettingsPageHeader
    SettingsSection / SettingsCard / SettingsCallout (quiet)
    page-specific content
```

**Primitives first**, then migrate every settings route so full suite shares one visual language.

**Pages in scope (full suite)**

| Route | Notes |
|---|---|
| `/settings` index / nav shell | Active state, motion, light+dark |
| `provider/*` | Hot path (Image #2); list + detail + add/import |
| `default-models` | Cards / selectors |
| `web-search` | Provider config forms |
| `mcp` | Server list + modals |
| `knowledge-base` | If feature flag |
| `document-parser` | Forms |
| `chat` | Chat prefs |
| `skills` | List + empty |
| `commands` | List + empty |
| `hooks` | List + empty |
| `memory` | Existing memory workspace — align tokens only, avoid rewrite of logic |
| `agents` | List + empty (CTA target for picker) |
| `hotkeys` | Table/list |
| `general` | Theme, language, etc. |

**Out of scope**

- New settings IA / reordering product features  
- Account/billing (CE strips paid features)  
- Emoji → SVG agent identity migration  
- Full design-system rewrite outside tokens  

---

## Phases

### Phase 1 — Portal pickers (P0) · ~0.5–1d

**Goal:** `@` / `$` / `/` (and presets / OpenClaw) never clip on blank home, session, or quick panel.

**Files (expected)**

- Create: `src/renderer/components/InputBox/ComposerPickerPanel.tsx`  
- Create (optional): `src/renderer/components/InputBox/useComposerPickerPosition.ts`  
- Edit: `AgentPicker.tsx`, `SkillPicker.tsx`, `CommandPicker.tsx`, `PresetPicker.tsx`, `OpenClawCommandPicker.tsx`  
- Edit: `InputBox.tsx` (pass anchor ref / portal host if needed)  
- Edit: `globals.css` (picker surface tokens; optional cleanup of fragile `:has` overflow hacks)  
- Tests: filter unit tests stay; add position/empty CTA tests if cheap  

**Steps**

1. Extract shared panel shell (surface, max-height scroll, header, empty states).  
2. Implement portal + position + flip + resize.  
3. Wire all five pickers.  
4. Empty catalog CTA → Settings (agents/skills/commands).  
5. Visual polish: layered shadow, soft hairline, row hover/active brand secondary, concentric radius.  
6. QA matrix: blank home, session, quick; light+dark; RTL; reduced motion; keyboard.

**Acceptance**

- [ ] Blank home `@` shows full list; top row never half-cut without scroll  
- [ ] Flip below when headroom insufficient  
- [ ] Internal scroll when content > maxHeight  
- [ ] Zero agents → “Create agent” opens `/settings/agents`  
- [ ] Zero skills → manage skills CTA  
- [ ] Esc / outside / selection still work  
- [ ] Light + dark both pass  

---

### Phase 2 — Rail edge polish (P1) · ~0.5d

**Goal:** Soft studio separation; resizer invisible until needed.

**Files**

- `src/renderer/Sidebar.tsx`  
- `src/renderer/static/globals.css` (`.studio-rail`, `.sidebar-resizer`)  

**Steps**

1. Single edge definition (kill double border).  
2. Soft shadow / hairline token for rail trailing edge.  
3. Resizer: transparent hit; 1–2px brand line on hover/drag only.  
4. Icon-rail + expanded + RTL + light/dark.

**Acceptance**

- [ ] No thick grey rest-state bar  
- [ ] Resize + double-click collapse still work  
- [ ] Edge matches chat chrome quality next to blank home  

---

### Phase 3 — Settings primitives + shell (P1) · ~0.5–1d

**Goal:** Shared building blocks so full suite doesn’t diverge.

**Files**

- Create: `src/renderer/components/settings/SettingsSection.tsx`  
- Create: `src/renderer/components/settings/SettingsCard.tsx`  
- Create: `src/renderer/components/settings/SettingsCallout.tsx` (quiet; replace loud blue boxes)  
- Create: `src/renderer/components/settings/SettingsPageHeader.tsx` (optional if repeated titles)  
- Edit: `routes/settings/route.tsx`, `globals.css` (`.settings-*`)  
- Edit: `docs/design-guidelines.md` — short “Settings surfaces” subsection  

**Visual rules**

- Nav active: rail-like quiet fill + indicator (not pastel SaaS pill fighting brand)  
- Content: void/panel/lift hierarchy; soft shadows; 7–11 radius concentric  
- Callouts: tinted surface ≤ brand 12–15%, no solid light-blue alert slabs as primary hierarchy  
- Forms: consistent label / helper / field height; ≥40px controls  
- Motion: keep staggered nav; content fade-up light; reduced-motion off  

**Acceptance**

- [ ] Shell side-by-side with chat: same ink/void/radius language  
- [ ] Light + dark nav active/hover/focus readable (contrast)  
- [ ] Primitives documented with 1–2 usage examples  

---

### Phase 4 — Settings full suite migration (P1) · ~1.5–2.5d

**Order (traffic + screenshot + complexity)**

1. **Model Provider** (`provider/route.tsx`, `ProviderList`, `$providerId.tsx`) — Image #2  
2. **Agents / Skills / Commands** — empty states align with picker CTAs  
3. **Chat + Default models + Web search**  
4. **MCP + Knowledge Base + Document parser**  
5. **Memory** — token/surface align only; don’t rewrite memory logic  
6. **Hooks + Hotkeys + General**  

**Per-page checklist**

- [ ] Uses `SettingsSection` / `SettingsCard` / quiet callout  
- [ ] No new hard full-height triple borders without purpose  
- [ ] Primary actions clear; secondary subordinate  
- [ ] Empty states helpful + action  
- [ ] Light + dark  
- [ ] No business-logic regressions  

**Acceptance (suite)**

- [ ] All settings routes share visual language  
- [ ] Provider connect flow scannable in ~5s (status, method, primary action)  
- [ ] Agents/skills empty matches picker CTA destinations  
- [ ] No gradients; AA contrast light+dark on body text  

---

### Phase 5 — Cross-surface QA + docs · ~0.5d

**Goal:** Prove A+B+C together; lock docs.

**QA matrix**

| Surface | Light | Dark | Notes |
|---|---|---|---|
| Blank home `@` `$` `/` | ✓ | ✓ | Centered composer clip was the bug |
| Session dock pickers | ✓ | ✓ | Flip when near top |
| Quick panel | ✓ | ✓ | If applicable |
| Rail expand/rail/resize | ✓ | ✓ | RTL if time |
| Settings: provider | ✓ | ✓ | Screenshot parity |
| Settings: agents/skills | ✓ | ✓ | Empty + populated |
| Settings: other pages smoke | ✓ | ✓ | Spot-check |

**Docs**

- Update `docs/design-guidelines.md`: portal pickers, rail edge, settings surfaces  
- Plan reports under `plans/2026-08-09-portal-pickers-rail-settings/reports/` on implement  

**Acceptance**

- [ ] No regressions in send / blank-home dock animation  
- [ ] `pnpm lint` / focused tests green  
- [ ] Design guidelines updated  

---

## Dependency graph

```
Phase 1 (pickers) ─────────────────────────────┐
Phase 2 (rail) ──── parallel with 1 after start ┤
Phase 3 (settings primitives) ── requires design freeze
Phase 4 (full suite) ── requires Phase 3
Phase 5 (QA/docs) ── requires 1–4
```

Phases 1 and 2 can ship in one PR or two. Phase 3+4 preferably one feature branch with reviewable commits (shell → provider → rest).

---

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Portal breaks focus / click-outside | Mirror existing mousedown preventDefault; single dismiss path |
| Position jitter on resize | rAF throttle; update only when rect changes |
| Settings full suite scope creep | Primitives first; no IA rewrite; memory logic freeze |
| Light mode afterthought | Every phase acceptance includes light+dark |
| High-end skill fights brand | Explicit ban on mesh/gradients/new fonts in PR checklist |
| `:has` overflow hacks vs portal | Prefer portal; delete dead CSS only after verify |

---

## Explicit non-goals

- Redesigning blank-home greeting copy/layout  
- Replacing agent emoji avatars with SVG system  
- New settings navigation tree or feature flags  
- Introducing floating-ui / framer-motion unless already present and necessary  
- Film grain / decorative noise in production  

---

## Success metrics (qualitative)

1. Empty home `@` looks intentional and fully usable.  
2. Rail edge disappears into “studio chrome” rather than Excel split.  
3. Settings feels like the same product as chat (tokens, density, calm hierarchy).  
4. Light and dark both look designed — not inverted afterthoughts.

---

## Implementation kickoff checklist

When user says cook / implement:

1. Copy this plan → `plans/2026-08-09-portal-pickers-rail-settings/plan.md` + phase files if needed  
2. Start Phase 1 (`ComposerPickerPanel` + portal)  
3. Phase 2 rail in parallel or immediately after  
4. Phase 3 primitives → Phase 4 migration by page order  
5. Phase 5 QA + docs  

---

## Unresolved (none blocking)

- Whether Phase 1+2 are one PR or two — **recommend two commits / one PR** for reviewability.  
- Memory page depth — **surface-only** unless bugs found during pass.
