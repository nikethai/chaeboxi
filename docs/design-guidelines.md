# Chaeboxi Design Guidelines

**Status:** Active design contract for the UI redesign  
**Visual source of truth:** `plans/2026-08-05-ui-ux-redesign/mock-dark-shell.html`  
**Last updated:** 2026-08-05

## Product intent

Desktop AI copilot chrome that feels like a focused studio tool — Grok + ChatGPT conversation DNA, not a generic “AI SaaS” template.

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
| Projects | Section-like folder rows; hover-only `+` on desktop; New Chat also in menu |
| Composer tools | Single **`+` overflow** (click-primary) for attach / web / MCP / KB / agent / thread / settings — not always-on icon rail |
| Auto tools | Web search **default ON** when configured; MCP tools from **enabled servers** always attached for tool-capable models; agent mode **opt-in**; KB **explicit select** |
| Telemetry | Session statusline is SoT for tok/$/msg; **no composer token chip**; click statusline `tok` for compress / auto-compaction |
| Rail brand | Left-aligned `ChaeboxiWordmark`; no collapse control in brand row (hide via menu / resizer double-click) |
| Projects | User-facing “Project” (storage may stay `Folder`); shared outline icon; **no emoji UI** |
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
