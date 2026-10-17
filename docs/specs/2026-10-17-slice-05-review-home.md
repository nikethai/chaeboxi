---
type: plan
status: draft
description: "Slice 5: Review becomes the home screen: the feed, default renderers, keys, Trust arrival for non-knowledge actions, toolbar, empty states and the sidebar badge"
generated: { by: claude/opus-5.5, at: 2026-10-17T19:00:00+07:00 }
---
# Slice 5: Review Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Opening Dango lands on Review: one feed of what needs you, grouped Today / Yesterday / Earlier, filtered by scope, acted on with one key per item, with Trust deciding which safe non-knowledge actions arrive done.

**Architecture:** Slice 1b already stores `ReviewEntry` rows, runs undo and ⌘Z, and keeps the opener and renderer registries. This slice adds the feed at `/`. Each row mounts `useReviewRenderer(entry) ?? DefaultReviewRenderer` (1b looks up `kind:ref.type`, then bare `kind`; slice 4 registers `proposal:proposal`, `conflict:conflict` and `re-check`), so done, needs-you, change and non-knowledge proposals such as drafts get this slice's default renderer. Keys never call domain code. They press the focused row's own labelled buttons, so slice 4 keeps sole ownership of its actions and undo records. Trust arrival is a small hook inside 1b's `addReviewEntry`: under Auto, a safe proposal whose `ref.type` has a registered applier is applied and stored as Done with Undo. Knowledge never goes through it.

**Tech Stack:** React 18, TanStack Router (file routes, generated `routeTree.gen.ts`), zustand 5, Zod, Lucide icons, `dg-*` classes, Vitest (+ jsdom, Testing Library), Biome.

**Spec:** `docs/specs/2026-10-16-ux-flows.md` (flows 3, 13, 16, "Gaps closed on 2026-10-17": empty states, A11Y1); `docs/specs/2026-10-16-redesign-brief.md` (Trust level, Review); `docs/specs/2026-10-17-redesign-roadmap.md` (Shared types, Contract register, Decisions); ADR 0001; the design system's ReviewItem note (artifact `C7dPipWhJubTMddvKR7C3W`, `project/components/ReviewItem/README.md`).

## Global Constraints

- **Needs 1b:**
  - from `@shared/types/review`: `ReviewEntry`, `ReviewKind`, `ReviewRefType`, `WAITING_KINDS`;
  - from `@/packages/review`: `reviewStore`, `addReviewEntry`, `updateReviewEntry`, `setReviewEntryState`, `useReviewEntries`, `useReviewWaitingCount`, `useLastCheckedAt`, `registerReviewOpener`, `hasReviewOpener`, `openReviewEntry`, `useReviewRenderer(entry)`, `ReviewRendererProps`, `waitingCount`, `setReviewStorageForTests`;
  - from `@/packages/undo`: `pushUndo`, `undoEntry`, `canUndo`, `DEFAULT_UNDO_MS` (1b mounts `<UndoToast />` and `useUndoHotkey()`; this slice adds neither);
  - also `Mascot` from `@/components/brand/Mascot`, `startNewChat` from `@/lib/startNewChat`, `isEditableTarget` from `@/utils/isEditableTarget`.
- **Needs 2:** `useTrustSheet(): { open(): void; sheet: JSX.Element }` and the route `/settings/sources`. **Needs 3:** `useScopes()` and `isEverywhere(id)`. **Needs 4:** its renderers registered by `initKnowledge()`. **Soft 7:** `listSources()` from `@/packages/sources` for "any source connected"; until slice 7 merges, the stand-in in Task 2 is used. Until slice 2 lands, `trustLevel` reads as `'auto'` (roadmap: readers use the defaults).
- Decisions (roadmap):
  - Trust Auto never approves knowledge; entries whose `ref.type` is `'proposal'` or `'conflict'` always wait.
  - Keys are ↑↓ or J/K move, A approve, E edit, X dismiss, ↵ open, ⌘Z undo. While editing, ⌘↵ approves; that is slice 4's textarea.
  - Conflict: Keep this on each statement, then Keep both… and Dismiss (slice 4's renderer).
- Waiting = open Needs you + Proposal + Conflict (1b's `waitingCount`). Only that count shows in the sidebar badge (`dg-badge`, blue). Blue only means needs you; green is the only action colour.
- Copy is sentence case, buttons name the action, no emoji. Exact strings:
  - toolbar: `All scopes`, `Everywhere`, `Trust: Auto` / `Trust: Ask first`, `New chat`;
  - day headings: `Today`, `Yesterday`, `Earlier`;
  - default actions: `Open`, `Undo`, `Answer` (or `entry.actionLabel`), `Approve`, `Dismiss`;
  - toast: `Dismissed "<text>"` (clipped to 48 characters plus `…`);
  - RV5: `Nothing needs you`, `Last checked …`;
  - EM2: `Connect a source to get started`, `Dango reads a folder, Gmail or Asana and tells you here what needs you.`, `Connect a source`, `Ask anything`.
- Out of this slice: the review store, undo, toast, Mascot, `/new` and `startNewChat` (1b); the Trust sheet itself (2); scope storage and the scope pill (3); proposal, conflict and re-check rows, inline edit RV2, Keep both RV7, "Don't suggest this again" (4); sources, jobs, `setLastCheckedAt` calls (7); notifications (8); rail and bottom tabs, the full accessibility pass (9); Gmail draft/label appliers and openers (10).

## Review Focus

1. Under Auto, an applier that throws must leave the item waiting as a Proposal: not lost, not shown as Done. Pinned in Task 1.
2. A slice 10 draft arriving as `kind: 'proposal'` must get the default renderer (Approve through the draft applier), never slice 4's proposal renderer, which would call `approveProposal` on a draft id. Pinned in Task 4.
3. Typing `a`, `x` or `e` into slice 4's edit textarea, or into any input in a row, must type, not approve or dismiss. Pinned in Task 4.
4. When a row leaves the feed (dismissed by key, by click, or from another window), focus goes to the row below, else the row above, else the RV5 block, never to the page top. Pinned in Task 4.
5. With 120 waiting items the sidebar badge reads `99+` and does not widen the rail. Pinned in Task 7.

---

### Task 1: Trust arrival for non-knowledge actions

**Files:**
- Create: `src/renderer/packages/review/trust.ts`
- Modify: `src/renderer/packages/review/store.ts` (1b's `addReviewEntry` passes the input through `arrive` before it is persisted), `src/renderer/packages/review/index.ts` (export the new names)
- Test: `src/renderer/packages/review/trust.test.ts` (node, `@/packages/undo` mocked, fake storage through `setReviewStorageForTests`)

**Interfaces:**
- Consumes: `settingsStore` from `@/stores/settingsStore`; `TrustLevel` from `@shared/types/settings` (slice 2: `Settings['trustLevel']`); `pushUndo`, `canUndo`, `undoEntry`, `DEFAULT_UNDO_MS`; 1b's `updateReviewEntry`.
- Produces:
  ```ts
  export function getTrustLevel(): TrustLevel // settings.trustLevel ?? 'auto'; TrustLevel imported from slice 2, not redeclared
  export type ReviewApplier = { apply(e: ReviewEntry): Promise<void>; undo(e: ReviewEntry): Promise<void> }
  export function registerReviewApplier(refType: Exclude<ReviewRefType, 'proposal' | 'conflict'>, a: ReviewApplier): () => void
  export function getReviewApplier(refType: ReviewRefType): ReviewApplier | undefined
  export function arrive(entry: ReviewEntry, trust: TrustLevel, now: number): Promise<ReviewEntry>
  export function canUndoArrival(entryId: string): boolean
  export function undoArrival(entryId: string): Promise<boolean>
  ```

Rule (brief, Trust level, as narrowed by the roadmap's Decisions):
- `addReviewEntry` first completes the input into a full `ReviewEntry` (its merge target's `id` and `createdAt` when an open row has the same ref; otherwise a uuid v4 `id` unless given, `state` default `'open'`, `createdAt` default `now`), then calls `arrive`, so an applier always receives a real `id` (slice 10's applier reads `e.id`).
- `arrive` applies an entry only when all of these hold: `kind === 'proposal'`, `risk === 'safe'`, `ref.type` is not `'proposal'` or `'conflict'`, trust is `'auto'`, and an applier is registered for `ref.type`.
- It awaits `apply`, then returns the entry as `kind: 'done'`, same `id`,, state: 'done', undoUntil: now + DEFAULT_UNDO_MS`.
- After the row is stored, `addReviewEntry` pushes `pushUndo({ message: '', silent: true, group: 'other', undo })`. That `undo` awaits `applier.undo(entry)` and then `updateReviewEntry(id, { kind: 'proposal', state: 'open', undoUntil: undefined })`, so an undone action waits again. The record id is kept in an in-memory map for `canUndoArrival` / `undoArrival`.
- When `apply` throws, the entry comes back unchanged (an open proposal). A missing `risk` counts as `'risky'`.
- A Trust change affects only later arrivals (flow 13).

- [ ] **Step 1: Write the failing tests** in `trust.test.ts`:
  - auto, `risk: 'safe'`, `ref: { type: 'draft' }`, applier registered → `apply` receives an entry with a non-empty `id`, `state: 'open'` and `createdAt`, and the stored row has that same `id`, with `kind: 'done'`, `state: 'done'`, `undoUntil = now + 5000`; `apply` called once; `pushUndo` called once with `silent: true`.
  - `'ask'` → stays an open proposal; `apply` not called.
  - auto with `ref.type: 'proposal'`, even when an applier was registered for it through a cast → open proposal, `apply` not called (ADR 0001).
  - auto with no `risk`, or with `'risky'` → open proposal.
  - auto, safe, no applier → open proposal.
  - an applier whose `apply` rejects → open proposal, and the row is persisted (Review Focus 1).
  - needs-you and change inputs pass through unchanged at both levels.
  - `undoArrival(id)` calls `applier.undo` and the row is again `kind: 'proposal'`, `state: 'open'`.
  - `getTrustLevel()` is `'auto'` with the setting absent.
- [ ] **Step 2: Run** `pnpm test -- src/renderer/packages/review/trust.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement** `trust.ts` and the one call in `addReviewEntry`: `arrive(input, getTrustLevel(), Date.now())`.
- [ ] **Step 4: Run** `pnpm test -- src/renderer/packages/review`. Expected: PASS, 1b's store tests included.
- [ ] **Step 5: Commit** `feat(review): Trust Auto applies safe non-knowledge actions`.

### Task 2: Feed selectors

**Files:**
- Create: `src/renderer/components/review/feedSelectors.ts`
- Test: `src/renderer/components/review/feedSelectors.test.ts` (node)

**Interfaces:**
- Produces:
  - `visibleEntries(entries: ReviewEntry[], scopeId?: string): ReviewEntry[]`: not `dismissed`, matching the scope when given, newest first.
  - `groupByDay(entries: ReviewEntry[], now: number): Array<{ label: 'Today' | 'Yesterday' | 'Earlier'; entries: ReviewEntry[] }>`: local-midnight boundaries; empty groups omitted.
  - `displayKind(e: ReviewEntry): ReviewKind`: `'done'` when `state === 'done'`.
  - `formatLastChecked(at: number, now: number): string`.
  - `hasSources(o: { sourceCount?: number; entries: ReviewEntry[]; lastCheckedAt?: number }): boolean`: `sourceCount > 0` when given (slice 7's `listSources().length`); otherwise the stand-in, true when any entry exists or `lastCheckedAt` is set.
  - `nextFocusAfterRemoval(prevIds: string[], nextIds: string[], focusedId: string): string | null`.
  - `clip(text: string, max = 48): string`.

- [ ] **Step 1: Write the failing tests:**
  - With `now = new Date(2026, 9, 17, 9, 0).getTime()`, `groupByDay` puts 08:00 on the 17th in Today, 23:59 on the 16th in Yesterday and the 15th in Earlier, and omits empty groups.
  - `visibleEntries(…, 'everywhere')` keeps only Everywhere rows and drops dismissed ones.
  - `displayKind` of a `state: 'done'` proposal is `'done'`.
  - `formatLastChecked` gives `Last checked ${hm}` for today, `Last checked yesterday at ${hm}` for yesterday and `Last checked ${dayMonth}` before that. `hm` and `dayMonth` come from `Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' })` and `{ day: 'numeric', month: 'short' }`.
  - `hasSources({ entries: [] })` is false; it is true with one entry or with a time; `{ sourceCount: 0, entries: [row] }` is false and `{ sourceCount: 2, entries: [] }` is true.
  - `nextFocusAfterRemoval(['a','b','c'], ['a','c'], 'b')` is `'c'`; `(['a','b','c'], ['a','b'], 'c')` is `'b'`; `(['a'], [], 'a')` is `null`.
  - `clip` of 60 characters is 48 characters plus `…`.
- [ ] **Step 2: Run** `pnpm test -- src/renderer/components/review/feedSelectors.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** it. Expected: PASS.
- [ ] **Step 5: Commit** `feat(review): feed grouping and focus helpers`.

### Task 3: The default renderer

**Files:**
- Create: `src/renderer/components/review/DefaultReviewRenderer.tsx`, `src/renderer/components/review/defaultActions.ts`
- Modify: `src/renderer/components/review/ReviewItem.tsx` (`ReviewAction` gains `disabled?: boolean`), `src/renderer/components/review/index.ts`
- Test: `src/renderer/components/review/defaultActions.test.ts` (node), `src/renderer/components/review/DefaultReviewRenderer.test.tsx` (jsdom), additions to `ReviewItem.test.tsx`

**Interfaces:**
- Consumes: `hasReviewOpener`, `openReviewEntry`, `setReviewEntryState`, `pushUndo`, `getReviewApplier`, `canUndoArrival`, `undoArrival`; `useScopes().getScope`, `isEverywhere`.
- Produces:
  - `defaultActions(e: ReviewEntry, h: { open(): void; undo(): void; approve(): void; dismiss(): void }, ctx: { canOpen: boolean; canUndo: boolean; canApply: boolean }): ReviewAction[]`.
  - `DefaultReviewRenderer(props: ReviewRendererProps): JSX.Element`, which renders `ReviewItem` with `scope` = the scope's name (`Everywhere` for `isEverywhere`) and `focused`.

Default actions by `displayKind` (the first is primary; Dismiss is ghost):

| Kind | Actions |
|---|---|
| done | `Open` (if `canOpen`) · `Undo` (if `canUndo`) |
| needs-you | `Answer` (if `canOpen`) · `Dismiss` |
| change | `Open` (if `canOpen`) · `Dismiss` |
| proposal (non-knowledge ref, e.g. a draft under Ask) | `Approve` (if `canApply`) · `Dismiss` |

Any kind: when the entry has `actionLabel` and `canOpen`, the primary action is labelled `actionLabel` and calls `openReviewEntry` (it replaces `Answer` / `Open` / `Approve`; for example slice 7's `Sign in again`, slice 10's draft sheet).
| anything else with no registered renderer | `Dismiss` |

Handlers:
- `Open` / `Answer`: `openReviewEntry(e)`.
- `Undo`: `undoArrival(e.id)`. `canUndo` is `canUndoArrival(e.id)` and `undoUntil > now`.
- `Approve`: the applier's `apply`, then `setReviewEntryState({ id }, 'done')` and `pushUndo({ message: 'Done: "<clip(text)>"', undo })`; that `undo` calls the applier's `undo` and reopens the row.
- `Dismiss`: `setReviewEntryState({ id }, 'dismissed')`, then `pushUndo({ message: 'Dismissed "<clip(text)>"', undo: reopen })`.

- [ ] **Step 1: Write the failing tests.**
  - `defaultActions.test.ts`: one assertion per table row, with exact labels and order. A done row with `canOpen: false` and `canUndo: false` gives `[]`. A needs-you row with `actionLabel: 'Sign in again'` and an opener has primary `Sign in again`; a draft proposal with `actionLabel: 'Edit draft'` and an opener has primary `Edit draft` then `Dismiss`.
  - `DefaultReviewRenderer.test.tsx`:
    - Dismiss sets the row dismissed and pushes `Dismissed "Which quote is current?"`.
    - Answer calls `openReviewEntry`.
  - `ReviewItem.test.tsx`: a `disabled` action renders a disabled button. The five existing tests still pass.
- [ ] **Step 2: Run** `pnpm test -- src/renderer/components/review`. Expected: FAIL on the new cases.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** it. Expected: PASS.
- [ ] **Step 5: Commit** `feat(review): default renderer and one tab stop per row`.

### Task 4: The feed and its keys

**Files:**
- Create: `src/renderer/components/review/ReviewFeed.tsx`, `src/renderer/components/review/useReviewKeys.ts`, `src/renderer/components/review/review-home.css`
- Test: `src/renderer/components/review/useReviewKeys.test.tsx`, `src/renderer/components/review/ReviewFeed.test.tsx` (jsdom; store seeded with `setReviewStorageForTests`; a fake renderer registered for `proposal` with buttons `Approve`, `Edit`, `Dismiss` and a textarea)

**Interfaces:**
- Consumes: Tasks 2–3; `useReviewEntries`, `useReviewRenderer`, `setReviewEntryState`, `pushUndo`, `isEditableTarget`.
- Produces:
  - `ReviewFeed(props: { scopeId?: string; caughtUp?: ReactNode }): JSX.Element`. When nothing is waiting it renders `<div tabIndex={-1} data-testid="review-empty">{caughtUp}</div>` above the groups.
  - `useReviewKeys(o: { rowsRef: RefObject<Map<string, HTMLElement>>; ids: string[]; focusedId: string | null; setFocusedId(id: string | null): void; dismissFallback(id: string): void }): { onKeyDown: KeyboardEventHandler<HTMLElement> }`.

Layout: each day group is an `h2` (`Today`, `Yesterday`, `Earlier`) followed by an `ol`. Each `li` is the row's single tab stop (`tabIndex={0}`, `data-entry-id`, `aria-keyshortcuts="ArrowUp ArrowDown J K A E X Enter"`). It renders `useReviewRenderer(entry) ?? DefaultReviewRenderer` with only 1b's `{ entry, focused: entry.id === focusedId }`. Renderers know nothing about the feed. The feed keeps rows to one tab stop itself: a layout effect (re-run on focus change and on a `MutationObserver` `childList`/`subtree` change inside the list) sets `tabindex="-1"` on every `button`, `a[href]`, `input`, `textarea` and `select` inside rows that do not hold focus. It first saves each element's original `tabindex` in `data-feed-tabindex`, and restores it on the row that holds focus. The page pads `0 var(--dango-space-7)`; rows have a gap of `var(--dango-space-2)`. On mount, if `document.activeElement` is `body`, the first row takes focus.

Keys act on the focused row and press its own buttons, found by accessible name. A slice that owns a row therefore keeps its own logic and its own undo record, and the feed pushes no second record:
- ↑ / K and ↓ / J move between rows, clamped at the ends.
- A clicks the row's enabled `Approve`.
- E clicks `Edit`. If the row has none and `hasReviewOpener(entry)`, it calls `openReviewEntry(entry)` (slice 10 opens its draft edit sheet this way).
- X clicks `Dismiss`. If the row has none, it calls `dismissFallback`, which sets the row dismissed and pushes `Dismissed "…"`.
- ↵ clicks the row's `.dg-btn--primary`. On a conflict row it focuses the first `Keep this` instead.

Keys are ignored when Ctrl, ⌘ or Alt is held, and when `isEditableTarget(event.target)`. ⌘Z belongs to 1b's global hotkey. When the focused id disappears from the visible ids (for any reason), focus moves to `nextFocusAfterRemoval(…)`, or to the `review-empty` block when that returns `null`.

- [ ] **Step 1: Write the failing tests.**
  - `useReviewKeys.test.tsx`:
    - J and ↓ move to the next row, and K and ↑ move back; all four clamp at the ends.
    - A on a focused fake proposal clicks its `Approve`.
    - X on a row without `Dismiss` calls `dismissFallback`.
    - E on a default-rendered row with a registered opener calls `openReviewEntry`.
    - `a`, `x` and `e` dispatched from the fake renderer's textarea click nothing (Review Focus 3).
    - ⌘A clicks nothing.
  - `ReviewFeed.test.tsx`:
    - Rows appear under `Today`, `Yesterday` and `Earlier`.
    - `scopeId` filters the rows.
    - With a slice-4-like renderer that knows nothing about the feed (a plain `article` with `button`s and an `input`), only the focused row's controls are tabbable. Moving focus to another row restores the first row's original `tabindex` values, including an explicit `tabindex="0"` they had before.
    - Pressing X on the last row moves focus to the row above. Dismissing the only waiting row focuses `review-empty`. Removing the focused row through the store (as another window would) moves focus to the row below (Review Focus 4).
    - With a fake renderer registered as `proposal:proposal` (1b's `refType` form), a `{ kind: 'proposal', ref: { type: 'draft' } }` row renders the default renderer's `Approve`, and a `ref.type: 'proposal'` row renders the fake (Review Focus 2).
    - A conflict row from a fake conflict renderer gets focus on its first `Keep this` when ↵ is pressed.
- [ ] **Step 2: Run** `pnpm test -- src/renderer/components/review`. Expected: FAIL.
- [ ] **Step 3: Implement.** CSS reads only `--dango-*` tokens.
- [ ] **Step 4: Run** it. Expected: PASS.
- [ ] **Step 5: Commit** `feat(review): the feed with keys and focus that follows removals`.

### Task 5: `/` is Review, with its toolbar

**Files:**
- Create: `src/renderer/components/review/ReviewHome.tsx`, `src/renderer/components/review/ReviewToolbar.tsx`
- Modify: `src/renderer/routes/index.tsx`. Replace 1b's redirect route with the Review route:
  - `validateSearch` takes `{ scope?: string; copilotId?: string }`.
  - `beforeLoad` redirects to `/new` with `{ copilotId }` only when `copilotId` is present, so old links keep working.
  - `component` renders `ReviewHome` inside `Page title={t('Review')}`.
- Modify: `src/renderer/routeTree.gen.ts` (regenerated). `src/renderer/routes/routing.test.ts` (1b's; update its `/` expectations).
- Test: `src/renderer/components/review/ReviewToolbar.test.tsx` (jsdom), `src/renderer/routes/routing.test.ts`

**Interfaces:**
- Consumes: `useScopes()`, `isEverywhere`; `useTrustSheet()`; `startNewChat`; `registerReviewOpener`, `hasReviewOpener`.
- Produces:
  - `ReviewToolbar(props: { scopeId?: string; onScopeChange(id: string | undefined): void }): JSX.Element`.
  - `ReviewHome(props: { sourceCount?: number }): JSX.Element` (`sourceCount` is slice 7's, see Task 6), which renders the toolbar, then the feed (Task 4) or the empty states (Task 6). The scope filter lives in the route's `scope` search.

Toolbar, left to right:
- A scope button with a `dg-menu`. The menu lists `All scopes`, then `Everywhere`, then each entry of `useScopes().scopes` that is not `isEverywhere`. The button shows the chosen name.
- `Trust: Auto ▾` or `Trust: Ask first ▾`, read from `getTrustLevel()`. It calls `useTrustSheet().open()`, and the toolbar renders the hook's `sheet` element.
- On the right, `New chat` (`dg-btn dg-btn--primary` plus `<kbd class="dg-kbd">⌘N</kbd>`), which calls `startNewChat({ scopeId })` with the current filter.

Chevrons are Lucide `ChevronDown` at 16 px, stroke 1.8. `ReviewHome` registers the default opener for `'question'` once, and only when `hasReviewOpener` is false for it: `startNewChat({ prefill: e.text, scopeId: e.scopeId })`. That is flow 3's "a chat with the question prefilled"; slice 10 may replace it.

- [ ] **Step 1: Write the failing tests.**
  - `ReviewToolbar.test.tsx` (`useScopes`, `useTrustSheet` and `startNewChat` mocked):
    - The menu lists `All scopes`, `Everywhere` and two scopes. Choosing one calls `onScopeChange` with its id, and choosing `All scopes` calls it with `undefined`.
    - The Trust button reads `Trust: Auto` with no setting and calls `open`.
    - `New chat` with `scopeId="p1"` calls `startNewChat({ scopeId: 'p1' })`.
  - `routing.test.ts`:
    - `routes/index.tsx` contains `ReviewHome`.
    - `Route.options.beforeLoad({ search: { copilotId: 'c1' } })` throws a redirect to `/new` with `{ copilotId: 'c1' }`.
    - With `{ search: {} }` it returns without throwing.
- [ ] **Step 2: Run** `pnpm test -- src/renderer/components/review/ReviewToolbar.test.tsx src/renderer/routes/routing.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Regenerate the route tree with `pnpm build:renderer`.
- [ ] **Step 4: Run** the tests and `pnpm check`. Expected: PASS, with no new tsc errors.
- [ ] **Step 5: Commit** `feat(review): Review is home, with scope filter, Trust and New chat`.

### Task 6: Empty states RV5 and EM2

**Files:**
- Create: `src/renderer/components/review/ReviewEmpty.tsx`
- Modify: `ReviewHome.tsx`, `review-home.css`
- Test: `src/renderer/components/review/ReviewEmpty.test.tsx` (jsdom)

**Interfaces:**
- Consumes: 1b's `Mascot`; `useLastCheckedAt`, `useReviewEntries`, `waitingCount`; Task 2's `formatLastChecked`, `hasSources`; slice 7's `listSources()` once merged (passed as `sourceCount: listSources().length`; until then `sourceCount` is omitted); `navigateToSettings` from `@/modals/Settings`; `platform.showQuickWindow`.
- Produces: `ReviewEmpty(props: { variant: 'caught-up' | 'no-sources'; lastCheckedAt?: number }): JSX.Element`; `ReviewHome` gains `props: { sourceCount?: number }`, which it passes to `hasSources`. The route omits it until slice 7 merges; slice 7 then passes `sourceCount={listSources().length}` from the route (`routes/index.tsx`).

Which screen shows:
- When `hasSources` is false, EM2 is the whole content.
- Otherwise, when nothing is waiting, RV5 fills the feed's `caughtUp` slot, so any Done rows stay below it.

RV5: `<Mascot state="done" size={56} />`, then the heading `Nothing needs you`, then the `Last checked …` line, but only when `lastCheckedAt` is known.

EM2: `<Mascot state="idle" size={56} />`, then the heading and line from Global Constraints, then two buttons:
- primary `Connect a source`: `navigateToSettings('/sources')`;
- secondary `Ask anything`: `platform.showQuickWindow()` when it is defined, else `startNewChat()`.

- [ ] **Step 1: Write the failing tests:**
  - caught-up shows `Nothing needs you` and the formatted line, and shows no line without `lastCheckedAt`;
  - no-sources shows both buttons, and `Connect a source` calls `navigateToSettings('/sources')`;
  - `ReviewHome` with no entries shows EM2 and not RV5; with `sourceCount={1}` and no entries it shows RV5, not EM2; with `sourceCount={0}` and a done row it shows EM2;
  - with one done row it shows RV5 above that row;
  - with one waiting row it shows neither.
- [ ] **Step 2: Run** `pnpm test -- src/renderer/components/review/ReviewEmpty.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** it. Expected: PASS.
- [ ] **Step 5: Commit** `feat(review): all caught up and before-any-source states`.

### Task 7: Sidebar Review row and badge

**Files:**
- Create: `src/renderer/components/review/SidebarReviewRow.tsx`
- Modify: `src/renderer/Sidebar.tsx:292-358` (the row goes first in `rail-nav`, in both the icon rail and the expanded list), `src/renderer/static/globals.css` (`.rail-icon-btn .dg-badge`: absolute, top-right of the icon)
- Test: `src/renderer/components/review/SidebarReviewRow.test.tsx` (jsdom)

**Interfaces:**
- Consumes: `useReviewWaitingCount()`; `useLocation()`.
- Produces: `SidebarReviewRow(props: { variant: 'rail' | 'expanded'; onNavigate(): void }): JSX.Element`.
  - Shows Lucide `Inbox` (16 px, stroke 1.8) and the label `Review`.
  - Shows a `dg-badge` with the count when it is above 0, reading `99+` above 99.
  - Accessible name: `Review, 3 waiting`, or `Review` with nothing waiting.
  - At `/` it gets `aria-current="page"` and `studio-rail-row-active`.
  - A click navigates to `/` and closes the drawer on small screens.

- [ ] **Step 1: Write the failing tests:**
  - With a count of 0 there is no badge and the name is `Review`.
  - Seed two open proposals, one open needs-you, one open conflict, one open change and one done row. The badge reads `4` and the name is `Review, 4 waiting`.
  - With 120 waiting the badge reads `99+` (Review Focus 5).
  - At `/` the row has `aria-current="page"`.
  - In the rail variant the badge sits inside the 56 px rail: the CSS rule is `position: absolute`.
- [ ] **Step 2: Run** `pnpm test -- src/renderer/components/review/SidebarReviewRow.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** the row and place it in both sidebar layouts.
- [ ] **Step 4: Run** `pnpm test`, `pnpm check` and `pnpm lint`. Expected: all pass, and the tsc error count equals `main`'s.
- [ ] **Step 5: Commit** `feat(sidebar): Review row with waiting count`.

### Task 8: Look at it, then record it

**Files:**
- Modify: `docs/log.md` (one line under the finishing day)

- [ ] **Step 1:** Run `pnpm dev:web`. Seed one entry of every kind with `addReviewEntry` from the dev console, and register a fake `'draft'` applier. Check light and dark against RV1, RV3, RV5, EM2, TR1 and DK1:
  - day headings;
  - the focus ring on the focused row;
  - the toast bottom-centre;
  - Trust Auto turning a safe draft into Done with Undo, and Ask leaving it as a Proposal;
  - blue only on the badge and on Needs you marks.

  Walk the keys: J/K, A, E then ⌘↵, X, ↵, ⌘Z, and Tab from row to row.
- [ ] **Step 2:** Fix what the walk shows. Give each fix a test in the file that owns it, and commit it as `fix(review): …`.
- [ ] **Step 3:** Run `pnpm test`, `pnpm check` and `pnpm lint`. Report passed, failed and not run, as `.claude/skills/dango-verify-change` asks. `dev:web` does not exercise the desktop IndexedDB path or the Quick Chat window; say so.
- [ ] **Step 4:** Add the log line and commit `docs: log the Review home slice`.

## Contract questions

Resolved with the coordinator, 2026-10-17:
- The register now lists `registerReviewApplier`, `getReviewApplier`, `getTrustLevel`, `canUndoArrival` and `undoArrival` as slice 5's; slice 10 registers its Gmail applier with them.
- 1b's renderer registry looks up `kind:ref.type`, then bare `kind`, so draft proposals fall through to the default renderer without special routing.
- An `actionLabel` with an opener drives the primary button, and E on a row with no Edit calls `openReviewEntry`.
- "Any source connected" is slice 7's `listSources().length > 0`.
- Slice 9's skipped-source entries use `ref.type 'setup'` with their own opener, so the `question` default stays.

Open:
1. Keys press buttons by accessible name (`Approve`, `Edit`, `Dismiss`, `Keep this`) and by the primary class. Slice 4's renderers must keep those labels. (Confirmed by the coordinator.)
2. Slice 7 calls `setLastCheckedAt` (confirmed).
