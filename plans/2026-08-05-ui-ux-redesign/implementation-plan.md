# Chaeboxi UI Redesign — Implementation Plan

**Status:** Ready for implementation  
**Design contract:** `plans/2026-08-05-ui-ux-redesign/mock-dark-shell.html`  
**North star:** Grok + ChatGPT chat DNA, Chaeboxi “studio rail” identity  
**Scope:** Desktop/web chat shell first; mobile inherits tokens, layout remains responsive  

---

## 1. Locked design decisions (do not reopen)

| Decision | Value |
|---|---|
| Theme priority | Dark-first; light theme updated later to match tokens |
| Accent | Solid indigo `#5b63d4` (blue-lean, not magenta) |
| Gradients | **None** (no purple glows, no soft AI gradients) |
| Surfaces | Lifted dark: void `#121214`, rail `#16161a`, panel `#1c1c21`, lift `#24242b` |
| Typography | Satoshi (UI) + JetBrains Mono (meta/kbd); base **16px**, LH 1.55 |
| Radius | Tight: 7 / 9 / 11px — not over-round AI pills |
| Content column | Shared `--col: 48rem` + `--col-pad-x: 1.5rem` for **thread + composer** |
| Messages | Assistant: open prose full column; User: right-aligned pill; no “You/Chaeboxi” labels |
| Actions | Hover-only icon strip; GPU-safe (opacity/transform, not max-height) |
| Chrome | No topbar bottom border; no dock shadow / border-top |
| Keyboard | **Enter** send; **Shift+Enter** and **⌥/Alt+Enter** newline (default) |
| MUI | No new MUI styling; restyle via CSS tokens + Mantine/Tailwind; leave MUI structure until a later cleanup |
| Film grain | Optional subtle texture OK in mock; **skip or optional flag** in production (perf/a11y) |

---

## 2. Goals & non-goals

### Goals
1. Ship the approved shell look: rail + topbar + thread + composer.
2. One shared content column so messages and input align.
3. Dark palette + indigo brand wired through existing `--chatbox-*` → Mantine bridges.
4. Preserve all behavior (sessions, send, tools, MCP, forks, settings).
5. Keep mobile usable via tokens; no mobile-first redesign this pass.

### Non-goals (this plan)
- Full MUI removal / Mantine-only migration
- Settings pages visual redesign (beyond brand tokens)
- Image-creator / copilots / knowledge-base deep restyle
- New product features (search UX beyond visual, new account system)
- Formal design-system package extraction beyond CSS tokens + short design doc

---

## 3. Architecture approach

```
globals.css tokens  ──► Mantine theme (__root)  ──► components
                   └──► Tailwind utilities
                   └──► residual MUI palette (useAppTheme) for unmigrated surfaces
```

**Principle:** Map mock tokens onto existing `--chatbox-*` names so most components pick up the new look without a rewrite. Then restyle the high-traffic shell surfaces to match mock structure.

**Source of truth order:**
1. Mock HTML (visual acceptance)
2. `docs/design-guidelines.md` (written in Phase 0)
3. CSS variables in `globals.css`

---

## 4. Phases

### Phase 0 — Design contract & docs
**Goal:** Freeze tokens and acceptance criteria so implementers don’t invent values.

**Deliverables**
- `docs/design-guidelines.md` — palette, type, spacing, column rules, keyboard map, anti-patterns
- `plans/2026-08-05-ui-ux-redesign/plan.md` + phase files (project plan copy)
- Token table extracted from mock `:root`

**Acceptance**
- Every mock CSS variable has a named production token mapping
- Anti-patterns listed: gradients, letter avatars as brand, Inter/Jakarta, huge radius, dual columns for composer vs thread

---

### Phase 1 — Design tokens & theme plumbing
**Goal:** Global dark/light colors, fonts, radius, brand indigo land without layout changes.

**Files (primary)**
- `src/renderer/static/globals.css` — remapped dark (and light-pass) `--chatbox-*`
- `src/renderer/routes/__root.tsx` — Mantine `createTheme` fontFamily, radius, default props if needed
- `src/renderer/hooks/useAppTheme.ts` — MUI dark `background.default/paper` → `#121214` / `#1c1c21`
- `src/renderer/index.html` / `index.ejs` (or font loading path) — Satoshi + JetBrains Mono
- Optional: `src/renderer/static/fonts/` self-host if CDN undesirable for desktop

**Token mapping (mock → existing)**

| Mock | Production |
|---|---|
| `--void` | `--chatbox-background-primary` (dark) |
| `--rail` | new or secondary surface token; sidebar bg |
| `--panel` / `--lift` | `--chatbox-background-secondary` / tertiary |
| `--ink` / `--ink-2` / `--ink-3` | `--chatbox-tint-primary/secondary/tertiary` |
| `--line` / `--line-2` | `--chatbox-border-primary/secondary` |
| `--indigo` | `--chatbox-tint-brand` + brand backgrounds |
| `--r` / `--r-md` / `--r-lg` | tighten `--chatbox-radius-*` |

**Also set**
- `--col: 48rem` and `--col-pad-x: 1.5rem` on `:root` for shared layout
- `--ease` cubic-bezier for transitions
- Focus ring: indigo outline

**Acceptance**
- `pnpm dev:web` dark mode shows indigo primary buttons/links, darker void bg
- No broken light mode (usable even if not pixel-perfect)
- Fonts load without FOIT blocking chat

**Risks**
- Many hard-coded hex in components — accept residual until later phases
- Brand blue→indigo may surprise screenshots/docs; expected

---

### Phase 2 — App shell layout
**Goal:** Grid shell, scroll/flex fix, header/topbar chrome matches mock.

**Files**
- `src/renderer/routes/__root.tsx` — main shell grid (sidebar + main), overflow, min-height 0
- `src/renderer/components/layout/Header.tsx` — remove bottom divider; quieter controls; title treatment
- `src/renderer/components/layout/Toolbar.tsx` — spacing/icons to match
- `src/renderer/components/layout/Page.tsx` — content area flex column
- `src/renderer/routes/session/$sessionId.tsx` — flex: message list grows, dock pinned (`min-height: 0`, `overflow: hidden` on scroll parent)
- `src/renderer/routes/index.tsx` — empty/home composer same column rules

**Layout rules (from mock)**
```
.shell: grid [rail | main]
.main: flex column; min-height: 0
.thread: flex 1 1 0; min-height: 0; overflow auto
.dock: flex-none; no border-top; no shadow
.thread-inner / .dock-inner: max-width var(--col); padding-inline var(--col-pad-x); margin-inline auto
```

**Acceptance**
- Long threads scroll; composer always visible
- Thread content left edge aligns with composer left edge
- No topbar hairline / dock elevation

---

### Phase 3 — Sidebar (“studio rail”)
**Goal:** Rail looks like mock: wordmark, New chat, find, day groups, active row, compact user footer.

**Files**
- `src/renderer/Sidebar.tsx` — structure, padding, New chat CTA, footer account area
- `src/renderer/components/session/SessionList.tsx` — day/section headers (mono uppercase)
- `src/renderer/components/session/SessionItem.tsx` — active indigo bar + wash; hover; no heavy avatar chrome if present
- `src/renderer/components/session/FolderItem.tsx` — match list density
- Account menu: compact avatar + name → dropdown (settings, theme if present, about) — reuse existing settings/nav actions

**Visual details**
- Rail bg `--rail`, border-right only
- Active session: left 2px indigo + `--indigo-lo` bg
- New chat: solid indigo full-width, optional kbd hint
- Footer: compact, not a tall “AI studio” card; menu opens upward

**Acceptance**
- Side-by-side mock vs app: rail density and hierarchy match
- Resize/collapse still works; mobile drawer still works
- All existing session actions (star, archive, delete, folder) remain reachable

---

### Phase 4 — Message thread (Grok/ChatGPT DNA)
**Goal:** Message chrome matches mock; labels/avatars simplified; hover actions.

**Files**
- `src/renderer/components/chat/Message.tsx` — layout, bubbles, actions visibility
- `src/renderer/components/chat/MessageList.tsx` — column wrapper, spacing between turns
- `src/renderer/components/common/Avatar.tsx` — smaller/optional; assistant mark restrained
- `src/renderer/static/Block.css` — code/md blocks if needed
- `src/renderer/components/search/FollowUpSuggestions.tsx` — chip style under assistant
- Related: `MessageErrTips`, `MessageLoading`, `SummaryMessage` for consistency

**Behavior/UI rules**
- Remove visible “You” / “Chaeboxi” name labels in normal chat
- User: right-aligned pill (`max-width` ~85% of column), soft lift bg
- Assistant: left-aligned open prose, no bubble box (or very subtle)
- Actions: icon row under message, opacity 0 → 1 on hover/focus-within; always visible for generating/error if needed
- No animating max-height for actions
- Column: messages constrained by same `--col` / pad as composer

**Acceptance**
- Visual parity with mock thread
- Copy/regenerate/edit/delete still work
- Tool/reasoning/artifact blocks remain readable
- Focus keyboard users can reach actions

---

### Phase 5 — Composer (InputBox dock)
**Goal:** Composer full column width, flat dock, Grok-like input card.

**Files**
- `src/renderer/components/InputBox/InputBox.tsx` — chrome, toolbar, send button
- `src/renderer/components/InputBox/actionIconStyles.ts` — quiet icon buttons
- Attachments / model selector / MCP menus — visual only, keep APIs
- Default shortcut: ensure `Enter` send is default; document Shift+Enter + Alt+Enter newline

**Visual details**
- Dock: transparent / void bg; no top border; no shadow
- Input card: panel bg, subtle border, radius md, full `--col` width
- Send: indigo circular/square control bottom-right of card
- Tool row: low-contrast icons inside card

**Keyboard**
- Confirm settings default `shortcuts.inputBoxSendMessage` aligns with Enter-send
- If user has legacy Ctrl+Enter default, migration optional — prefer new default for fresh installs; don’t force-overwrite user setting without care

**Acceptance**
- Composer left/right edges align with assistant prose / user pills column
- Enter sends; Shift/Alt+Enter newline
- Stop / queue / attachments / model switch still work

---

### Phase 6 — Home empty state & secondary polish
**Goal:** Landing (`/`) matches shell; no generic centered AI hero.

**Files**
- `src/renderer/routes/index.tsx`
- Light touch: `modals/Welcome.tsx` only if brand colors clash badly
- Settings shell: rely on Phase 1 tokens; no full redesign

**Acceptance**
- Empty state quiet, editorial, indigo CTA if any
- Settings usable under new brand colors

---

### Phase 7 — QA, docs, cleanup
**Goal:** Verify, document, no regressions.

**Checks**
- `pnpm lint` / `pnpm check` on touched files
- Manual: desktop Tauri + `dev:web`, long thread, small window, RTL if easy
- Compare screenshots to mock (rail, thread, dock alignment)
- Update `docs/design-guidelines.md` with any implementation deltas
- Optional: note in `docs/project-roadmap.md` if it exists later

**Out of phase (backlog)**
- Strip residual MUI usage in Message/Sidebar
- Light theme full redesign
- Mobile-specific spacing pass
- Remove film grain / add optional texture setting

---

## 5. File ownership map (implementation order)

| Order | Area | Key paths |
|---|---|---|
| 0 | Docs/plan | `docs/design-guidelines.md`, `plans/2026-08-05-ui-ux-redesign/*` |
| 1 | Tokens | `static/globals.css`, `__root.tsx` Mantine theme, `useAppTheme.ts`, font links |
| 2 | Shell | `__root.tsx` layout, `Header.tsx`, `session/$sessionId.tsx`, `index.tsx` |
| 3 | Rail | `Sidebar.tsx`, `SessionList.tsx`, `SessionItem.tsx`, `FolderItem.tsx` |
| 4 | Thread | `Message.tsx`, `MessageList.tsx`, `Avatar.tsx`, follow-ups |
| 5 | Composer | `InputBox/*`, shortcut defaults |
| 6 | Polish | empty home, residual hard-coded colors |
| 7 | Verify | lint/typecheck, visual QA |

Avoid parallel edits to the same file; phases 3–5 can use parallel agents only with clear ownership:
- Agent A: Sidebar/*
- Agent B: Message/*
- Agent C: InputBox/*
- Tokens/shell must complete first.

---

## 6. Implementation principles

1. **Tokens first** — prefer CSS variables over one-off class hex.
2. **Structure second** — flex/column alignment bugs before polish.
3. **Visual third** — match mock; don’t invent new patterns.
4. **Behavior frozen** — no session/store API changes unless required for UI (e.g. default shortcut).
5. **No fake data** — real sessions, real messages.
6. **YAGNI** — don’t extract a component library; restyle in place.
7. **MUI** — change colors via theme; don’t introduce new `sx` sprawl.
8. **Test** — no full E2E required; smoke chat send + session switch + settings open.

---

## 7. Acceptance criteria (global)

- [ ] Dark chat UI matches mock: rail, topbar, thread, composer
- [ ] Shared column: thread content and composer share max-width + horizontal padding
- [ ] User messages right-aligned pills; assistant open left prose
- [ ] No You/Chaeboxi labels on normal messages
- [ ] Hover-only message actions without jank
- [ ] No topbar divider; no dock shadow/border
- [ ] Indigo brand, no gradients
- [ ] Satoshi + JetBrains Mono in UI chrome
- [ ] Enter send / Shift|Alt Enter newline (defaults)
- [ ] Long thread: composer stays pinned; scroll works
- [ ] Sidebar session CRUD actions still available
- [ ] `pnpm check` + `pnpm lint` pass for changed code
- [ ] Mobile/web not broken (usable)

---

## 8. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Message.tsx is large / mixed MUI+Mantine | Style via wrappers + CSS classes; minimal JSX restructure |
| Flex scroll regressions | Phase 2 dedicated fix; test long threads early |
| Hard-coded blues remain in settings | Phase 1 tokens fix most; spot-fix settings after |
| Font CDN offline in desktop | Prefer self-host woff2 under `static/fonts` |
| User shortcut preference conflict | Only change **default** for new users; document |
| Scope creep into full MUI removal | Explicit non-goal; log backlog only |

---

## 9. Suggested execution cadence

1. **Day 1:** Phase 0–1 (tokens + fonts) — unlocks everything  
2. **Day 2:** Phase 2–3 (shell + rail)  
3. **Day 3:** Phase 4–5 (thread + composer) — highest visual impact  
4. **Day 4:** Phase 6–7 (polish, QA, docs)  

Can compress if one engineer owns tokens→shell then parallelizes rail/thread/composer.

---

## 10. Definition of done

Implementation is done when a reviewer can open the app next to `mock-dark-shell.html` and agree:

> “Same product chrome; real data; no obvious AI-template tells.”

Not done if only colors change but column alignment, labels, or dock chrome still mismatch.

---

## 11. Unresolved / confirm at kickoff

1. **Fonts:** CDN vs self-host Satoshi (license: Fontshare free for commercial — OK)?  
2. **Film grain:** omit in production (recommended) or optional CSS class?  
3. **Default send shortcut migration:** new users only vs force Enter-send for everyone?  
4. **Light theme:** minimal token remap only this sprint, or defer entirely?  
5. **Account dropdown contents:** map only to existing routes (settings, about, theme) — any extra items?

Recommend defaults: self-host fonts if easy, omit grain, new-users-only shortcut default, light = token remap only, account menu = existing actions.

---

## 12. Next step after plan approval

Start **Phase 0 + Phase 1** in the main workspace (not mock-only): write `docs/design-guidelines.md`, update `globals.css` tokens, wire fonts, then shell layout.

Reference mock throughout:  
`plans/2026-08-05-ui-ux-redesign/mock-dark-shell.html`
