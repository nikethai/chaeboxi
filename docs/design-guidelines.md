# Chaeboxi Design Guidelines

**Status:** Active design contract for the UI redesign  
**Visual source of truth:** `plans/2026-08-05-ui-ux-redesign/mock-dark-shell.html`  
**Last updated:** 2026-08-09

## Product intent

Desktop AI copilot chrome that feels like a focused studio tool — Grok + ChatGPT conversation DNA, not a generic “AI SaaS” template.

**Blank / empty chat:** Gemini-quiet first paint — one short centered greeting + composer **vertically centered**. No chips/tags/manifesto, no agents combobox on blank (use `@` in composer or deep-link). On first send: greeting fades, dock eases to bottom (~420ms), then session thread loads with dock pinned bottom.

## Locked decisions

| Token / rule | Value |
|---|---|
| Theme priority | Dark-first |
| Accent | Solid indigo `#5b63d4` (blue-lean) |
| Gradients | **None** on chrome (no purple glows, soft AI washes) |
| Void / rail / panel / lift | `#121214` / `#16161a` / `#1c1c21` / `#24242b` |
| Ink | `#ececec` / `#a8a8ae` / `#6e6e76` / `#4a4a52` |
| Lines | `#2a2a32` / `#36363f` |
| Radius | 7px / 9px / 11px (tight, not over-round) |
| Type | Satoshi (UI) + JetBrains Mono (meta/kbd); base 16px; LH ~1.55 |
| Content column | `--chatbox-col: 48rem` + `--chatbox-col-pad-x: 1.5rem` shared by blank home, thread + composer |
| Dock pad | `--chatbox-dock-pad-y` / `--chatbox-dock-pad-b` on `.session-dock-pad` (home + session) |
| Messages | Assistant open prose full column; user right-aligned pill; no “You/Chaeboxi” labels |
| Thinking | Grok plain text: “Worked for 3s ›” — no card border; expand for body; **status preview only while streaming + collapsed** (never duplicate body) |
| Tools UI | Quiet header when all succeed; attention chips only on fail/running; expanded tools as soft timeline steps (no heavy card borders) |
| Actions | Hidden by default; full opacity on hover; last assistant message always visible (`is-visible`); opacity/transform only |
| Chrome | No topbar bottom border; no dock `border-top` |
| Composer | Resting **layered box-shadow** (theme tokens); no hard border; no brand ring at rest; no gradient glow |
| Composer hover/focus | Soft ambient lift (`--chatbox-composer-shadow-hover` / `-focus`); brand mix ≤~20%; no neon wash |
| Code fences | Theme-following shell (`.code-fence`); quiet mono lang chip; actions fade in on hover/focus |
| Session rename | Inline header rename (pencil / double-click); full config via **Session options** progressive disclosure |
| Session overflow menu | Title Case labels; grouped; danger separated; full-width lives in overflow (not empty toolbar icon) |
| Projects | Always-visible section (even when empty); section-like folder rows; hover-only project `+` + New Chat in menu; New Project on section trail **and** rail-tools |
| Recents | Unfiled chats (`folderId` empty) — **not** a synthetic project; day groups + optional coaching when many unfiled; drag chat onto project / Recents |
| Composer tools | Single **`+` overflow** (click-primary) for attach / web / MCP / KB / agent / thread / settings — not always-on icon rail |
| Auto tools | Web search **default ON** when configured; MCP tools from **enabled servers** always attached for tool-capable models; agent mode **opt-in**; KB **explicit select** |
| Telemetry | Session statusline is SoT for tok/$/msg; **no composer token chip**; click statusline `tok` for compress / auto-compaction |
| Rail brand | Left-aligned `ChaeboxiWordmark`; no collapse control in brand row (hide via menu / resizer double-click) |
| Projects | User-facing “Project” (storage may stay `Folder`); shared outline icon; **no emoji UI**; never invent system “Uncategorized” folder |
| Keyboard | Enter send; Shift+Enter and Alt+Enter newline (default send is Enter) |
| Film grain | Mock only — **omit** in production |

## CSS token map (mock → production)

| Mock | Production CSS variable |
|---|---|
| `--void` | `--chatbox-background-primary` (dark) |
| `--rail` | `--chatbox-background-rail` |
| `--panel` | `--chatbox-background-secondary` |
| `--lift` | `--chatbox-background-tertiary` / hover lifts |
| `--ink` / `--ink-2` / `--ink-3` | `--chatbox-tint-primary` / secondary / tertiary |
| `--line` / `--line-2` | `--chatbox-border-primary` / secondary |
| `--indigo` | `--chatbox-tint-brand` + brand background tokens |
| `--col` / `--col-pad-x` | `--chatbox-col` / `--chatbox-col-pad-x` |
| `--font` / `--mono` | body font-family / `--chatbox-font-mono` |

## Layout rules

```
shell: sidebar | main
main: flex column; min-height: 0
thread: flex 1 1 0; min-height: 0; overflow auto
dock: flex-none; no border-top
.session-dock-pad: horizontal --chatbox-col-pad-x + bottom breathing room
.chat-col: max-width var(--chatbox-col); margin-inline auto
.blank-workbench: max-width var(--chatbox-col) (same measure as composer)
```

Blank home, thread content, and composer left edges **must** align.

## Composer pickers (@ / $ / /)

- **Portal** pickers to `document.body` via `ComposerPickerPanel` — never absolute children clipped by `.blank-home` / page `overflow: hidden`.
- Anchor to `.composer-card` rect; prefer **above** the composer; flip **below** when headroom &lt; ~120px.
- Cap height (~320px) with internal scroll; short lists pin to the composer edge.
- Empty catalog (zero agents/skills/commands) → quiet empty + primary CTA into Settings (`/agents`, `/skills`, `/commands`).
- Filter miss only → “No … found” without CTA.
- Surface: layered shadow + soft hairline (not hard double borders). Light + dark both.

## Rail edge

- Soft separation: hairline mix ≤~7–8% ink + ambient shadow (`--chatbox-rail-edge-shadow`) — **not** a hard full-height double border.
- Resizer: invisible 8px hit strip; 1–2px brand hairline only on hover/drag.

## Settings surfaces

- Same studio tokens as chat (void/rail/panel, 7–9–11 radius, indigo accent, no gradients).
- **Layout language:** studio preference panels (Linear/Cursor DNA), not admin form stacks.
- Content measure: `SettingsPage` default max-width **40rem**; catalogs/MCP use `wide` (~56rem).
- Section micro-label (uppercase, tertiary) **above** a single soft `SettingsCard`.
- Toggles / single selects → `SettingsPrefRow` (title + helper left, control right) inside `SettingsCard divided`.
- Multi-field groups → stacked fields inside a padded card (`settings-card-fields`).
- **Progressive disclosure:** advanced / optional blocks use `SettingsCollapsible` (collapsed by default; open when already configured). Keep primary setup (connection, name, essentials) always visible.
- Sticky save/cancel footers on long forms when needed.
- Primitives: `SettingsPage`, `SettingsPageHeader`, `SettingsSection`, `SettingsCard`, `SettingsPrefRow`, `SettingsCallout`, `SettingsCollapsible`.
- Callouts: quiet brand-tinted; avoid solid light-blue Alert slabs as primary hierarchy.
- Nav edge matches rail language (soft shadow, not hard rule).
- Forms: min control height ~40px; press scale on primary buttons where appropriate.
- QA both **light and dark**.

## Anti-patterns

- Gradients on shell, CTA, or brand wash
- Inter / Plus Jakarta / system-AI default stacks as primary UI font
- Huge pill radius (24px+) on chat chrome
- Separate max-widths for blank home / messages vs composer
- Always-visible dense action toolbars on every message
- Always-visible multi-icon composer capability rail (use single `+` overflow)
- Composer token chip duplicating statusline telemetry
- Letter-circle avatars as brand identity
- Heavy dividers under topbar / above dock
- Solid primary-colored resting border on composer
- Brand/indigo outer glow or gradient wash on composer
- Emoji as project icons or product chrome icons
- Collapse control next to product wordmark
- Requiring users to enable web/MCP per turn when already configured

## Keyboard

| Action | Default |
|---|---|
| Send | Enter |
| Newline | Shift+Enter (native) or Alt+Enter |
| Send without generate | Ctrl+Enter (existing setting) |

Do not force-overwrite users who already customized `shortcuts.inputBoxSendMessage`. Fresh defaults remain Enter.

## Implementation notes

- Prefer CSS variables over hard-coded hex in components.
- Restyle via tokens + Tailwind/Mantine; avoid new MUI `sx` sprawl.
- MUI remains for some legacy surfaces; theme palette should track dark tokens.
- `widthFull` UI preference may bypass max-width but keeps horizontal padding.

## Acceptance

Open the app next to `mock-dark-shell.html`. Rail, thread, and composer should read as the same product chrome with real data.
