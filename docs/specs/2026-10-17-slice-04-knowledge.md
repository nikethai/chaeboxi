---
type: plan
status: draft
description: "Slice 4 of the redesign: approved knowledge per scope and Everywhere, proposals from chat, approve, edit, remove, move, conflicts, undo, the Knowledge tab, and the one-time move of old memory"
generated: { by: claude/opus-5.5, at: 2026-10-17T19:00:00+07:00 }
---
# Slice 4: Knowledge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Knowledge the user approved, per scope and in Everywhere, is the only knowledge chat answers from. It arrives as proposals (an inline card under an answer, or background review through the API) and can be approved, edited, removed, moved or added by hand, each with a 5 s undo. A contradiction becomes a Conflict with Keep this or Keep both. Old memory moves in once, through a sheet where the user picks a place for each note.

**Architecture:** Knowledge gets its own store, one immediate storage key `knowledge` read through a zustand store in `src/renderer/packages/knowledge/`, rather than reusing the memory banks. Memory entries are written without approval and have no status, versions, sources, conflicts or scope, so stretching `MemoryEntry` would change every memory caller and the memory sync at once. What is reused is the memory worker's fact extractor, which becomes the chat proposer, and its tokenizer, which becomes the contradiction prefilter. The old banks become read-only input to the one-time move and stop reaching the model once that move is done. Every write reads the whole document fresh from storage, changes it and writes it back inside one promise chain. That keeps multi-record changes atomic (a conflict outcome touches a proposal, items and Review entries) and stops a second window (Quick Chat) from overwriting the first. Each user action keeps the pre-images of what it touched, and the action itself pushes slice 1b's undo record (`group: 'knowledge'`) whose `undo` puts them back.

**Tech Stack:** React 18, Mantine 7, zustand 5 + immer, zod, slice 1b's `@/packages/undo`, `@/packages/review` and `Sheet`, Vitest 4 (+ jsdom, Testing Library), Biome.

**Spec:** `docs/specs/2026-10-17-redesign-roadmap.md` (slice 4 row, Shared types, Contract register, Decisions); `docs/specs/2026-10-16-ux-flows.md` flows 3, 4, 5, 12, 16, "Conflict outcomes (RV6, RV7)", "Knowledge after approval (KN1–KN3)"; ADR 0001, 0002, 0013; `design/dango/README.md` (voice, sheets, toasts).

## Global Constraints

- **Needs 1b:** `pushUndo`, `undoEntry` and `DEFAULT_UNDO_MS` from `@/packages/undo` (1b also mounts `<UndoToast />` and `useUndoHotkey()`; this slice adds no toast or hotkey of its own). Also from 1b: `ReviewEntry`, `ReviewKind` from `@shared/types/review`; `addReviewEntry`, `updateReviewEntry`, `setReviewEntryState`, `listReviewEntries`, `registerReviewRenderer`, `ReviewRendererProps`, `openReviewEntry` from `@/packages/review`; and `Sheet` from `@/components/ui/Sheet`.
- **Needs 3:** `EVERYWHERE_SCOPE_ID`, `ScopeSchema`, `readsEverywhereFor(scope)` and `isEverywhere(id)` from `@shared/types/scope`. Scopes are stored in `myProjectsAtom` (`hooks/useFolders.ts:9`), and a session's scope is read with `getEffectiveProjectId` (`projects/project-context.ts:25`). Slice 3 also provides `moveSessionToScope` and the placeholders this slice fills: `ScopeKnowledgeTab({ scope })` and `useScopeKnowledgeCount` in `src/renderer/components/scope/`, and the `EverywherePage` sections `data-section="preferences" | "facts"`.
- Register names this slice owns, exactly: `proposeKnowledge(input: Omit<KnowledgeProposal, 'id' | 'createdAt'>)`: adds the Proposal or the Conflict Review entry itself; `approveProposal(id, opts?: { text?: string }): Promise<KnowledgeItem>`; `deferProposal(id)`, `listDontSuggest()`, `allowSuggestAgain(id)`, `markSourceRemoved(sourceId)`; `KnowledgeProposal.origin` adds `'user'`; `KnowledgeSource.sourceId?`; message field `knowledgeIds?: string[]`; the Review renderers for `proposal`, `conflict` and `re-check`. Other roadmap names: `listKnowledge`, `dismissProposal`, `editKnowledge`, `removeKnowledge`, `moveKnowledge`, `resolveConflict`, `knowledgeForTurn`. Further public names: `addKnowledge`, `KnowledgeConflictError`, `listProposals`, `getConflict`, `recordKnowledgeUse`, `listKnowledgeUses`, `moveProposalsForSession`, `ensureKnowledgeLoaded`, `initKnowledge`, `KnowledgeTab`, `EverywhereKnowledge`. Added fields: `KnowledgeItem.overrides?`; `KnowledgeProposal.sessionId?`, `.messageId?`, `.deferred?`, `.overrides?`, `.checkedAt?`.
- **Undo contract:** every user-facing knowledge mutator (approve, add, dismiss, edit, remove, move, resolve) pushes its own undo record: `pushUndo({ group: 'knowledge', message, undo })`, where `message` is the toast copy below. Callers, including slice 5's feed keys, must not push a second record. Background writes (`proposeKnowledge`, `recordKnowledgeUse`, `markSourceRemoved`) push nothing.
- ADR 0001 (roadmap Decision): Trust Auto never approves knowledge; proposals always wait, and pending proposals never enter answer context. ADR 0013 (Decision): a preference approved anywhere is saved in Everywhere, with no question asked. Preferences apply in every scope. Everywhere facts and decisions apply when `readsEverywhereFor(scope).facts`. A scope item wins over the Everywhere items it `overrides`. "Never send email" is a built-in Everywhere preference (id `builtin:never-send-email`) that cannot be edited, removed or moved.
- Values: dismiss-repeat window `DONT_SUGGEST_WINDOW_MS = 30 * 24 * 60 * 60 * 1000`. Chat proposal cadence is `memorySettings.retainEveryNTurns` (default 3), gated by `isSessionMemoryAutoSaveAllowed` (`packages/memory/session-policy.ts:10`). While a proposal is being edited, ⌘↵ / Ctrl+↵ approves.
- Storage (dango-storage-migration skill): new keys `knowledge` and `knowledge-migration`, both in `immediateKeys`, stored in IndexedDB on desktop. No `CurrentVersion` bump: nothing existing changes shape, and this slice never writes or deletes the memory keys. `MessageSchema` gains `knowledgeIds: z.array(z.string()).optional()`.
- Copy: sentence case and no emoji. Undo messages are in the past tense. Quoted text is cut to 60 characters with `…`.
  - Undo messages: `Approved "{text}" for {scope}` · `Added "{text}" to {scope}` · `Saved the new wording` · `Removed "{text}"` · `Moved "{text}" to {scope}` · `Kept "{text}"` · `Kept both, with a condition` · `Dismissed "{text}"`
  - A repeat dismiss carries `extra: { label: "Don't suggest this again" }`.
  - When an approve or add hits a contradiction: `toastActions.add('Waiting in Review: it contradicts "{old}"')`.
  - Re-check entry: `text` is the use's label. `sub` is `It used "{text}", which was replaced.`, `It used "{text}", which you edited.` or `It used "{text}", which you removed.` Actions: `Open` and `Dismiss`.
  - Proposal entry actions: `Approve`, `Edit`, `Dismiss`. While editing: `Approve` and `Cancel`.
  - Conflict entry: `Keep this` on each statement, then `Keep both, with a condition…` and `Dismiss`. The Keep both sheet has the title `Keep both`, the field `Both are true when…` and the primary button `Keep both`.
  - Card under an answer: `Save to {scope}?`, buttons `Approve` and `Not now`. With more than three proposals: `{n} more in Review`. On a contradiction the row reads `Waiting in Review: it contradicts "{old}"`.
  - Knowledge tab: Search placeholder `Search knowledge`. Filter chips `All`, `Facts`, `Decisions`, `Superseded`. Row actions `Edit`, `Move to…`, `Remove`; editing saves with `Save`. Detail sections `Sources`, `Applies to`, `History`, `Used in chats`. `(source removed)` after a removed source; `Replaced by "{text}"` on superseded rows; badge `Built in` on the built-in item. `Add knowledge` with the kinds `Fact`, `Decision`, `Preference`. Applies to, for a scope item: `{scope}`, plus `When {condition}`. For an Everywhere item: `All scopes`, plus `Client scopes read it unless turned off` for facts.
  - Migration sheet: Title `Choose where your saved notes go`. Body `Dango now keeps knowledge per scope, plus Everywhere for what applies to all of them. Pick a place for each note. Nothing is deleted.` Groups `Saved for every chat` and `Saved for {agent}`. Choices `Everywhere`, `{agent}'s prompt` and `Leave out`, with the hint `Built-in agents can't take notes in their prompt.` Buttons `Move {n} notes` (`Finish` when n = 0) and `Later`. Afterwards, toast `Moved {a} notes to Everywhere and {b} to agent prompts`.
- Out of this slice: 1b, the Review entries store, undo, toast, hotkey and `Sheet`; 5, the feed, its keys and filters and Trust arrival (it mounts this slice's renderers); 7, running background review and calling `markSourceRemoved`; 2, the Settings › Memory and privacy layout and the old memory editor's place (Task 9 fills its `useDontSuggestEntries` stub and adds its Everywhere row); 6b, message actions other than the one repoint in Task 8; 10, recording Gmail drafts as uses; 8, passing a scope from Quick Chat; 6c, ⌘K knowledge results; 3 and 7, EM1 and the Documents section in Everywhere.

## Review Focus

- Non-Latin text (Vietnamese, Thai, Chinese) in a proposal: the Latin-only tokenizer finds no overlap, yet the contradiction check must still compare it with the scope's items (Task 3 test `non-latin text still gets candidates`).
- No model is configured, or the provider is offline, when a proposal arrives or the user presses Approve: the proposal becomes a plain Proposal and approving saves it, with no conflict and no error (Task 3 test `checker failure is no conflict`, Task 4 test `approve without a model saves`).
- The user approves in the main window, then asks in Quick Chat (another window with its own store): the answer includes the new item (Task 6 test `fresh read before a turn`).
- A background proposal lands within 5 s of the user removing an item: Undo restores the item and keeps the new proposal (Task 1 test `revert restores only that commit's records`).
- The move of old memory runs twice (a crash after part of it, or Later then Move): no duplicate appears in Everywhere or in an agent prompt, and built-in or remote agents never get prompt text (Task 10 tests).

---

### Task 1: Types, store and revertible commits

**Files:**
- Create: `src/shared/types/knowledge.ts`, and in `src/renderer/packages/knowledge/`: `store.ts`, `text.ts`, `undo.ts`, `test-storage.ts`, `index.ts`
- Modify: `src/renderer/storage/StoreStorage.ts:6-41`: add `Knowledge = 'knowledge'` and `KnowledgeMigration = 'knowledge-migration'` to the enum. `StoreStorage.ts:74-83`: add both to `immediateKeys`.
- Test: `src/renderer/packages/knowledge/store.test.ts`

**Interfaces:**
- Produces, in `knowledge.ts`:
  - The roadmap's types: `KnowledgeKind`; `KnowledgeSource` (+ `sourceId?: string`); `KnowledgeEvent`; `KnowledgeItem` (+ `overrides?: string[]`); `KnowledgeProposal` (+ `sessionId?`, `messageId?`, `deferred?: boolean`, `overrides?: string[]`, `checkedAt?: number`, and origin `'chat' | 'background-review' | 'user'`).
  - The new types and functions below. `KnowledgeStateSchema` gives every array `.catch([])` and drops bad records one at a time, not the whole document.
  ```ts
  export type KnowledgeConflict = { id: string; scopeId: string; proposalId: string; itemIds: string[]; state: 'open' | 'resolved' | 'dismissed'; createdAt: number; resolvedAt?: number }
  export type KnowledgeUseRef = { type: 'chat' | 'draft' | 'change'; id: string; label: string }
  export type KnowledgeUse = { itemId: string; scopeId: string; ref: KnowledgeUseRef; at: number }
  export type DontSuggestEntry = { id: string; scopeId: string; text: string; textKey: string; addedAt: number }
  export type KnowledgeState = { version: 1; items: KnowledgeItem[]; proposals: KnowledgeProposal[]; conflicts: KnowledgeConflict[]; uses: KnowledgeUse[]; dontSuggest: DontSuggestEntry[]; dismissals: { textKey: string; scopeId: string; at: number }[] }
  export const KnowledgeStateSchema
  export function emptyKnowledgeState(): KnowledgeState
  ```
- Produces, in `text.ts`:
  - `knowledgeTextKey(text: string): string`: NFC, trim, collapse whitespace, lower case, strip trailing `.!?`.
  - `quote(text: string): string`: cut to 60 characters with `…`.
- Produces, in `store.ts`:
  - `knowledgeStore`: zustand, `{ state: KnowledgeState; migration: 'unknown' | 'pending' | 'done' }`.
  - `ensureKnowledgeLoaded(opts?: { fresh?: boolean }): Promise<void>`.
  - `commitKnowledge(mutate: (draft: KnowledgeState) => void): Promise<CommitResult>`, where `CommitResult = { touched: { items: string[]; proposals: string[]; conflicts: string[] }; revert: () => Promise<void> }`.
  - `onKnowledgeCommit(listener: (r: CommitResult, after: KnowledgeState) => void | Promise<void>): () => void`.
  - `_resetKnowledgeForTests()`.
- Produces, in `undo.ts`: `pushKnowledgeUndo(message: string, revert: () => Promise<void>, opts?: { extra?: { label: string; onClick: () => void }; onUndo?: () => Promise<void> }): string`. It calls `pushUndo({ group: 'knowledge', message, undo, extra })`, where `undo` awaits `revert()` and then `onUndo?.()`.
- Commit rule: inside one promise chain, read the document fresh from storage, apply `mutate` with immer, write it with `setItemNow`, set the store and call the listeners. `revert` puts back, onto a fresh read, the pre-image of every record (by id, per collection) that this commit created, changed or removed, and deletes records that did not exist before. It then runs as an ordinary commit, so listeners see it.

- [ ] **Step 1: Write the failing tests** in `store.test.ts`. Mock `@/storage` with `vi.mock('@/storage', async () => (await import('./test-storage')).default)`, which is Map-backed and provides `getItem`, `setItem`, `setItemNow` and `removeItem`. Mock `@/packages/undo` with spies.
  - `loads empty when nothing stored`.
  - `drops one bad record, keeps the rest`: stored `{ items: [validItem, { id: 1 }] }` loads one item.
  - `commit writes the whole document immediately`: `setItemNow` is called with `'knowledge'`.
  - `commit reads fresh`: write an item straight into the mock storage between two commits; both items end up stored.
  - `revert restores only that commit's records`: commit A sets an item's status to `removed`; commit B pushes a proposal; after `A.revert()` the item is `approved` and the proposal is still there.
  - `pushKnowledgeUndo uses the knowledge group`: `pushUndo` is called with `group: 'knowledge'` and the message, and calling its `undo` runs `revert` and then `onUndo`.
  - `knowledgeTextKey('  Launch is 6  Nov. ')` returns `'launch is 6 nov'`.
- [ ] **Step 2: Run** `pnpm test -- src/renderer/packages/knowledge/store.test.ts`. Expected: FAIL, modules not found.
- [ ] **Step 3: Implement** the types, schema, `text.ts`, `store.ts`, `undo.ts` and the two storage keys. `index.ts` re-exports only the public names.
- [ ] **Step 4: Run** the test, then `pnpm check`. Expected: PASS, no new tsc errors.
- [ ] **Step 5: Commit**: `feat(knowledge): knowledge types, store and revertible commits`.

### Task 2: Review sync, scopes and init

**Files:**
- Create: in `src/renderer/packages/knowledge/`: `review-sync.ts`, `scopes.ts`, `hooks.ts`
- Modify: `src/renderer/routes/__root.tsx`: call `initKnowledge()` once in a `useEffect` in `Root` (line 36 onward).
- Test: `src/renderer/packages/knowledge/review-sync.test.ts`

**Interfaces:**
- Consumes: Task 1; 1b's `addReviewEntry` and `setReviewEntryState`.
- Produces:
  - `scopeName(scopeId: string): string`: `'Everywhere'` for `EVERYWHERE_SCOPE_ID`, otherwise the scope's name, otherwise `'Unknown scope'`.
  - `getScopeReads(scopeId: string): { facts: boolean; documents: boolean }`: parses the `myProjectsAtom` entry with `ScopeSchema`, then calls `readsEverywhereFor`. An unknown scope, or Everywhere, gets the project defaults.
  - `startReviewSync(): () => void`.
  - `initKnowledge(): Promise<void>`: once per window, runs `ensureKnowledgeLoaded()` and `startReviewSync()`; Task 7 adds `registerKnowledgeRenderers()` to it.
  - `useKnowledgeList(scopeId, opts)`, `useProposalsForMessage(messageId)` and `useKnowledgeUses(itemId)`: zustand selectors.
- Sync rule: after each commit, for every touched proposal and conflict, set its entry with `addReviewEntry` (which merges an open entry with the same ref) or `setReviewEntryState`:
  - An open proposal that has no open conflict gets `kind: 'proposal'`, `ref: { type: 'proposal', id }`, `text` = the proposal text and `source` = the first source's label.
  - An open conflict gets `kind: 'conflict'`, `ref: { type: 'conflict', id }`, `text` = the new statement and `sub` = `Saved: "{old}"`; that proposal's own entry becomes `dismissed`.
  - An approved proposal or a resolved conflict becomes `done`; a dismissed one becomes `dismissed`; a record brought back by a revert becomes `open` again.
  - Every entry gets `scopeId` = the record's scope.

- [ ] **Step 1: Write the failing tests** (Task 1's storage mock; `@/packages/review` mocked with spies):
  - `new proposal → open proposal entry`.
  - `proposal with an open conflict → conflict entry, proposal entry dismissed`.
  - `removed proposal → dismissed`.
  - `reverted removal → open`.
  - `scopeName for everywhere and unknown ids`.
  - `getScopeReads uses readsEverywhereFor for a client scope`.
- [ ] **Step 2: Run** `pnpm test -- src/renderer/packages/knowledge/review-sync.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement**.
- [ ] **Step 4: Run** the test. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(knowledge): keep Review entries in step with proposals and conflicts`.

### Task 3: Contradiction check, propose, dismiss and Don't suggest again

**Files:**
- Create: in `src/renderer/packages/knowledge/`: `contradictions.ts`, `proposals.ts`
- Modify: slice 3's `moveSessionToScope`: after its session write succeeds, it calls `moveProposalsForSession(sessionId, scopeId ?? EVERYWHERE_SCOPE_ID)`.
- Test: `src/renderer/packages/knowledge/contradictions.test.ts`, `src/renderer/packages/knowledge/proposals.test.ts`

**Interfaces:**
- Consumes: Tasks 1 and 2; `tokenizeForIndex` (`packages/memory/query-index.ts:84`); the same model resolution as `extractFactsFromTranscript` (`packages/memory/extract.ts:59-97`).
- Produces:
  ```ts
  export type ContradictionChecker = (input: { text: string; candidates: KnowledgeItem[] }) => Promise<string[]>
  export function selectCandidates(text: string, items: KnowledgeItem[], limit?: number): KnowledgeItem[] // default 8
  export function setContradictionCheckerForTests(fn: ContradictionChecker | null): void
  export function checkAgainstLayers(input: { text: string; targetScopeId: string }): Promise<{ conflictsWith: string[]; overrides: string[]; ok: boolean }>
  export function proposeKnowledge(input: Omit<KnowledgeProposal, 'id' | 'createdAt'>): Promise<KnowledgeProposal | null>
  export function dismissProposal(id: string, opts?: { dontSuggestAgain?: boolean }): Promise<{ offerDontSuggest: boolean }>
  export function deferProposal(id: string): Promise<void>
  export function listProposals(opts?: { scopeId?: string; messageId?: string }): KnowledgeProposal[]
  export function getConflict(id: string): KnowledgeConflict | undefined
  export function moveProposalsForSession(sessionId: string, toScopeId: string): Promise<number>
  export function listDontSuggest(): DontSuggestEntry[]
  export function allowSuggestAgain(id: string): Promise<void>
  ```
- Target scope: Everywhere when `kind === 'preference'`, otherwise the input's scope.
- Check: the candidates are the approved items of the target scope, plus approved Everywhere facts and decisions when the target is not Everywhere. One checker call covers both. Returned ids in the target scope go to `conflictsWith`; ids in Everywhere go to `overrides`. A checker error returns `{ conflictsWith: [], overrides: [], ok: false }` and logs a warning.
- `selectCandidates` ranks items by shared tokens and drops items that share none. When the text has fewer than 2 tokens, it returns the `limit` most recently updated items instead. No candidates means `[]` with no model call.
- The default checker asks the session's default chat model, with this system prompt: `You compare a new statement with saved statements. Return only JSON {"contradicts": [ids]} listing the saved statements that cannot be true at the same time as the new one. A statement that adds detail or is about something else does not contradict.` Ids that are not among the candidates are dropped.
- `proposeKnowledge` returns `null` and stores nothing when the text key is:
  - on the Don't suggest list for the target scope or for Everywhere;
  - the same as an approved item's key in the target scope;
  - the same as an open proposal's key there.
- Otherwise it runs the check and stores the proposal with `scopeId` = target, the input's `conflictsWith` plus the found ids, `overrides`, and `checkedAt` when the check succeeded (`ok`). If `conflictsWith` is not empty, it also stores an open `KnowledgeConflict` (`itemIds` = `conflictsWith`). Task 2's sync then adds the matching entry. It pushes no undo.
- `dismissProposal` records `{ textKey, scopeId, at }`, closes the proposal's open conflict (`dismissed`) and pushes `Dismissed "{text}"`.
  - `offerDontSuggest` is true when an earlier dismissal of the same key in that scope is younger than `DONT_SUGGEST_WINDOW_MS`. The record then carries `extra: { label: "Don't suggest this again", onClick: () => dismissProposal(id, { dontSuggestAgain: true }) }`.
  - With `dontSuggestAgain`, it adds a `DontSuggestEntry` (whose `onClick` call is idempotent).
- `deferProposal` sets `deferred: true`; the Review entry stays open.

- [ ] **Step 1: Write the failing tests** (`@/packages/undo` and `@/packages/review` mocked):
  - `contradictions.test.ts`: `non-latin text still gets candidates`: `selectCandidates('Hạn chót là 6/11', items)` returns the 8 most recently updated items. `selectCandidates('launch date moved', items)` excludes items that share no token. `default checker filters unknown ids`: the model, mocked to reply `{"contradicts":["a","zzz"]}` with candidates `a` and `b`, gives `['a']`. `checker failure is no conflict`: a throwing model gives `{ conflictsWith: [], overrides: [], ok: false }`.
  - `proposals.test.ts`: `same-scope contradiction stores a conflict`: the fake checker returns the id of an `acme` item; an open conflict exists and the proposal has `conflictsWith`. `Everywhere clash is an override, not a conflict`. `preference targets Everywhere`. `duplicate of an approved item is dropped`: proposing "launch is 6 nov." against the approved "Launch is 6 Nov" returns `null`. `second dismiss within 30 days carries the extra, the first does not`. `after 31 days it does not`. `don't suggest again blocks that scope, Everywhere entries block every scope, allowSuggestAgain lets it through`. `defer keeps it listed with deferred: true`. `moveProposalsForSession moves only that session's proposals and returns the count`.
- [ ] **Step 2: Run** `pnpm test -- src/renderer/packages/knowledge/contradictions.test.ts src/renderer/packages/knowledge/proposals.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement**, including the one-line call in `moveSessionToScope`.
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(knowledge): proposals with contradiction check, dismiss and don't suggest again`.

### Task 4: Approve and add by hand

**Files:**
- Create: `src/renderer/packages/knowledge/approve.ts`
- Test: `src/renderer/packages/knowledge/approve.test.ts`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces:
  ```ts
  export class KnowledgeConflictError extends Error { conflict: KnowledgeConflict; oldText: string }
  export function approveProposal(id: string, opts?: { text?: string }): Promise<KnowledgeItem>
  export function addKnowledge(input: { scopeId: string; kind: KnowledgeKind; text: string }): Promise<KnowledgeItem>
  ```
- `approveProposal` throws `Error('missing')` for an unknown id, and `KnowledgeConflictError` when the proposal already has an open conflict. It runs `checkAgainstLayers` again only in three cases: the text was edited, `checkedAt` is unset, or an approved item in the target scope or in Everywhere has `updatedAt > checkedAt`.
  - If the check finds a new same-scope contradiction, the proposal (with any edited text) stays open with a new open conflict, the call throws `KnowledgeConflictError`, and the caller shows `Waiting in Review: it contradicts "{old}"`.
  - Otherwise it saves `{ status: 'approved', scopeId: target, overrides, sources, history: [{ action: 'proposed', by: origin === 'background-review' ? 'background-review' : origin === 'chat' ? 'chat' : 'user', note: original text when edited }, { action: 'approved', by: 'user' }] }`, removes the proposal and pushes `Approved "{text}" for {scope}`.
- `addKnowledge` runs `proposeKnowledge({ origin: 'user', sources: [{ kind: 'user', label: 'You' }], … })` and then approves the result. The undo message is `Added "{text}" to {scope}`. A conflict throws `KnowledgeConflictError`; the Conflict entry is already in Review. A text that is already known throws `Error('duplicate')`.

- [ ] **Step 1: Write the failing tests**:
  - `approve saves with source and history`.
  - `edited text is saved, original kept in the proposed event's note`.
  - `preference approved for acme lands in Everywhere`.
  - `approve of a conflicted proposal throws KnowledgeConflictError`.
  - `edited text that contradicts creates a conflict and throws`.
  - `approve without a model saves`: the checker throws; the item is approved.
  - `no re-check when nothing changed`: the checker spy is not called when `checkedAt` is set, the text is unedited and no item is newer.
  - `approve pushes the knowledge undo and undo brings the proposal back`.
  - `addKnowledge saves as the user`: source `{ kind: 'user', label: 'You' }`.
- [ ] **Step 2: Run** `pnpm test -- src/renderer/packages/knowledge/approve.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement**.
- [ ] **Step 4: Run** the test. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(knowledge): approve proposals and add knowledge by hand`.

### Task 5: Lifecycle, conflict outcomes, uses and Re-check

**Files:**
- Create: in `src/renderer/packages/knowledge/`: `lifecycle.ts`, `conflicts.ts`, `uses.ts`
- Test: `src/renderer/packages/knowledge/lifecycle.test.ts`, `src/renderer/packages/knowledge/conflicts.test.ts`

**Interfaces:**
- Consumes: Tasks 1–4; 1b's `addReviewEntry` and `setReviewEntryState`.
- Produces:
  ```ts
  export const NEVER_SEND_EMAIL: KnowledgeItem // id 'builtin:never-send-email', EVERYWHERE, preference, 'Never send email', source { kind: 'user', label: 'Built in' }, approved, history []
  export function listKnowledge(scopeId: string, opts?: { status?: KnowledgeItem['status'][]; kind?: KnowledgeKind[]; query?: string }): KnowledgeItem[]
  export function editKnowledge(id: string, text: string): Promise<KnowledgeItem>
  export function removeKnowledge(id: string): Promise<void>
  export function moveKnowledge(id: string, toScopeId: string): Promise<KnowledgeItem>
  export function markSourceRemoved(sourceId: string): Promise<number> // sources with that sourceId on items and proposals get removed: true
  export function resolveConflict(conflictId: string, choice: { keep: string } | { keepBoth: string }): Promise<void>
  export function recordKnowledgeUse(itemIds: string[], ref: KnowledgeUseRef): Promise<void> // newest 50 per item; the same item+ref updates `at`
  export function listKnowledgeUses(itemId: string): KnowledgeUse[]
  ```
- `listKnowledge`:
  - The default status is `['approved']`.
  - For Everywhere, `NEVER_SEND_EMAIL` comes first whenever approved items are asked for.
  - `query` matches case- and accent-insensitively (NFD, marks stripped).
  - Results are newest `updatedAt` first.
  - The Superseded chip passes `['superseded', 'removed']`.
- `editKnowledge` replaces the text and adds an `edited` event with `note` = the previous text.
- `removeKnowledge` sets `status: 'removed'` and adds a `removed` event.
- `moveKnowledge` changes `scopeId`, adds a `moved` event with `note: 'from {old scope name}'` and clears `overrides`.
- Each of the three pushes its undo message. Each refuses the built-in id (`Error('built-in')`), a missing id (`Error('missing')`) and blank text (`Error('empty')`).
- Keep this (`keep` = the proposal id, or one of `itemIds`):
  - The kept statement is approved; a kept proposal becomes an item as in Task 4.
  - Each loser gets `status: 'superseded'`, `supersededBy` = the winner's id, and a `superseded` event.
  - A losing proposal is stored as a superseded item with the events `proposed` and `superseded`, so its history stays visible.
  - The conflict becomes `resolved`. The undo message is `Kept "{text}"`.
- Keep both: the condition is trimmed; an empty one throws `Error('condition-required')` and changes nothing. Otherwise the proposal is approved, and every involved item gets `condition` and a `kept-both` event with `note` = the condition. The undo message is `Kept both, with a condition`.
- Re-check: after an edit, a remove or a superseding, every use of the affected item with `ref.type` `draft` or `change` gets an `addReviewEntry({ kind: 're-check', scopeId, text: use.ref.label, sub, ref: use.ref })` with the copy from Global Constraints. Those entry ids are dismissed in the action's `onUndo`.

- [ ] **Step 1: Write the failing tests**:
  - `lifecycle.test.ts`: `edit keeps the old wording in history`. `remove, then the pushed undo restores approved`. `removed shows under Superseded`. `move to Everywhere and back records two moved events`. `built-in item is listed first in Everywhere and cannot be edited, removed or moved`. `search ignores accents`: `'cafe'` finds `'Café opens at 8'`. `markSourceRemoved marks matching sources only`. `edit of an item a draft used adds one re-check with sub 'It used "Launch is 4 Nov", which you edited.'`.
  - `conflicts.test.ts`: `keep the new one supersedes the old and re-checks its draft`: the old item was used by `{ type: 'draft', id: 'd1', label: 'Reply to Acme' }` and by a chat. There is exactly one `re-check`, with `text: 'Reply to Acme'` and `sub: 'It used "Launch is 4 Nov", which was replaced.'`. `keep the old one stores the proposal as superseded history`. `keep both writes the condition on both`. `blank condition throws and changes nothing`. `undo of keep this dismisses the re-check and reopens the conflict`. `uses are capped at 50 per item`.
- [ ] **Step 2: Run** `pnpm test -- src/renderer/packages/knowledge/lifecycle.test.ts src/renderer/packages/knowledge/conflicts.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement**.
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(knowledge): edit, remove, move, conflict outcomes and re-check items`.

### Task 6: knowledgeForTurn and chat context

**Files:**
- Create: `src/renderer/packages/knowledge/for-turn.ts`
- Modify:
  - `src/shared/types/session.ts:353`: add `knowledgeIds: z.array(z.string()).optional()` to `MessageSchema`.
  - `src/renderer/packages/model-calls/message-utils.ts:276-318`: `buildMemorySection` returns `''` unless `isLegacyMemoryActive()`. `injectModelSystemPrompt` takes `knowledgeSection?: string` after `memory` and puts it before the memory section.
  - `src/renderer/packages/model-calls/stream-text.ts:317-323`: new param `knowledgeScopeId?: string | null`.
  - `stream-text.ts:497-501` and `:668-671`: `memoryToolsAvailable` and `hostLookupOn` also require `isLegacyMemoryActive()`.
  - `stream-text.ts:634-644`: `await ensureKnowledgeLoaded({ fresh: true })`, compute `items = knowledgeForTurn(knowledgeScopeId ?? EVERYWHERE_SCOPE_ID)`, then pass `formatKnowledgeSection(...)`.
  - `streamText`'s return value gains `knowledgeIds: string[]` (the ids of `items`, without the built-in).
  - `src/renderer/stores/session/generation.ts:1108` and `:1289`: pass `knowledgeScopeId: getEffectiveProjectId(session) ?? null`. After the first call, set `targetMsg.knowledgeIds` and `void recordKnowledgeUse(knowledgeIds, { type: 'chat', id: session.id, label: session.name })` when the list is not empty.
- Test: `src/renderer/packages/knowledge/for-turn.test.ts`, plus additions to `src/renderer/packages/model-calls/message-utils.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function knowledgeForTurn(scopeId: string): KnowledgeItem[]
  export function formatKnowledgeSection(scopeId: string, items: KnowledgeItem[]): string
  export function isLegacyMemoryActive(): boolean // memoryStore settings.enabled && knowledgeStore migration !== 'done'
  ```
- Order:
  1. The scope's approved items, newest first.
  2. Everywhere preferences, always, `NEVER_SEND_EMAIL` included.
  3. Everywhere facts and decisions, when `getScopeReads(scopeId).facts`.
  - Leave out any Everywhere item listed in an included scope item's `overrides`.
  - For Everywhere itself: only its own approved items.
  - Proposals never appear.
- Section text:
  - `\n## Approved knowledge: {scope name}\n- {text}`, with ` (when {condition})` when a condition is set.
  - Then `## Approved knowledge: Everywhere\n…`.
  - Then the line `If an item for {scope name} disagrees with an Everywhere item, follow the {scope name} item.`
  - An empty list gives `''`.

- [ ] **Step 1: Write the failing tests**:
  - `scope items come first, then Everywhere preferences and facts`.
  - `client scope with facts off gets preferences only`.
  - `client scope without readsEverywhere reads facts`.
  - `overridden Everywhere item is left out`.
  - `pending proposals and superseded items are never included`.
  - `fresh read before a turn`: write an item straight into mock storage, then after `await ensureKnowledgeLoaded({ fresh: true })`, `knowledgeForTurn` contains it.
  - In `message-utils.test.ts`: `knowledge section is in the system prompt and memory section is not once migration is done`.
- [ ] **Step 2: Run** `pnpm test -- src/renderer/packages/knowledge/for-turn.test.ts src/renderer/packages/model-calls/message-utils.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `for-turn.ts` and the wiring.
- [ ] **Step 4: Run** the tests, then `pnpm test -- src/renderer/packages/model-calls src/renderer/stores/session` and `pnpm check`. Expected: PASS, no regressions.
- [ ] **Step 5: Commit**: `feat(knowledge): answers read approved knowledge per scope and Everywhere`.

### Task 7: Review renderers: proposal (RV2), conflict (RV4, RV6, RV7), re-check

**Files:**
- Create: in `src/renderer/packages/knowledge/review/`: `ProposalRenderer.tsx`, `ConflictRenderer.tsx`, `KeepBothSheet.tsx`, `RecheckRenderer.tsx`, `register.ts`
- Modify: `src/renderer/packages/knowledge/index.ts` (`initKnowledge()` also calls `registerKnowledgeRenderers()`)
- Test: `src/renderer/packages/knowledge/review/renderers.test.tsx`

**Interfaces:**
- Consumes: `ReviewItem` (`components/review/ReviewItem.tsx`); 1b's `Sheet`, `ReviewRendererProps`, `registerReviewRenderer`, `openReviewEntry` and `setReviewEntryState`; Tasks 3–5.
- Produces:
  - `registerKnowledgeRenderers(): () => void`, which calls `registerReviewRenderer('proposal', ProposalRenderer, { refType: 'proposal' })`, `registerReviewRenderer('conflict', ConflictRenderer, { refType: 'conflict' })` and `registerReviewRenderer('re-check', RecheckRenderer)`, so a slice-10 draft proposal (`ref.type: 'draft'`) never reaches `ProposalRenderer`.
  - `ProposalRenderer`, `ConflictRenderer` and `RecheckRenderer`, each taking `ReviewRendererProps`.
  - `KeepBothSheet(props: { opened: boolean; onClose: () => void; onConfirm: (condition: string) => void })`.
- Proposal: `ReviewItem` of kind `proposal` with the actions `Approve`, `Edit` and `Dismiss`.
  - `Edit` swaps the text for a textarea (RV2) with the actions `Approve` and `Cancel`. ⌘↵ / Ctrl+↵ in the textarea approves the edited text.
  - Approve catches `KnowledgeConflictError` and shows the contradiction toast.
- Conflict: `dg-item dg-item--conflict`.
  - Both statements are shown, each with its first source label, its date (`D MMM`) and its own `Keep this`, which calls `resolveConflict(ref.id, { keep: id })`.
  - The footer has `Keep both, with a condition…` and `Dismiss` (`dismissProposal(conflict.proposalId)`).
  - The `Keep both, with a condition…` button opens `KeepBothSheet`: first focus on the field (`data-autofocus`), primary button disabled while the field is blank.
- Re-check: `ReviewItem` of kind `re-check` with `Open` (`openReviewEntry(entry)`) and `Dismiss` (`setReviewEntryState({ id }, 'dismissed')`).

- [ ] **Step 1: Write the failing tests** (jsdom; `@/packages/knowledge` functions and `@/packages/review` mocked):
  - Proposal: `Edit`, then change the text, then ⌘↵ calls `approveProposal(id, { text: 'Launch is 7 Nov' })`. `Approve` with a rejected `KnowledgeConflictError` calls `toastActions.add('Waiting in Review: it contradicts "Launch is 4 Nov"')`.
  - Conflict: shows both texts and two `Keep this` buttons; the second calls `resolveConflict(c, { keep: oldId })`.
  - The sheet's `Keep both` is disabled for `'   '`, and calls `resolveConflict(c, { keepBoth: 'for the EU launch' })` for a real condition.
  - Re-check: `Open` calls `openReviewEntry`.
  - `registerKnowledgeRenderers` makes exactly those three calls, with those options; and against 1b's real registry, `getReviewRenderer` for a `proposal` entry with `ref.type: 'draft'` returns no slice-4 renderer.
- [ ] **Step 2: Run** `pnpm test -- src/renderer/packages/knowledge/review/renderers.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement**.
- [ ] **Step 4: Run** the test. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(knowledge): Review renderers for proposals, conflicts and re-check`.

### Task 8: Proposals from chat and the card under an answer (CH0)

**Files:**
- Create: `src/renderer/packages/knowledge/chat-proposer.ts`, `src/renderer/components/knowledge/KnowledgeProposalCard.tsx`, `src/renderer/components/knowledge/index.ts`
- Modify:
  - `src/renderer/stores/session/generation.ts:1212-1222`: replace the `maybeAutoSaveMemory` call with `proposeFromChatTurn`, with the same arguments plus `messageId: targetMsg.id`, `scopeId` and `sessionName: session.name`.
  - `src/renderer/components/chat/Message.tsx:910`: after `SourceCardList`, render `{msg.role === 'assistant' && !msg.generating ? <KnowledgeProposalCard sessionId={sessionId} messageId={msg.id} /> : null}`.
  - `Message.tsx:318-331`, plus the labels at `:608` and `:1019`: the action becomes `Save as knowledge` and calls `addKnowledge({ scopeId: getEffectiveProjectId(await chatStore.getSession(sessionId)) ?? EVERYWHERE_SCOPE_ID, kind: 'fact', text: getMemoryMessageText(msg).slice(0, 500) })`.
- Test: `src/renderer/packages/knowledge/chat-proposer.test.ts`, `src/renderer/components/knowledge/KnowledgeProposalCard.test.tsx`

**Interfaces:**
- Consumes: `extractFactsFromTranscript` and `transcriptFromMessages` (`packages/memory/extract.ts:59`, `:145`); `isSessionMemoryAutoSaveAllowed`; `memoryStore` settings; Tasks 3 and 4.
- Produces:
  - `proposeFromChatTurn(o: { sessionId: string; sessionName: string; messageId: string; scopeId: string | null; messages: Message[]; sessionSettings?: SessionSettings }): Promise<KnowledgeProposal[]>`.
  - `KnowledgeProposalCard(props: { sessionId: string; messageId: string }): JSX.Element | null`.
- Proposer:
  - Keeps its own turn counter per session and runs every `retainEveryNTurns` turns when allowed, with at most one run per session in flight.
  - Maps each extracted fact by tag: `preference` becomes a preference; `decision` becomes a decision; anything else is a fact.
  - Sets `scopeId` to `scopeId ?? EVERYWHERE_SCOPE_ID`, the source to `{ kind: 'chat', label: sessionName, ref: sessionId }`, `origin` to `'chat'`, and `sessionId` and `messageId`.
  - Logs extraction errors without a toast.
- Card:
  - Shows up to three of this message's proposals that are open and not `deferred`. Each row has `Save to {scope}?`, the text, `Approve` (`dg-btn dg-btn--primary`) and `Not now` (`dg-btn dg-btn--ghost`).
  - Shows `{n} more in Review` when there are more.
  - A proposal that already has a conflict, or a `KnowledgeConflictError` on Approve, shows `Waiting in Review: it contradicts "{old}"` in place of its buttons.
  - Renders nothing when there are no proposals.

- [ ] **Step 1: Write the failing tests**:
  - `chat-proposer.test.ts`: `runs on every third turn only`. `does nothing when the session opted out`. `preference tag goes to Everywhere, decision tag becomes a decision`. `unscoped chat proposes to Everywhere`.
  - `KnowledgeProposalCard.test.tsx` (`@vitest-environment jsdom`, knowledge API mocked): Two proposals show two `Approve` buttons; clicking one calls `approveProposal(id)`. `Not now` calls `deferProposal(id)`. A rejected `KnowledgeConflictError` shows `Waiting in Review: it contradicts "Launch is 4 Nov"`. Five proposals show three rows and `2 more in Review`.
- [ ] **Step 2: Run** `pnpm test -- src/renderer/packages/knowledge/chat-proposer.test.ts src/renderer/components/knowledge/KnowledgeProposalCard.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** the proposer and the card, then wire them in.
- [ ] **Step 4: Run** the tests and `pnpm check`. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(knowledge): proposals from chat with an inline card under the answer`.

### Task 9: Knowledge tab (KN1, KN2), Everywhere lists (EV1) and Memory and privacy (KN3) data

**Files:**
- Create: in `src/renderer/components/knowledge/`: `KnowledgeTab.tsx`, `KnowledgeItemDetail.tsx`, `AddKnowledgeForm.tsx`, `EverywhereKnowledge.tsx`
- Modify:
  - Slice 3's `src/renderer/components/scope/ScopeKnowledgeTab.tsx`: the body becomes `<KnowledgeTab scopeId={scope.id} />`.
  - `useScopeKnowledgeCount.ts`: returns `listKnowledge(scopeId).length`, reactive.
  - The `EverywherePage` sections `data-section="preferences"` and `"facts"`: render `<EverywhereKnowledge section="preferences" | "facts" />`, which replaces slice 3's fixed "Never send email" row.
  - Slice 2's `src/renderer/components/settings/privacy/useDontSuggestEntries.ts`: replace the stub body, keeping the signature `useDontSuggestEntries(): { items: DontSuggestRow[]; restore(id: string): Promise<void> }`. On mount it calls `ensureKnowledgeLoaded()`, then subscribes to `knowledgeStore`. `items` = `listDontSuggest()` mapped to `{ id, text, scopeLabel: scopeName(scopeId), at: addedAt }`, newest first. `restore` = `allowSuggestAgain(id)`.
  - Slice 2's `MemoryPrivacyPage.tsx`: add a section `Everywhere` between `Don't suggest again` and `Export`, with one `SettingsPrefRow` titled `Everywhere`, description `Preferences and facts every scope reads.`, and the button `Open Everywhere`, which navigates to `/scope/$scopeId` with `scopeId: 'everywhere'`.
- Test: `src/renderer/components/knowledge/KnowledgeTab.test.tsx`, plus slice 2's `src/renderer/components/settings/privacy/MemoryPrivacyPage.test.tsx`

**Interfaces:**
- Consumes: Tasks 2–5.
- Produces: `KnowledgeTab(props: { scopeId: string })`; `EverywhereKnowledge(props: { section: 'preferences' | 'facts' })` (preferences lists kind `preference`; facts lists `fact` and `decision`); `KnowledgeItemDetail(props: { item: KnowledgeItem })`.
- Tab:
  - A search field, the chips `All · Facts · Decisions · Superseded`, and rows newest first.
  - Selecting a row opens its detail: Sources, with `(source removed)` after a removed source. Applies to. History, one line per event: `{date} · {You | Background review | Chat | Migration} · {action}`, with notes. Used in chats, as links to `/session/{id}`.
  - Row actions: `Edit`: inline, `Save` calls `editKnowledge`. `Move to…`: a menu with Everywhere and every scope except the current one. `Remove`.
  - Superseded rows show `Replaced by "{text}"` and no actions. The built-in row shows `Built in` and no actions.
  - `Add knowledge` opens `AddKnowledgeForm`: kind, text, `Save` calls `addKnowledge` (a conflict shows the contradiction toast).

- [ ] **Step 1: Write the failing tests** (jsdom; the store seeded through the storage mock; `@/packages/undo` mocked):
  - Searching `acme` narrows the list to matching rows.
  - `Superseded` shows a removed item and hides approved ones.
  - `Edit`, then `Save`, calls `editKnowledge`.
  - `Move to…` lists `Everywhere` and not the current scope.
  - The detail lists a chat use as a link to `/session/s1`, and a history line `You · edited`.
  - The `preferences` section renders `Never send email` with `Built in` and no `Remove`.
  - In `MemoryPrivacyPage.test.tsx`, replace the stub test `useDontSuggestEntries() returns no items`. With one `DontSuggestEntry` (`text: 'Launch is 4 Nov'`, `scopeId: 'acme'`) seeded through the knowledge storage mock, the page lists `Launch is 4 Nov` with `Acme Co`, and clicking `Suggest again` calls `allowSuggestAgain` with its id; after that the row is gone and `Nothing here yet.` shows.
  - In `MemoryPrivacyPage.test.tsx`: the section titles read `Trust`, `Don't suggest again`, `Everywhere`, `Export` in that order, and clicking `Open Everywhere` navigates to `/scope/everywhere` (router mocked).
- [ ] **Step 2: Run** `pnpm test -- src/renderer/components/knowledge/KnowledgeTab.test.tsx src/renderer/components/settings/privacy`. Expected: FAIL.
- [ ] **Step 3: Implement**, then mount the components into slice 3's placeholders.
- [ ] **Step 4: Run** the test, slice 3's `ScopePage.test.tsx`, and `pnpm check`. Expected: PASS. Update the slice 3 placeholder assertion in that test to the new content.
- [ ] **Step 5: Commit**: `feat(knowledge): Knowledge tab, Everywhere lists and Memory and privacy data`.

### Task 10: One-time move of old memory

**Files:**
- Create: `src/renderer/packages/knowledge/migration.ts`, `src/renderer/components/knowledge/MemoryMigrationSheet.tsx`
- Modify: `src/renderer/routes/__root.tsx:226-229`: render `<MemoryMigrationSheet />` beside `SearchDialog`, but not on the quick route.
- Test: `src/renderer/packages/knowledge/migration.test.ts`, `src/renderer/components/knowledge/MemoryMigrationSheet.test.tsx`

**Interfaces:**
- Consumes: `getMemoryRepository().loadGlobal()` and `.loadAllAgentBanks()` (`packages/memory/repository.ts`); `getAgentDetailById`; `myCopilotsAtom` (`hooks/useCopilots.ts:11`); 1b's `Sheet`; the Task 1 store.
- Produces:
  ```ts
  export type MigrationChoice = 'everywhere' | 'agent-prompt' | 'leave-out'
  export type MigrationRow = { entryId: string; group: { scope: 'global' } | { scope: 'agent'; agentId: string; agentName: string; promptEditable: boolean }; text: string; kind: KnowledgeKind; choice: MigrationChoice; sourceSessionId?: string }
  export function planMemoryMigration(input: { global: MemoryBank; agents: { agentId: string; bank: MemoryBank }[]; describeAgent: (id: string) => { name: string; editable: boolean } }): MigrationRow[]
  export function applyMemoryMigration(rows: MigrationRow[]): Promise<{ everywhere: number; prompts: number; leftOut: number }>
  export function loadMigrationState(): Promise<'pending' | 'done'> // 'done' when stored, or when no live entries exist (then stored as done)
  ```
- Plan:
  - Skip `deleted` entries. Entries with `enabled === false` or `archived` default to `leave-out`.
  - Global entries default to `everywhere`.
  - Agent entries default to `agent-prompt` when the agent is editable (a local agent in `myCopilotsAtom` without `builtIn`), otherwise to `everywhere`.
  - Kind is `preference` for the tags `preference` or `pref`, `decision` for `decision`, and `fact` otherwise.
- Apply:
  - Everywhere rows become approved items in Everywhere. The source is `{ kind: 'chat', label: 'Earlier chat', ref: sourceSessionId }` when the session is known, else `{ kind: 'user', label: 'Saved earlier' }`. The event is `{ by: 'migration', action: 'approved', note: 'From saved notes' }`. Text keys already present are skipped.
  - Agent-prompt rows append `- {text}` under a `Standing notes:` block at the end of that agent's `prompt`, skipping lines already there. A non-editable agent never gets prompt text; its row falls back to Everywhere.
  - Write the items and prompts first. Then write `{ state: 'done', at, counts }` to `knowledge-migration` and set the store's `migration` to `'done'`.
  - Leave the memory keys untouched. Push no undo: this step is final, and the old banks stay as they were.
- Sheet:
  - Opens when `loadMigrationState()` returns `pending`, as a 1b `Sheet` with the copy from Global Constraints.
  - One row per note, with a three-way choice. Agent-prompt is hidden for global rows, and disabled with the hint for non-editable agents.
  - `Move {n} notes` applies the move and shows the result toast.
  - `Later` closes the sheet until the next launch.

- [ ] **Step 1: Write the failing tests**:
  - `migration.test.ts`: `defaults per group and kind from tags`. `deleted entries are skipped, disabled ones default to leave out`. `built-in agent falls back to Everywhere`. `applying twice adds nothing the second time`: items and prompts are unchanged. `state is written after the items`: check the order of the `setItemNow` keys. `empty banks mean done without a sheet`. `memory keys are never written`.
  - `MemoryMigrationSheet.test.tsx`: Two global rows and one agent row render under `Saved for every chat` and `Saved for Planner`. Switching one row to `Leave out` changes the button to `Move 2 notes`. `Later` closes the sheet without calling `applyMemoryMigration`.
- [ ] **Step 2: Run** `pnpm test -- src/renderer/packages/knowledge/migration.test.ts src/renderer/components/knowledge/MemoryMigrationSheet.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** the move and the sheet, then mount the sheet.
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(knowledge): one-time move of saved memory into Everywhere and agent prompts`.

### Task 11: Look at it, then record it

**Files:**
- Modify: `docs/log.md` (one line under the day the branch is finished)

- [ ] **Step 1:** Run `pnpm dev:web` with a configured model.
  - In a scope chat, ask three turns that state a fact and a preference.
  - Check the CH0 card, Approve, 1b's toast and ⌘Z.
  - State a contradicting fact. If slice 5 is not merged, view the Conflict through the dev gallery `routes/dev/design-system.tsx`, which gets one entry per registered renderer.
  - Check Keep this, Keep both, the Knowledge tab and EV1, in light and dark, against KN1, KN2, EV1, RV2–RV4, RV6 and RV7.
- [ ] **Step 2:** With a seeded old memory bank (global plus one local agent), restart.
  - The sheet appears once and Move works.
  - A second launch shows no sheet.
  - The next answer's system prompt has the knowledge section and no memory section.
- [ ] **Step 3:** Run `pnpm test`, `pnpm check` and `pnpm lint`. Expected: all pass, with a tsc error count equal to `main`'s. Report whether desktop IndexedDB and web storage were tested or not run (dango-verify-change).
- [ ] **Step 4:** Add the log line and commit: `docs: log the knowledge slice`.
