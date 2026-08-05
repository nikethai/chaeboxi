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
| Content column | `--chatbox-col: 48rem` + `--chatbox-col-pad-x: 1.5rem` shared by thread + composer |
| Messages | Assistant open prose full column; user right-aligned pill; no “You/Chaeboxi” labels |
| Actions | Hover-only icon strip; opacity/transform only (no max-height jank) |
| Chrome | No topbar bottom border; no composer dock shadow / border-top |
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
dock: flex-none; no border-top; no shadow
.chat-col: max-width var(--chatbox-col); padding-inline var(--chatbox-col-pad-x); margin-inline auto
```

Thread content left edge **must** align with composer left edge.

## Anti-patterns

- Gradients on shell, CTA, or brand wash
- Inter / Plus Jakarta / system-AI default stacks as primary UI font
- Huge pill radius (24px+) on chat chrome
- Separate max-widths for messages vs composer
- Always-visible dense action toolbars on every message
- Letter-circle avatars as brand identity
- Heavy dividers under topbar / above dock
- Drop shadows on the composer dock

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
