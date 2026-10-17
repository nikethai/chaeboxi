---
type: plan
status: draft
description: "Slice 1b of the redesign: the shared pieces later slices import: Sheet with focus rules, undo with a 5 s toast and ⌘Z, the eight-state Mascot, the Review entries store, BackgroundJob types and the /new route"
generated: { by: claude/opus-5.5, at: 2026-10-17T19:00:00+07:00 }
---
# Slice 1b: Shared Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every later slice can import a working `Sheet`, undo with its toast and ⌘Z, the `Mascot`, the Review entries store with its openers and renderers, the `BackgroundJob` types and `startNewChat` / `/new`, with the names the roadmap's contract register gives them.

**Architecture:** Three small packages and three components, each with one job. `packages/undo/` holds undo records in a zustand vanilla store, with a toast component and a hotkey hook mounted once in the root route. `packages/review/` persists `ReviewEntry` rows under one storage key through a single promise queue that reads storage fresh before each write, so two windows never overwrite each other; openers and renderers are registries that other slices fill. `Sheet` and `Mascot` render the `dg-sheet*` and `dg-mascot` classes slice 1 shipped; the few rules those classes lack go in one new stylesheet. Today's new-chat page moves unchanged to `/new`, and `/` redirects there until slice 5 makes it Review.

**Tech Stack:** React 18, TanStack Router 1.x (file routes, generated `routeTree.gen.ts`), zustand 5 (`createStore` + `useStore`), Zod 4, jotai, Vitest 4 (+ jsdom, Testing Library 14), postcss (CSS assertions), Biome.

**Spec:** `docs/specs/2026-10-17-redesign-roadmap.md` (Shared types, Contract register: rows owned by 1b), `docs/specs/2026-10-16-ux-flows.md` (conventions line 12, flow 3 keys, flow 16 Undo, Accessibility A11Y1 line 217, Dark mode line 216), `design/dango/README.md` (Voice, Layout, Motion, The mascot), design-system component notes Sheet, Toast and Mascot (`project/components/<Name>/README.md` and `preview.html` in artifact `C7dPipWhJubTMddvKR7C3W`; the values this plan needs from them are copied below).

## Global Constraints

- Needs slice 1 (merged): `dango-tokens.css`, `dango-components.css` (`dg-sheet-scrim`, `dg-sheet`, `dg-sheet__actions`, `dg-sheet__hint`, `dg-toast`, `dg-kbd`, `dg-link`, `dg-btn--primary`, `dg-mascot` with `.body .eye .stroke-eye .accent .ring .ring-track .alert .mark .ink-stroke`), `components/review/ReviewItem.tsx`. Nothing else.
- Names, signatures and paths are the register's. This plan adds only optional fields and helpers, listed in each task's Interfaces: Sheet `hint?`; `pushUndo` `extra?`; `canUndo`, `undoStore`, `DEFAULT_UNDO_MS`; `loadReviewEntries`, `waitingCount`, `hasReviewOpener`, `getReviewRenderer`, `useReviewRenderer`, `setReviewStorageForTests`; `MASCOT_STATE_LABEL`, `useReducedMotion`; `isEditableTarget`; `NewChatSearchSchema`, `seedNewChatSession`.
- Later slices import from here and never re-create these files: 2 (Trust sheet on `Sheet`), 4 (knowledge undo through `pushUndo` with `group: 'knowledge'`, renderers for `proposal`/`conflict`/`re-check`), 5 (feed, Trust arrival inside `addReviewEntry`, `/` = Review), 6a/6b (`Mascot`, undo for chat delete, cost sheet), 7 (`BackgroundJob` fields, `setLastCheckedAt`), 9 (inspector sheet with `side: 'right'`).
- Undo: 5 000 ms by default, one toast at a time, bottom-centre, a new toast replaces the old (the old change stands). ⌘Z on macOS, Ctrl+Z elsewhere, never with Shift or Alt, never while focus is in an input, textarea, select or contenteditable. Send and delete-forever never get an undo (callers' rule; README Toast note).
- Sheets: rise from the bottom over the scrim; title states what will happen; primary action on the right; first focus `[data-autofocus]`, else the primary action; Tab stays inside; Esc closes and returns focus; never stack two (the topmost one alone reacts to keys).
- Mascot: viewBox `0 0 64 64`, colours only through `dg-mascot` classes (body `--dango-ink`, eyes `--dango-ground`, so dark mode gives a light body with dark eyes), sizes 16, 20, 22, 24, 28, 40, 56. Motion only in idle (blink), thinking and replying (dots), working (ring). With `prefers-reduced-motion: reduce` the mascot holds its idle pose and writes its state as text (ux-flows line 217).
- Storage: `StorageKey.ReviewEntries = 'review-entries'`, written with `setItemNow`. Not file-backed (`needStoreInFile` at `platform/desktop_platform.ts:137` is unchanged), so IndexedDB on desktop, shared by the main and Quick Chat windows. New key, no migration, `CurrentVersion` stays 17 (`.claude/skills/dango-storage-migration`).
- New CSS goes in one new file, `src/renderer/static/dango-foundations.css`, imported in `src/renderer/index.tsx:16` right after `dango-components.css`, using only `--dango-*` variables; `dango-components.css` stays a verbatim copy.
- Copy is sentence case, no emoji. Exact: `Undo`, `⌘Z` / `Ctrl+Z`; mascot labels `Assistant, idle` … `Assistant, needs you` (state words: Idle, Thinking, Replying, Working, Needs you, Done, Asleep, Stuck). Plan-chosen (spec silent): `Couldn't undo. The change stays.` New strings go through `t()` with English entries in `src/renderer/i18n/locales/en/translation.json`.
- Out of this slice: Trust arrival and the Trust sheet (2, 5); the Review feed, its keys and per-kind actions, `/` as Review (5); knowledge undo pre-images and the rule that a conflict closes the proposals it names (4); the background job runner and retries (7); moving existing modals onto `Sheet` (9); the MUI `Toasts` stay for plain toasts.

## Review Focus

1. ⌘Z typed in the composer (a contenteditable), a textarea or an input must do the field's own undo and never reverse a Dango action. Pinned in Task 3.
2. Clicking Undo and pressing ⌘Z together, or double-clicking Undo, must run the undo exactly once; an undo that throws must say so instead of looking done. Pinned in Task 2.
3. An entry added before the store has loaded, two adds at once, or a write from the Quick Chat window between this window's load and its next write must not lose any row. Pinned in Task 5.
4. Esc pressed in a control inside a sheet that handles Esc itself (an open Select) must close only that control; when the element that opened the sheet is gone, focus lands on `#main` (slice 9 adds it), not on nothing. Pinned in Task 1.
5. An old link or bookmark to `/?copilotId=x`, and startup on `/`, must land on `/new` with the agent preselected; `startNewChat({ prefill })` while `/new` is already open must show the new draft. Pinned in Task 7.

---

### Task 1: Sheet and useSheetFocus

**Files:**
- Create: `src/renderer/components/ui/Sheet.tsx`, `src/renderer/components/ui/useSheetFocus.ts`, `src/renderer/static/dango-foundations.css`
- Modify: `src/renderer/index.tsx:16` (import `./static/dango-foundations.css` after `dango-components.css`)
- Test: `src/renderer/components/ui/Sheet.test.tsx` (jsdom)

**Interfaces:**
- Produces:
  ```ts
  export type SheetProps = { opened: boolean; onClose: () => void; title: string; children?: ReactNode; actions?: ReactNode; side?: 'bottom' | 'right'; hint?: ReactNode }
  export function Sheet(props: SheetProps): JSX.Element | null
  export function useSheetFocus(ref: RefObject<HTMLElement | null>, opts: { onClose: () => void }): void
  ```
- `Sheet` renders nothing when closed. Open, it portals to `document.body`: `div.dango-sheet-layer` holding `div.dg-sheet-scrim` (`aria-hidden`, click calls `onClose`) and `section.dg-sheet` (`dango-sheet--right` when `side === 'right'`) with `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing at its `h2` (`useId`), then `children`, then `span.dg-sheet__hint` when `hint` is given, then `div.dg-sheet__actions` with `actions`. Consumers mark the primary button `dg-btn dg-btn--primary` and put it last.
- `useSheetFocus` runs while the element is mounted. On mount: remember `document.activeElement`, push the element on a module-level stack of open sheets, focus `[data-autofocus]` inside it, else `.dg-btn--primary`, else the first tabbable, else the element itself (`tabIndex = -1`). One `keydown` listener on `document` (bubble phase, so React handlers inside the sheet, which React attaches to the portal container `body`, run first) acts only when this element is the top of the stack: Esc, unless `event.defaultPrevented`, calls `preventDefault()`, `stopPropagation()` (window listeners such as Settings' close-on-Esc at `routes/settings/route.tsx:220-233` never see it) and `onClose()`; Tab / Shift+Tab wrap from last to first and first to last, and pull focus back in when it is outside. On unmount: pop the stack, then focus the remembered element if `isConnected`, else `document.getElementById('main')` if present. Tabbable = `a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]` (no layout checks: jsdom has none).
- CSS in `dango-foundations.css`: `.dango-sheet-layer { position: fixed; inset: 0; z-index: 400 }`; `.dango-sheet--right { left: auto; right: 0; top: 0; bottom: 0; transform: none; width: clamp(380px, 36vw, 460px); max-width: 100%; border-radius: var(--dango-radius-sheet) 0 0 var(--dango-radius-sheet) }`; a 150 ms rise for `.dg-sheet` (from `translate(-50%, 16px)`, opacity 0) and slide for `.dango-sheet--right` (from `translateX(16px)`); both off under `@media (prefers-reduced-motion: reduce)`.

- [ ] **Step 1: Write the failing tests** in `Sheet.test.tsx`, with a test sheet titled `Dango wants to edit 3 files`, an input, and actions `Not now` (`dg-btn dg-btn--ghost`), `Always in this scope` (`dg-btn`), `Allow once` (`dg-btn dg-btn--primary`):
  - `renders a labelled modal dialog in body`: `getByRole('dialog', { name: 'Dango wants to edit 3 files' })` has `aria-modal="true"`, class `dg-sheet`, and its parent chain reaches `document.body` outside the render container; `opened: false` renders no dialog; `side="right"` adds `dango-sheet--right`; `hint="Esc closes"` renders `.dg-sheet__hint`.
  - `first focus is the primary action`: `Allow once` has focus; with `data-autofocus` on the input, the input has focus.
  - `tab stays inside`: Tab on `Allow once` focuses the input (first tabbable); Shift+Tab on the input focuses `Allow once`.
  - `esc closes and returns focus`: an opener button is focused, the sheet opens, Esc calls `onClose` once, a `window` keydown spy sees no Escape; rerender with `opened: false` → the opener has focus.
  - `opener gone → #main`: a `<main id="main" tabIndex={-1}>` exists, the opener is removed before closing → `#main` has focus.
  - `inner Esc handler wins`: the input's React `onKeyDown` calls `preventDefault()` on Escape → `onClose` not called.
  - `only the top sheet reacts`: two sheets open, the second opened last; Esc calls the second's `onClose` only.
  - `scrim click closes`: clicking `.dg-sheet-scrim` calls `onClose`.
  - `css`: postcss over `dango-foundations.css`: `.dango-sheet-layer` declares `position: fixed`; inside `@media (prefers-reduced-motion: reduce)` a rule whose selector includes `.dg-sheet` sets `animation: none`; no declaration value in the file contains `#` followed by a hex digit (tokens only).
- [ ] **Step 2: Run** `pnpm test -- src/renderer/components/ui/Sheet.test.tsx`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement** `useSheetFocus`, `Sheet`, the stylesheet and its import.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(ui): Sheet with focus trap, Esc and focus return`.

### Task 2: Undo records

**Files:**
- Create: `src/renderer/packages/undo/undo.ts`, `src/renderer/packages/undo/index.ts`
- Test: `src/renderer/packages/undo/undo.test.ts` (node, fake timers, `@/stores/toastActions` mocked)

**Interfaces:**
- Consumes: `add(content: string, duration?: number)` from `@/stores/toastActions`; `t` from `i18next`.
- Produces:
  ```ts
  export const DEFAULT_UNDO_MS = 5_000
  export type UndoGroup = 'knowledge' | 'other'
  export type UndoInput = { message: string; undo: () => void | Promise<void>; group?: UndoGroup; silent?: boolean; durationMs?: number; extra?: { label: string; onClick: () => void } }
  export type UndoToastState = { id: string; message: string; until: number; extra?: UndoInput['extra'] }
  export const undoStore: StoreApi<{ toast?: UndoToastState }>
  export function pushUndo(input: UndoInput): string // record id
  export function canUndo(id: string): boolean
  export function undoEntry(id: string): Promise<boolean>
  export function undoLatest(): Promise<boolean>
  export function resetUndoForTests(): void
  ```

Rules. A record is live while `Date.now() < until` (`until = now + (durationMs ?? DEFAULT_UNDO_MS)`), it has not started running, and it is not retired. Pushing a `'knowledge'` record retires every earlier `'knowledge'` record, because slice 4 keeps only the latest knowledge pre-image; `'other'` records (the default group) never retire each other. `undoEntry` marks the record as started before awaiting `undo`, so a second call returns `false` at once; it resolves `true` when `undo` settles, and `false` after calling `toastActions.add(t("Couldn't undo. The change stays."))` when `undo` throws. `undoLatest` runs the newest live record that is not `silent` (silent records are for rows that carry their own Undo button, such as Trust Auto arrivals in slice 5, and are never reached by ⌘Z). The toast state is the latest non-silent record; a silent push leaves it alone; it clears when that record runs, is retired, or reaches `until` (a `setTimeout` set by `pushUndo`). The `extra` link never runs as part of an undo.

- [ ] **Step 1: Write the failing tests** in `undo.test.ts` (`vi.useFakeTimers()`, `vi.setSystemTime(0)`, `resetUndoForTests()` in `beforeEach`):
  - `expires after 5 s`: `canUndo(id)` is true at 4 999 ms and false at 5 000 ms; with `durationMs: 10_000` true at 9 999 ms.
  - `runs once`: `await Promise.all([undoEntry(id), undoEntry(id)])` equals `[true, false]` and `undo` was called once; `undoLatest()` afterwards is `false`.
  - `a failing undo says so`: `undo` rejects → `undoEntry` resolves `false` and `toastActions.add` was called with `Couldn't undo. The change stays.`.
  - `only the newest knowledge record`: push knowledge A, other C, knowledge B → `canUndo(A)` false, `canUndo(B)` and `canUndo(C)` true.
  - `undoLatest skips silent`: push visible V then silent S → `undoLatest()` runs V's `undo`, not S's; with nothing live it returns `false`.
  - `toast follows the latest visible record`: after V, `undoStore.getState().toast` has V's id and `message`; pushing S leaves it; pushing W replaces it with W; after `undoEntry(W)` it is `undefined`; a fresh push clears itself at `until` (advance 5 000 ms).
  - `extra is carried, not run`: `extra.onClick` is never called by `undoEntry` or `undoLatest`, and the toast state carries `extra`.
- [ ] **Step 2: Run** `pnpm test -- src/renderer/packages/undo/undo.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement** `undo.ts` (records in a module array, ids from `uuid` v4; prune dead records on each push) and the barrel.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(undo): undo records with one live knowledge undo`.

### Task 3: Undo toast and ⌘Z, mounted once

**Files:**
- Create: `src/renderer/packages/undo/UndoToast.tsx`, `src/renderer/packages/undo/useUndoHotkey.ts`, `src/renderer/utils/isEditableTarget.ts`
- Modify: `src/renderer/packages/undo/index.ts` (export both), `src/renderer/routes/__root.tsx:229` (`<UndoToast />` right after `<Toasts />`), `:238` (`useUndoHotkey()` right after `useShortcut()`), `src/renderer/static/dango-foundations.css`, `src/renderer/i18n/locales/en/translation.json`
- Test: `src/renderer/packages/undo/UndoToast.test.tsx` (jsdom, `@/packages/navigator` mocked)

**Interfaces:**
- Consumes: `undoStore`, `undoEntry`, `undoLatest`, `canUndo` (Task 2); `getOS()` from `@/packages/navigator`.
- Produces: `UndoToast(): JSX.Element | null`; `useUndoHotkey(): void`; `isEditableTarget(target: EventTarget | null): boolean` (true for `INPUT`, `TEXTAREA`, `SELECT`, and anything inside `[contenteditable]:not([contenteditable="false"])`; reads `closest()` because jsdom lacks `isContentEditable`).
- Markup: `div.dango-toast-host` > `div.dg-toast[role="status"]` holding the message, `button` `Undo` and, on Mac, Windows and Linux only, `span.dg-kbd` `⌘Z` (Mac) or `Ctrl+Z`; when `extra` is set, a separate `button.dg-link` under the toast inside the host. The host renders nothing when there is no toast. Hotkey: one `window` `keydown` listener; `key.toLowerCase() === 'z'`, `metaKey` on Mac or `ctrlKey` elsewhere, no Shift, no Alt, not `defaultPrevented`, `!isEditableTarget(e.target)`; when a non-silent record is live it calls `preventDefault()` and `undoLatest()`.
- CSS: `.dango-toast-host { position: fixed; left: 50%; bottom: var(--dango-space-6); transform: translateX(-50%); z-index: 500; display: flex; flex-direction: column; align-items: center; gap: var(--dango-space-2) }` (above `.dango-sheet-layer`).

- [ ] **Step 1: Write the failing tests** in `UndoToast.test.tsx`:
  - `shows the toast`: with `getOS` → `'Mac'`, after `pushUndo({ message: 'Approved "Launch is 6 Nov" for Acme Co', undo })` the status reads that message, has a button `Undo` and `.dg-kbd` `⌘Z`; with `'Windows'` the hint is `Ctrl+Z`; with `'iOS'` there is no `.dg-kbd`.
  - `undo button runs once and hides`: click `Undo` → `undo` called once, no `.dg-toast` left.
  - `one at a time`: two pushes → one `.dg-toast`, showing the second message.
  - `gone after 5 s`: fake timers, advance 5 000 ms → no `.dg-toast`.
  - `extra link`: with `extra: { label: "Don't suggest this again", onClick }` a separate `.dg-link` button renders; clicking it calls `onClick` and not `undo`; without `extra` there is none.
  - `hotkey`: `renderHook(useUndoHotkey)`; Mac: `keydown { key: 'z', metaKey: true }` on `document.body` calls `undo`; `{ key: 'z', ctrlKey: true }` does not; Windows: `ctrlKey` does. With Shift it does not. Dispatched from an `input`, a `textarea`, and a `span` inside `div[contenteditable="true"]` it does not, and the event is not default-prevented (Review Focus 1). With nothing live, the event is not default-prevented.
  - `mounted once`: reading `routes/__root.tsx` as text, `<UndoToast` and `useUndoHotkey()` each occur exactly once.
  - `css`: `.dango-toast-host` declares `position: fixed` and `bottom: var(--dango-space-6)`.
- [ ] **Step 2: Run** `pnpm test -- src/renderer/packages/undo`. Expected: FAIL on the new file.
- [ ] **Step 3: Implement** the component, the hook, the util, the CSS rule, the root mount and the translation entries (`Undo`, `Couldn't undo. The change stays.`).
- [ ] **Step 4: Run** `pnpm test -- src/renderer/packages/undo` and `pnpm check`. Expected: PASS, no new tsc errors.
- [ ] **Step 5: Commit**: `feat(undo): bottom-centre undo toast and ⌘Z`.

### Task 4: Mascot with eight states and reduced motion

**Files:**
- Create: `src/renderer/components/brand/Mascot.tsx`, `src/renderer/hooks/useReducedMotion.ts`
- Modify: `src/renderer/static/dango-foundations.css`
- Test: `src/renderer/components/brand/Mascot.test.tsx` (jsdom, `window.matchMedia` stubbed)

**Interfaces:**
- Produces:
  ```ts
  export type MascotState = 'idle' | 'thinking' | 'replying' | 'working' | 'needs-you' | 'done' | 'asleep' | 'stuck'
  export type MascotSize = 16 | 20 | 22 | 24 | 28 | 40 | 56
  export const MASCOT_STATE_LABEL: Record<MascotState, string> // Idle, Thinking, Replying, Working, Needs you, Done, Asleep, Stuck
  export function Mascot(props: { state: MascotState; size: MascotSize; label?: string }): JSX.Element
  export function useReducedMotion(): boolean // matchMedia('(prefers-reduced-motion: reduce)') with a change listener; false when matchMedia is missing
  ```
- Renders `svg.dg-mascot` with `role="img"`, `aria-label={label ?? \`Assistant, ${MASCOT_STATE_LABEL[state].toLowerCase()}\`}`, `width`/`height` = `size`, `viewBox="0 0 64 64"`, `data-state={state}`, `data-pose` = the pose drawn. No colour attributes: every fill and stroke comes from the classes. With reduced motion: `data-pose="idle"`, the idle geometry, and after the `svg` a `span.dango-mascot__state` (`aria-hidden`, the label already says it) with `MASCOT_STATE_LABEL[state]`, omitted for `idle`.

Geometry, from the design system's `Mascot/preview.html`. `BODY` = `M8 38 C 8 21, 19 11, 32 11 C 45 11, 56 21, 56 38 C 56 49, 47 54, 32 54 C 17 54, 8 49, 8 38 Z` (class `body`). An eye at (x, y) = `ellipse` class `eye`, `rx 3 ry 4.6`, `transform="rotate(-7 x y)"`. Eyes sit in `g.eyes`, dots in `g.dots`, so CSS animates groups, never the rotated ellipses.

| Pose | Markup |
|---|---|
| idle | `BODY`; eyes (26, 36), (39, 35) |
| thinking | `g transform="translate(-1 5) scale(0.9)"` { `BODY`; eyes (27, 33), (40, 32) }; `g.dots`: `circle.accent` (50, 15) r 2.6; (55, 8.5) r 3.3 opacity 0.7; (59.5, 3) r 1.9 opacity 0.4 |
| replying | `g transform="translate(-2 6) scale(0.82)"` { `BODY`; eyes (26, 36), (39, 35) }; `g.dots`: `circle.body` r 2.6 at (50, 42); (56, 42) opacity 0.6; (62, 42) opacity 0.3 |
| working | `circle.ring-track` (32, 33) r 30 `fill="none"` stroke-width 3; `path.ring` `M32 3 A30 30 0 0 1 61 26` `fill="none"` stroke-width 3 round cap; `g transform="translate(7 8) scale(0.78)"` { `BODY`; eyes (31, 36), (44, 35) } |
| needs-you | `BODY`; eyes (26, 36), (39, 35) with `rx 3.8 ry 5.6`; `circle.alert` (52, 14) r 6 stroke-width 2.5 (the preview's duplicated `class` attribute becomes `alert`; `.alert` already strokes with `ground`) |
| done | `BODY`; `path.stroke-eye` `M21 38.5 q5 -7 10 0 M34 37.5 q5 -7 10 0` `fill="none"` stroke-width 3 round cap |
| asleep | `g transform="translate(0 9) scale(1 0.82)"` { `BODY` }; `path.stroke-eye` `M21 41.5 l9 -1 M34 40.5 l9 -1` stroke-width 3 round cap; `text.mark` `z` at (50, 16), font-size 10, weight 600 |
| stuck | `BODY`; eyes (26, 40), (39, 39); `circle` class `eye ink-stroke` (53, 13) r 7 stroke-width 2; `text.body` `?` at (53, 17), font-size 10, weight 700, `text-anchor="middle"` |

Text uses `font-family="-apple-system, system-ui, sans-serif"`. CSS (tokens only): `dango-blink` on `.dg-mascot[data-pose="idle"] .eyes` (`transform-box: fill-box; transform-origin: center`, scaleY to 0.1 for 150 ms every 4 s); `dango-pulse` on `[data-pose="thinking"] .dots` and `[data-pose="replying"] .dots` (opacity 1 → 0.4, 1.2 s); `dango-spin` on `[data-pose="working"] .ring` (`transform-box: view-box; transform-origin: 32px 33px`, 1.6 s linear); `.dango-mascot__state { font-size: 12px; line-height: 16px; color: var(--dango-muted) }`; inside `@media (prefers-reduced-motion: reduce)`: `.dg-mascot, .dg-mascot * { animation: none }`.

- [ ] **Step 1: Write the failing tests** in `Mascot.test.tsx`:
  - `every state is labelled`: for each of the eight states at `size={24}`: one `svg.dg-mascot`, `role="img"`, `aria-label` `Assistant, idle`, `Assistant, thinking`, `Assistant, replying`, `Assistant, working`, `Assistant, needs you`, `Assistant, done`, `Assistant, asleep`, `Assistant, stuck`; `width="24"`; `label="Dango is thinking"` overrides.
  - `idle geometry`: the `path.body` `d` equals `BODY`; two `ellipse.eye` with `transform` `rotate(-7 26 36)` and `rotate(-7 39 35)`, inside `g.eyes`.
  - `extras per state`: thinking has 3 `circle.accent`; working has `.ring` and `.ring-track`; needs-you has one `circle.alert` and eyes with `rx="3.8"`; asleep has text `z`; stuck has text `?`; done has no `ellipse`.
  - `colours come from the theme`: no element in any state has a `fill` or `stroke` attribute containing `#`.
  - `reduced motion holds the idle pose`: `matchMedia` stubbed to match → `state="working"` has `data-pose="idle"`, no `.ring`, `aria-label` `Assistant, working`, and visible text `Working`; `state="idle"` has no `.dango-mascot__state`. A `change` event on the media query to non-matching re-renders the working pose.
  - `css`: the reduced-motion block in `dango-foundations.css` has a rule whose selector includes `.dg-mascot *` with `animation: none`.
- [ ] **Step 2: Run** `pnpm test -- src/renderer/components/brand`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement** the hook, the component (one small function per pose) and the CSS.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(brand): Mascot with eight states and reduced motion`.

### Task 5: Review entries: types and persisted store; BackgroundJob types

**Files:**
- Create: `src/shared/types/review.ts`, `src/shared/types/background.ts`, `src/renderer/packages/review/store.ts`, `src/renderer/packages/review/index.ts`
- Modify: `src/renderer/storage/StoreStorage.ts:40` (add `ReviewEntries = 'review-entries'` after `ImportedHistory`), `src/renderer/components/review/ReviewItem.tsx:1` (`export type { ReviewKind } from '@shared/types/review'` plus a type import, instead of declaring it)
- Test: `src/renderer/packages/review/store.test.ts` (node), `src/shared/types/background.test.ts`

**Interfaces:**
- Produces (`@shared/types/review`):
  ```ts
  export type ReviewKind = 'proposal' | 'done' | 'needs-you' | 'conflict' | 'change' | 're-check'
  export type ReviewRefType = 'proposal' | 'conflict' | 'change' | 'job' | 'draft' | 'question' | 'setup' | 'chat' | 'knowledge'
  export type ReviewRef = { type: ReviewRefType; id: string }
  export type ReviewState = 'open' | 'done' | 'dismissed'
  export type ReviewOption = { id: string; text: string; source?: string }
  export type ReviewEntry = { id: string; kind: ReviewKind; scopeId: string; source?: string; text: string; sub?: string; ref: ReviewRef
    state: ReviewState; createdAt: number; undoUntil?: number; risk?: 'safe' | 'risky'; actionLabel?: string; options?: ReviewOption[]; resolvedAt?: number }
  export type ReviewEntryInput = Omit<ReviewEntry, 'id' | 'state' | 'createdAt'> & Partial<Pick<ReviewEntry, 'id' | 'state' | 'createdAt'>>
  export const ReviewEntrySchema: z.ZodType<ReviewEntry>
  export const WAITING_KINDS: readonly ReviewKind[] // ['needs-you', 'proposal', 'conflict']
  export const REVIEW_RETENTION_MS = 30 * 24 * 60 * 60 * 1000
  ```
- Produces (`@shared/types/background`), exactly the roadmap's two lines: `BackgroundJob` and `RETRY_DELAYS_MS = [10_000, 60_000, 300_000] as const`.
- Produces (`@/packages/review`): `reviewStore: StoreApi<{ entries: ReviewEntry[]; lastCheckedAt?: number; loaded: boolean }>`, `loadReviewEntries(): Promise<void>`, `addReviewEntry(input: ReviewEntryInput): Promise<ReviewEntry>`, `updateReviewEntry(id: string, patch: Partial<Omit<ReviewEntry, 'id'>>): Promise<ReviewEntry | undefined>`, `setReviewEntryState(match: { id: string } | { ref: ReviewRef }, state: ReviewState): Promise<ReviewEntry | undefined>`, `listReviewEntries(opts?: { scopeId?: string; states?: ReviewState[] }): ReviewEntry[]` (in memory, newest first), `subscribeReviewEntries(cb: (entries: ReviewEntry[]) => void): () => void`, `setLastCheckedAt(ts: number): Promise<void>`, `waitingCount(entries: ReviewEntry[]): number`, `setReviewStorageForTests(api: { getItem<T>(key: string, fallback: T): Promise<T>; setItemNow(key: string, value: unknown): Promise<void> } | null): void`.

Persisted document under `review-entries`: `{ entries: ReviewEntry[]; lastCheckedAt?: number }`. Every mutation goes through one promise queue: read storage fresh; keep rows that pass `ReviewEntrySchema.safeParse`; drop `done`/`dismissed` rows whose `resolvedAt ?? createdAt` is older than `REVIEW_RETENTION_MS`; apply the change; `setItemNow`; set the store. `addReviewEntry`: when an `open` row has the same `ref.type` and `ref.id`, its fields are replaced by the input's, keeping its `id` and `createdAt`; otherwise a new row (`id` from uuid v4 unless given, `state` default `'open'`, `createdAt` default `Date.now()`). State changes to `done` or `dismissed` set `resolvedAt = Date.now()`; back to `open` clears `resolvedAt` and `undoUntil`. `{ ref }` matches the newest row with that ref (so it closes the open one and can reopen a closed one). Waiting = `state === 'open'` and `kind` in `WAITING_KINDS`.

- [ ] **Step 1: Write the failing tests.** `store.test.ts`, with an in-memory fake through `setReviewStorageForTests` and the store reset in `beforeEach`:
  - `add before load keeps saved rows`: the fake holds one row; `addReviewEntry` without `loadReviewEntries` → the fake holds 2 rows.
  - `concurrent adds both persist`: `Promise.all([addReviewEntry(a), addReviewEntry(b)])` → both stored.
  - `another window's write is not lost`: after load, a third row is written straight into the fake; `updateReviewEntry(first.id, { text: 'x' })` → all three stored (Review Focus 3).
  - `same open ref merges`: adding `ref: { type: 'proposal', id: 'p1' }` twice → one row, same `id` and `createdAt`, second `text`; after `setReviewEntryState({ ref: { type: 'proposal', id: 'p1' } }, 'done')` a third add makes a new row.
  - `state changes stamp resolvedAt`: `'dismissed'` sets `resolvedAt` to now; `'open'` clears `resolvedAt` and `undoUntil`; an unknown `{ id }` resolves `undefined`.
  - `load drops bad and old rows`: a row without `ref`, and a `dismissed` row resolved 31 days ago, are gone; an `open` row created 90 days ago stays.
  - `writes immediately under review-entries`: the fake's `setItemNow` was called with key `'review-entries'`.
  - `subscribe`: the callback receives the entries after an add; after unsubscribing it is not called again.
  - `last checked persists`: `setLastCheckedAt(123)`, reset the store, `loadReviewEntries()` → `reviewStore.getState().lastCheckedAt === 123`.
  - `waitingCount`: open needs-you, proposal and conflict count; open change, open re-check, and a proposal with `state: 'done'` do not.
  - `listReviewEntries` is newest first and filters by `scopeId` and `states`.
  - `background.test.ts`: `RETRY_DELAYS_MS` equals `[10_000, 60_000, 300_000]`.
- [ ] **Step 2: Run** `pnpm test -- src/renderer/packages/review src/shared/types/background.test.ts`. Expected: FAIL, modules not found.
- [ ] **Step 3: Implement** the two type files, the store, the barrel, the storage key and the `ReviewItem` re-export.
- [ ] **Step 4: Run** the same command and `pnpm test -- src/renderer/components/review`. Expected: PASS, the existing ReviewItem tests included.
- [ ] **Step 5: Commit**: `feat(review): review entries store and background job types`.

### Task 6: Review openers, renderers and hooks

**Files:**
- Create: `src/renderer/packages/review/registry.ts`, `src/renderer/packages/review/hooks.ts`
- Modify: `src/renderer/packages/review/index.ts`
- Test: `src/renderer/packages/review/registry.test.ts` (node), `src/renderer/packages/review/hooks.test.tsx` (jsdom)

**Interfaces:**
- Consumes: Task 5's store.
- Produces:
  ```ts
  export type ReviewOpener = (entry: ReviewEntry) => void | Promise<void>
  export function registerReviewOpener(refType: ReviewRefType, open: ReviewOpener): () => void
  export function hasReviewOpener(entry: ReviewEntry): boolean
  export function openReviewEntry(entry: ReviewEntry): Promise<boolean> // false when no opener
  export type ReviewRendererProps = { entry: ReviewEntry; focused: boolean }
  export function registerReviewRenderer(
    kind: ReviewKind,
    Component: ComponentType<ReviewRendererProps>,
    opts?: { refType?: ReviewRefType }
  ): () => void
  export function getReviewRenderer(entry: Pick<ReviewEntry, 'kind' | 'ref'>): ComponentType<ReviewRendererProps> | undefined
  export function useReviewRenderer(entry: Pick<ReviewEntry, 'kind' | 'ref'>): ComponentType<ReviewRendererProps> | undefined
  export function useReviewEntries(): ReviewEntry[]
  export function useReviewWaitingCount(): number
  export function useLastCheckedAt(): number | undefined
  ```
- Both registries live in one zustand store so `useReviewRenderer` re-renders when a lazily loaded slice registers late. Registering a key again replaces the earlier entry; the earlier unregister function then does nothing (it removes only what it added). Renderers are keyed by `kind` plus an optional `refType`. Lookup tries `${entry.kind}:${entry.ref.type}` first, then the bare `kind`; with neither, slice 5's feed uses its default renderer. So slice 4 registers `('proposal', C, { refType: 'proposal' })` and a draft proposal from slice 10 (`ref.type 'draft'`) does not reach it. `useReviewEntries` calls `loadReviewEntries()` on first mount and again on `window` `focus` and on `visibilitychange` to visible, so a row added in the Quick Chat window shows up in the main window.

- [ ] **Step 1: Write the failing tests.**
  - `registry.test.ts`: `hasReviewOpener` is false until a `'job'` opener is registered; `openReviewEntry` then calls it with the entry and resolves `true`; with none it resolves `false`; after the unregister function runs it is `false` again. Register A then B for `'change'`, call A's unregister → B still opens. `getReviewRenderer({ kind: 'proposal', ref: { type: 'proposal', id: 'p' } })` is `undefined`, then the registered component; with `A` registered for `('proposal', { refType: 'proposal' })` and `B` for bare `'proposal'`, a `ref.type 'draft'` entry gets `B` and a `ref.type 'proposal'` entry gets `A`; with only `A`, the draft entry gets `undefined`.
  - `hooks.test.tsx`: `useReviewEntries` loads saved rows on mount and picks up a row written into the fake storage after a `window` `focus` event; `useReviewWaitingCount` is 3 for open proposal, needs-you and conflict plus an open change and a done row; `useLastCheckedAt` follows `setLastCheckedAt`; `useReviewRenderer(conflictEntry)` is `undefined`, and after `registerReviewRenderer('conflict', C)` inside `act` the hook returns `C`.
- [ ] **Step 2: Run** `pnpm test -- src/renderer/packages/review`. Expected: FAIL on the new files.
- [ ] **Step 3: Implement** both modules and export them from the barrel.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(review): openers, renderers and hooks`.

### Task 7: `/new` route, `startNewChat`, `/` redirects

**Files:**
- Create: `src/renderer/routes/new.tsx` (today's `routes/index.tsx` moved, `createFileRoute('/new')`), `src/renderer/lib/newChatSearch.ts`, `src/renderer/lib/startNewChat.ts`
- Modify: `src/renderer/routes/index.tsx` (replaced by a redirect route), `src/renderer/Sidebar.tsx:107-115`, `src/renderer/hooks/useShortcut.tsx:56-63`, `src/renderer/routes/copilots.tsx:102-107`, `src/renderer/hooks/useDesktopShell.ts:133`, `src/renderer/utils/settings-navigation.ts:18-30`, `src/renderer/utils/settings-navigation.test.ts:34-41`, `src/renderer/modals/Settings.tsx:28-36`, `src/renderer/routeTree.gen.ts` (regenerated)
- Test: `src/renderer/lib/startNewChat.test.ts`, `src/renderer/lib/newChatSearch.test.ts`, `src/renderer/routes/routing.test.ts` (node)

**Interfaces:**
- Consumes: `toSessionAgentFieldsFromSelection` (`@shared/new-chat-agents`); `currentSessionIdAtom`; `router` from `@/router`.
- Produces:
  ```ts
  // lib/newChatSearch.ts (no router import, so routes/new.tsx can import it without a cycle)
  export const NewChatSearchSchema: z.ZodObject<{ copilotId: z.ZodOptional<z.ZodString>; scopeId: z.ZodOptional<z.ZodString>; prefill: z.ZodOptional<z.ZodString> }>
  export type NewChatSearch = z.infer<typeof NewChatSearchSchema>
  export function seedNewChatSession(session: Session, search: NewChatSearch): Session
  // lib/startNewChat.ts
  export function startNewChat(search?: { scopeId?: string; prefill?: string }): void
  ```
- `seedNewChatSession`: `copilotId` → `toSessionAgentFieldsFromSelection([copilotId])` merged in; `scopeId` → `projectId`, except `'everywhere'` (slice 3's `EVERYWHERE_SCOPE_ID`; use the constant once slice 3 has merged) and empty, which leave `projectId` unset. `startNewChat` sets `currentSessionIdAtom` to `null` on jotai's default store, then `router.navigate({ to: '/new', search: search ?? {} })`.
- `routes/new.tsx` differences from the moved file: `validateSearch: zodValidator(NewChatSearchSchema)`; the effect at old `:135-142` calls `setSession((old) => seedNewChatSession(old, search))`; `composerDraft` and `composerKey` get setters, and when `search.prefill` changes after mount the draft is set and the key bumped so `InputBox` remounts with it; `createSessionStore({ … })` at old `:175-188` also passes `projectId: session.projectId`.
- `routes/index.tsx` becomes `createFileRoute('/')({ validateSearch: zodValidator(z.object({ copilotId: z.string().optional() })), beforeLoad: ({ search }) => { throw redirect({ to: '/new', search, replace: true }) } })`. Slice 5 replaces it with Review.
- Call sites: Sidebar `handleCreateNewSession` and ⌘N in `useShortcut` call `startNewChat()` (Sidebar keeps its small-screen close and tracking); `copilots.tsx` navigates `{ to: '/new', search: { copilotId } }`; `useDesktopShell.ts:133` navigates to `/new`; `resolveSettingsExitTarget('new')` returns `{ to: '/new' }` (return type gains `'/new'`) and `closeSettings` navigates to `target.to` instead of a literal `'/'`. Unchanged on purpose: deleting a chat, a missing session, the not-found route and the error boundary go to `/` (the redirect today, Review after slice 5).

- [ ] **Step 1: Write the failing tests.**
  - `startNewChat.test.ts` (`vi.mock('@/router', () => ({ router: { navigate: vi.fn() } }))`): with the atom set to `'s1'`, `startNewChat({ prefill: 'Which quote is current?', scopeId: 'p1' })` sets it to `null` and calls `navigate({ to: '/new', search: { prefill: 'Which quote is current?', scopeId: 'p1' } })`; `startNewChat()` passes `search: {}`.
  - `newChatSearch.test.ts`: `seedNewChatSession(s, { scopeId: 'p1' }).projectId === 'p1'`; `{ scopeId: 'everywhere' }` and `{}` leave it `undefined`; `{ copilotId: 'c1' }` sets `copilotId: 'c1'` as `toSessionAgentFieldsFromSelection(['c1'])` does; a session that already has `copilotId: 'c9'` and `projectId: 'p9'` comes back unchanged from `seedNewChatSession(s, {})` (absent fields never clear what the user picked); `NewChatSearchSchema.parse({ prefill: 'x', other: 1 })` keeps `prefill`.
  - `routing.test.ts`: `Route.options.beforeLoad` from `@/routes/index`, called with `{ search: { copilotId: 'c1' } }`, throws a value for which `isRedirect` (from `@tanstack/react-router`) is true and whose `options` are `{ to: '/new', search: { copilotId: 'c1' }, replace: true }` (Review Focus 5). Read as text: `routes/new.tsx` contains `createFileRoute('/new')`, `seedNewChatSession(` and `projectId: session.projectId`; `routeTree.gen.ts` contains `path: '/new'`; `Sidebar.tsx` and `hooks/useShortcut.tsx` contain `startNewChat(` and neither `to: '/'` nor `` to: `/` ``; `routes/copilots.tsx` contains `to: '/new'`.
  - Update `settings-navigation.test.ts:34-41` so `resolveSettingsExitTarget('new')` expects `{ to: '/new' }`; `('deleted-session', false)` and `('new', false)` still expect `{ to: '/' }`.
- [ ] **Step 2: Run** `pnpm test -- src/renderer/lib src/renderer/routes/routing.test.ts src/renderer/utils/settings-navigation.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** with `git mv src/renderer/routes/index.tsx src/renderer/routes/new.tsx` first (history follows the page), then the new `index.tsx`, the two lib files and the call sites. Regenerate the route tree with `pnpm build:renderer` (the TanStack Router Vite plugin rewrites `routeTree.gen.ts`).
- [ ] **Step 4: Run** the same tests, then `pnpm check`. Expected: PASS, no new tsc errors (`to: '/new'` type-checks only after regeneration).
- [ ] **Step 5: Commit**: `feat(routing): new chat lives at /new, startNewChat, / redirects`.

### Task 8: Gallery, look at it, record it

**Files:**
- Modify: `src/renderer/routes/dev/design-system.tsx` (three sections after the ReviewItem list), `docs/log.md`

- [ ] **Step 1:** Add to `/dev/design-system`: Mascot, all eight states at 56 and 24 px with their `MASCOT_STATE_LABEL`; Sheet, two buttons opening the design preview's sheet bottom and right (title `Dango wants to edit 3 files`, body `Why: move plans/ into docs/specs and fix the links. Touches README.md, AGENTS.md, docs/log.md in Dango.`, actions `Not now`, `Always in this scope`, primary `Allow once`, hint `Esc closes`); Undo, a button that calls `pushUndo({ message: 'Approved "Launch is 6 Nov" for Acme Co', undo: () => {} })`.
- [ ] **Step 2:** Run `pnpm dev:web`, open `/dev/design-system`, and check in light and dark: the mascot body is ink in light and light with dark eyes in dark; idle blinks, thinking and replying dots pulse, the working ring turns; with Reduce Motion emulated in devtools every mascot is still, in the idle pose, with its state word. Open each sheet: focus on `Allow once`, Tab cycles inside, Esc closes and focus returns to the button. Push the undo twice: one toast, bottom-centre, above any sheet; ⌘Z undoes, ⌘Z typed in the composer on `/new` does not. Visit `/` and `/?copilotId=<an agent id>`: both land on `/new`, the second with the agent chosen. Press ⌘N from a chat: `/new` with an empty composer.
- [ ] **Step 3:** Fix what the walk shows, each fix with a test in the owning task's file; commit `fix(foundations): …`.
- [ ] **Step 4:** Run `pnpm test`, `pnpm check`, `pnpm lint`. Expected: all pass, tsc error count equal to `main`'s. Report passed / failed / not run as `.claude/skills/dango-verify-change` asks; the desktop IndexedDB path and the Quick Chat window are not exercised by `dev:web`, so say so.
- [ ] **Step 5:** Add one line under today's date in `docs/log.md` (`* **Implementation**: [slice 1b](specs/2026-10-17-slice-01b-shared-foundations.md) …`) and commit `docs: log the shared foundations slice`.
