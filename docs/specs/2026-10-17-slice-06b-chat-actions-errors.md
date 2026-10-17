---
type: plan
status: draft
description: "Slice 6b of the redesign: message actions, the chat menu with undo, model errors with the fix as the button, rate-limit retries, ability checks, the cost sheet and the composer's / menu, drop overlay and first-chat suggestions"
generated: { by: claude/opus-5.5, at: 2026-10-17T19:00:00+07:00 }
---
# Slice 6b: Chat Actions, Menu, Errors and Cost Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Everything a person does to or around an answer works the redesign's way: Copy / Redo ▾ / thumbs with model · tokens · time, edit-and-resend that keeps the old answer, branches, a chat menu whose delete can be undone for 5 s, model errors that name the fix on their button, rate limits that retry on schedule and then ask, ability and cost checks before sending (never after), and a composer whose "/" lists skills then commands.

**Architecture:** Each rule lives in a small pure module with node tests (`classifyModelError`, `rateLimitDelayMs`, `parseRetryAfter`, `turnNeedsTools`, `estimateTurnCostUsd`, `buildChatMenuItems`, `formatAnswerMeta`, `firstChatSuggestions`); store actions sit beside the existing session modules (`stores/session/*.ts`) and reuse forks, `_copySession`, `generate`; components are thin. Shared pieces come from their owners in the roadmap's contract register: undo, `Sheet`, `addReviewEntry` and `RETRY_DELAYS_MS` from slice 1b, `useScopes` and `moveSessionToScope` from slice 3.

**Tech Stack:** React 18, Mantine 7 (menus, model selector), Lucide icons, Vercel AI SDK `APICallError`, Vitest 4 (+ jsdom, Testing Library), Zod, Biome.

**Spec:** `docs/specs/2026-10-16-ux-flows.md` (flows 15–19; Screens CH5, MA1, CM1, ER1–ER5, CS1, CO1–CO3, EM3; "Gaps closed on 2026-10-17": composer, model errors, cost, empty states), `docs/specs/2026-10-17-redesign-roadmap.md`, `design/dango/README.md` (voice: errors put the fix on the button), design-system READMEs Toast, Sheet, Menu.

## Global Constraints

- Needs slice 1, **slice 6a** (merged first: `packages/chat-settings.ts`, `formatDangoDuration`, `scopeIdForSession`), **slice 1b** (`pushUndo`, `undoLatest`, `useUndoHotkey`, `<UndoToast />` from `src/renderer/packages/undo/`; `Sheet` from `src/renderer/components/ui/Sheet.tsx`; `addReviewEntry` from `src/renderer/packages/review/`; `RETRY_DELAYS_MS` from `src/shared/types/background.ts`) and **slice 3** (`useScopes`, `moveSessionToScope(sessionId, scopeId | undefined)`). Import them as named in the contract register; never re-create them. Slice 2 provides the `costWarningUsd` setting UI; until then `getCostWarningUsd` returns `0.5`.
- Dango never switches models by itself: no code path in this slice writes `session.settings.provider` or `modelId` except the user's own pick in a model selector.
- Abilities and cost are checked before sending, never during a turn. `generation.ts` imports neither `headsUp` nor `turnNeedsTools`.
- Rate limits: the provider's `Retry-After` when present, else 10 s / 1 min / 5 min, then a Needs you entry and no further automatic retries.
- Undo is 1b's 5 s toast plus ⌘Z (`pushUndo`); this slice only pushes entries.
- Copy, exact from the spec: "Update key", "Add credit", "Answer without tools", "Choose a model", "Start a new chat with a summary", "Undo", "Branch from here", "Move to scope". Plan-chosen copy (spec silent) is given in each task and listed in the report.
- Icons: Lucide 16 px, stroke 1.8, pressed state by `aria-pressed` and `green` colour, never a filled icon or emoji. Menus keep `ActionMenu` (Tabler icons) until the menu component moves to Lucide.
- New strings through `t()` with English entries in `src/renderer/i18n/locales/en/translation.json`.
- Schema additions are optional Zod fields: `Message.durationMs`, `Message.toolsOff` (dango-storage-migration: no version bump).
- `ApiError` gains optional fields only (dango-provider-change: shared stays pure; no provider behaviour changes).
- Out of this slice: `/rewrite` and Quick Chat (slice 8); the Settings control for `costWarningUsd` (slice 2); rendering Needs you entries (slice 5); scopes, drag a chat onto a scope (slice 3); notifications for long runs (slice 8); tool permission sheet CH2, Swarm card CH3/CH4 and Search SE1 (slice 6c); the undo toast, `Sheet` and Review store (slice 1b); offline QC2 (slice 8).

## Review Focus

- A provider sends `Retry-After` as an HTTP date, as `0`, or as junk: the wait is the date's distance, a minimum of 1 s, or the default schedule respectively (Task 4 test `parseRetryAfter handles dates, zero and junk`).
- The user presses Stop or sends a new message while a rate-limit retry is pending: the retry is cancelled and never fires into the new turn (Task 5 test `stop and new send cancel the pending retry`).
- A custom model whose capabilities are unknown (no `capabilities` array): it is never blocked for tools or vision (Task 6 test `unknown capabilities never block`).
- Deleting the chat that is open, then Undo after navigating away: the chat comes back in its old list position with its messages; Undo after 5 s does nothing (Task 1 tests `undo restores position and messages`, `undo expires`).
- Editing the first user message of a chat with no system prompt (nothing to fork before): the old answer is still kept as a branch (Task 3 test `first message edit keeps a branch`).

---

### Task 1: Chat menu (CM1)

**Files:**
- Create: `src/renderer/components/session/chatMenu.ts`, `src/renderer/components/session/chatMenu.test.ts`, `src/renderer/components/session/useChatMenu.tsx`
- Create: `src/renderer/stores/session/chat-menu-actions.ts`, `src/renderer/stores/session/chat-menu-actions.test.ts`
- Modify: `src/renderer/stores/chatStore.ts` (add `restoreSession` after `deleteSession` at `:306`)
- Modify: `src/renderer/components/session/SessionItem.tsx:70-147` (items and the Move to scope sheet → `useChatMenu`; drop the folder modal `:282-300` and its state)
- Modify: `src/renderer/components/layout/Toolbar.tsx:39-79` (items → `useChatMenu`; keep "Session options" above it), `src/renderer/components/layout/Header.tsx` (expose its inline rename as `onRename`)

**Interfaces:**
- Consumes: `_copySession`, `switchCurrentSession` (existing); `pushUndo`, `undoLatest` (1b); `Sheet` (1b); `useScopes`, `moveSessionToScope` (slice 3); `branchChatFromMessage` (Task 3 — Task 1 ships first, so `onBranch` calls `_copySession({ ...meta, name: \`${name} (branch)\` })` directly and Task 3 swaps it for `branchChatFromMessage(id, lastMessageId)`).
- Produces:
  ```ts
  export type ChatMenuHandlers = {
    onRename(): void; onTogglePin(): void; onMoveToScope(): void; onBranch(): void
    onExport(): void; onToggleArchive(): void; onDelete(): void
  }
  export function buildChatMenuItems(session: Pick<SessionMeta, 'starred' | 'archived'>, h: ChatMenuHandlers, t: TFunction): ActionMenuItemProps[]
  export function useChatMenu(session: SessionMeta, opts: { selected: boolean; onRename(): void }): { items: ActionMenuItemProps[]; sheet: ReactNode } // sheet = the Move to scope picker
  export async function moveChatWithUndo(sessionId: string, scopeId: string | undefined): Promise<{ name: string; scopeName: string } | null>
  export async function restoreSession(session: Session, index: number): Promise<void> // same id, same list position
  export async function deleteChatWithUndo(sessionId: string): Promise<{ name: string } | null>
  export async function archiveChatWithUndo(sessionId: string): Promise<{ name: string; archived: boolean } | null>
  ```
  Rows, in order: Rename · Pin / Unpin (the existing `starred` flag) · Move to scope… (opens a 1b `Sheet` listing "None" first, then `useScopes().scopes` without Everywhere (it holds no chats; `moveSessionToScope` refuses it), the current choice marked; choosing one calls `moveChatWithUndo` with the scope id, or `undefined` for None) · Branch · Export · divider · Archive / Unarchive · Delete chat (`color: 'chatbox-error'`, no double-check: undo replaces it). Undo toasts through `pushUndo({ message, undo })` (plan-chosen copy): `Deleted "{{name}}"`, `Archived "{{name}}"`, `Unarchived "{{name}}"`, `Moved to {{scope}}`. `<UndoToast />` and `useUndoHotkey()` are mounted by 1b; this slice mounts nothing.

- [ ] **Step 1: Write the failing tests**
  - `chatMenu.test.ts`: row texts for `{ starred: false, archived: false }` are `['Rename', 'Pin', 'Move to scope…', 'Branch', 'Export', 'Archive', 'Delete chat']` around one divider; `starred: true` gives "Unpin", `archived: true` "Unarchive"; no row has `doubleCheck`; at most 8 rows; each row's `onClick` calls its handler.
  - `chat-menu-actions.test.ts` (chatStore and `@/packages/undo` mocked over an in-memory list `[a, b, c]`): `undo restores position and messages`: `deleteChatWithUndo('b')` removes `b` and calls `pushUndo` with `message: 'Deleted "B"'`; running its `undo` puts `b` back at index 1 with the same id and messages. `undo expires`: with the real 1b undo module and fake timers past 5 000 ms, `await undoLatest()` is `false` and `b` stays deleted. `archiveChatWithUndo('a')` flips `archived` and its undo flips it back. `moveChatWithUndo('a', 'p2')` calls `moveSessionToScope('a', 'p2')`; its undo calls `moveSessionToScope('a', <previous projectId or undefined>)`.
- [ ] **Step 2: Run** `pnpm test -- src/renderer/components/session src/renderer/stores/session/chat-menu-actions.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** `restoreSession` writes `session:{id}` with `storage.setItemNow`, primes the React Query cache like `createSession` (`:192-194`), inserts the meta at `index` (clamped), and broadcasts. `useChatMenu` navigates to `/new` (1b) after deleting the selected chat, opens `NiceModal.show('export-chat')` for Export (switching to the chat first when it is not current), and toasts.
- [ ] **Step 4: Run** the tests and `pnpm check`. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(chat): one chat menu for sidebar and header, delete and archive with undo`.

### Task 2: Answer actions and meta (MA1 row)

**Files:**
- Modify: `src/shared/types/session.ts` `MessageSchema` (`:351-420`: add `durationMs: z.number().optional()`)
- Modify: `src/renderer/stores/session/generation.ts:508-540` (option `modelOverride`), `:557-567` (apply it to `effectiveSettings`), `:622` (record start), `:1342-1361` (write `durationMs`), `:1602-1643` (`generateMore`, `regenerateInNewFork` forward `modelOverride`)
- Create: `src/renderer/components/chat/messageMeta.ts`, `src/renderer/components/chat/messageMeta.test.ts`
- Create: `src/renderer/components/chat/MessageActionRow.tsx`, `src/renderer/components/chat/MessageActionRow.test.tsx`
- Modify: `src/renderer/components/chat/Message.tsx:564-648` (menu items), `:944-1054` (row), `:473-504` (tips stay only for `finishReason`)

**Interfaces:**
- Consumes: `ModelSelector` (`onSelect(provider, modelId)`, children as target); `regenerateInNewFork`.
- Produces:
  ```ts
  type ModelOverride = { provider: string; modelId: string }
  generate(sessionId, targetMsg, options?: { …existing; modelOverride?: ModelOverride })
  export async function generateMore(sessionId: string, msgId: string, options?: { modelOverride?: ModelOverride }): Promise<void>
  export async function regenerateInNewFork(sessionId: string, msg: Message, options?: { runGenerateMore?: GenerateMoreFn; modelOverride?: ModelOverride }): Promise<void>
  export function formatTokenCount(n: number): string            // 1 → "1 token", 840 → "840 tokens", 1240 → "1.2k tokens", 2000 → "2k tokens"
  export function formatAnswerMeta(msg: Pick<Message, 'model' | 'usage' | 'tokenCount' | 'durationMs'>): string
  export function MessageActionRow(props: {
    msg: Message; onCopy(): void; onRedo(): void; onRedoWithModel(provider: string, modelId: string): void
    onFeedback(rating: 'up' | 'down'): void; menu: ActionMenuItemProps[]
  }): JSX.Element
  ```
  `formatAnswerMeta` joins the present parts with " · ": `msg.model`; tokens from `usage.totalTokens`, else `inputTokens + outputTokens`, else `tokenCount`; `formatDangoDuration(durationMs)`.

- [ ] **Step 1: Write the failing tests**
  - `messageMeta.test.ts`: `{ model: 'GPT-5', usage: { totalTokens: 1240 }, durationMs: 8_200 }` → `'GPT-5 · 1.2k tokens · 8 s'`; only `model` → `'GPT-5'`; `usage: { inputTokens: 300, outputTokens: 540 }` → contains `'840 tokens'`; the `formatTokenCount` cases above.
  - `MessageActionRow.test.tsx` (jsdom, `ModelSelector` mocked to render its children and expose `onSelect`): buttons in order "Copy", "Redo", "Redo with another model", "Good answer", "Bad answer", "More"; `msg.feedback.rating = 'up'` sets `aria-pressed="true"` on "Good answer" only; the meta text renders; choosing a model in the mocked selector calls `onRedoWithModel('claude', 'claude-opus')`; no element's text matches `/\p{Extended_Pictographic}/u`.
  - Extend `src/renderer/stores/sessionActions.test.ts`: `regenerateInNewFork(s, msg, { modelOverride, runGenerateMore })` forwards the override; with `modelOverride` the session's stored `settings.provider` and `modelId` are unchanged afterwards (the redo never switches the chat's model).
- [ ] **Step 2: Run** `pnpm test -- src/renderer/components/chat src/renderer/stores/sessionActions.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Assistant row: Copy, Redo (current model, `regenerateInNewFork`), Redo ▾ (`ModelSelector` around a `ChevronDown` button), thumbs (Lucide `ThumbsUp`/`ThumbsDown`, existing `toggleFeedbackRating`), More, then the meta in `muted` caption. User row: Copy, Edit (Task 3), More. Moved into More for assistants: Quote, Save to memory, Send to Image Creator (when ComfyUI is ready), Delete; Reply Again Below leaves the row and stays in More for user messages. `modelOverride` replaces `provider`/`modelId` in `effectiveSettings` only.
- [ ] **Step 4: Run** the tests and `pnpm check`. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(chat): answer row with Redo by model and model · tokens · time`.

### Task 3: Edit and resend, branch from here (MA1)

**Files:**
- Create: `src/renderer/stores/session/edit-resend.ts`, `src/renderer/stores/session/branch.ts`, `src/renderer/stores/session/edit-resend.test.ts`
- Create: `src/renderer/components/chat/UserMessageEditor.tsx`, `src/renderer/components/chat/UserMessageEditor.test.tsx`
- Modify: `src/renderer/components/chat/Message.tsx:314-316` (`onEditClick`: user messages open the inline editor; assistant messages keep the `message-edit` modal from More), menus from Task 2
- Modify: `src/renderer/components/session/useChatMenu.tsx` (Branch → `branchChatFromMessage`)

**Interfaces:**
- Consumes: `createNewFork`, `findMessageLocation`, `submitNewUserMessage`, `modifyMessage`, `generateMoreInNewFork`, `_copySession`, `switchCurrentSession`.
- Produces:
  ```ts
  export async function editAndResend(sessionId: string, messageId: string, text: string): Promise<void>
  export async function branchChatFromMessage(sessionId: string, messageId: string): Promise<string> // new session id
  export function UserMessageEditor(props: { initialText: string; onSend(text: string): void; onCancel(): void }): JSX.Element
  ```
  `editAndResend`: when the message has a predecessor in its list, `createNewFork(sessionId, predecessor.id)` (old question and answer become the other branch) then `submitNewUserMessage` with a copy of the message (new id, same attachments, quote and chips, new text); when it is first, fall back to `modifyMessage` + `generateMoreInNewFork(sessionId, messageId)` (the old answer is still kept as a branch). Branch name (plan-chosen): `{{name}} (branch)`; messages up to and including `messageId`, no threads, no forks.

- [ ] **Step 1: Write the failing tests**
  - `edit-resend.test.ts` (chatStore over an in-memory session): `[system, u1, a1, u2, a2]`, `editAndResend(s, 'u2', 'new')` → `messageForksHash['a1']` has two lists, one holding `u2, a2`; the visible list ends `…, a1, <user 'new'>` and generation was requested. `first message edit keeps a branch`: `[u1, a1]` → `messageForksHash['u1']` exists holding `a1`, and `u1`'s text is `'new'`. `branchChatFromMessage(s, 'a1')` creates a session named `'Chat (branch)'` with copies of `[system, u1, a1]` (new ids) and switches to it.
  - `UserMessageEditor.test.tsx`: textarea prefilled; "Send" disabled for blank text; ⌘Enter sends; Escape and "Cancel" call `onCancel`.
- [ ] **Step 2: Run** `pnpm test -- src/renderer/stores/session/edit-resend.test.ts src/renderer/components/chat/UserMessageEditor.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement**, then add "Branch from here" to More for both roles. Quoting a selection keeps the existing `TextSelectionToolbar` → `setQuoteDraft` path and `MessageQuoteBar`.
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(chat): edit and resend keeps the old answer; branch from here`.

### Task 4: Model errors with the fix on the button (ER1, ER2, ER5, CH5)

**Files:**
- Create: `src/shared/models/retry-after.ts`, `src/shared/models/retry-after.test.ts`
- Modify: `src/shared/models/errors.ts:10-17` (`ApiError`), `src/shared/models/abstract-ai-sdk.ts:465-476` (`handleError`)
- Modify: `src/renderer/stores/session/generation.ts:1519-1593` (catch: `errorExtra.status`, `errorExtra.retryAfterMs`)
- Create: `src/renderer/packages/model-errors/classify.ts`, `src/renderer/packages/model-errors/classify.test.ts`
- Create: `src/renderer/stores/session/retry.ts`, `src/renderer/stores/session/new-chat-with-summary.ts`, `src/renderer/stores/session/new-chat-with-summary.test.ts`
- Create: `src/renderer/components/chat/ModelErrorNotice.tsx`, `src/renderer/components/chat/ModelErrorNotice.test.tsx`
- Modify: `src/renderer/components/chat/Message.tsx:130,908`; Delete: `src/renderer/components/chat/MessageErrTips.tsx`

**Interfaces:**
- Consumes: `classifyQuotaError` (`@shared/providers/usage`), `aiProviderNameHash`, `generateSummary`, `createEmpty`, `navigateToSettings`.
- Produces:
  ```ts
  class ApiError { constructor(message: string, responseBody?: string, meta?: { status?: number; retryAfterMs?: number }); status?: number; retryAfterMs?: number }
  export function parseRetryAfter(value: string | undefined, now: number): number | undefined // ms
  export function apiErrorFromCallError(error: APICallError, label: string, now?: number): ApiError // used by handleError
  export type ModelErrorKind = 'invalid-key' | 'out-of-credit' | 'rate-limit' | 'too-long' | 'network' | 'provider'
  export function classifyModelError(msg: Pick<Message, 'error' | 'errorCode' | 'errorExtra'>): ModelErrorKind
  export function isContextLengthError(text: string | null | undefined): boolean // moved from MessageErrTips
  export async function retryFailedMessage(sessionId: string, msg: Message): Promise<void> // generate in place, operationType 'regenerate'
  export async function startNewChatWithSummary(sessionId: string): Promise<string | null>
  export function ModelErrorNotice(props: { msg: Message; sessionId: string }): JSX.Element | null
  ```
  Classification order: too-long (`isContextLengthError` on error or body) → out-of-credit (quota `exhausted`, code 10004, status 402) → rate-limit (quota `rate_limit`, code 20005, status 429) → invalid-key (status 401, status 403 that is not exhausted, codes 20002–20004, or `/invalid[_ ]?api[_ ]?key|incorrect api key|unauthori[sz]ed|authentication/i`) → network (`Network Error` prefix or code 10002) → provider.
  Notice copy (plan-chosen sentence, spec button): invalid-key "Your {{provider}} key was rejected." **Update key** → `/provider/{id}`; out-of-credit "Your {{provider}} account is out of credit." **Add credit** → `/provider/{id}`; too-long "This chat is too long for {{model}}." **Start a new chat with a summary**; network "Couldn't reach {{host}}." **Retry**; provider "{{provider}} returned an error." **Retry**; rate-limit is Task 5. Raw detail sits behind "Show details" / "Hide details" with Copy. Never "something went wrong", never an apology.

- [ ] **Step 1: Write the failing tests**
  - `retry-after.test.ts`: `parseRetryAfter handles dates, zero and junk`: `'12'` → `12_000`; `'0'` → `1_000`; an HTTP date 30 s after `now` → `30_000`; a past date → `1_000`; `'soon'` and `undefined` → `undefined`.
  - `classify.test.ts`: one case per rule above, plus a 429 whose body says "insufficient_quota" → `out-of-credit`, and "prompt is too long" with status 400 → `too-long`.
  - In `retry-after.test.ts`: `apiErrorFromCallError(new APICallError({ message: 'x', url: 'u', requestBodyValues: {}, statusCode: 429, responseHeaders: { 'retry-after': '7' } }), 'OpenAI')` is an `ApiError` with `status: 429` and `retryAfterMs: 7_000` (`now` injected).
  - `ModelErrorNotice.test.tsx`: for each kind the sentence and exactly one primary button with the copy above; clicking Update key calls `navigateToSettings('/provider/openai')`; Retry calls `retryFailedMessage`; the text never matches `/something went wrong|sorry/i`.
  - `new-chat-with-summary.test.ts` (`generateSummary` mocked → `'S'`): creates a chat in the same `projectId` named `'{{name}} (continued)'` whose messages are `[system copy, user 'Previous conversation summary:\n\nS']` and switches to it; summary failure → returns `null`, toast "Couldn't summarise this chat. Try again." and creates nothing.
- [ ] **Step 2: Run** `pnpm test -- src/shared/models src/renderer/packages/model-errors src/renderer/components/chat/ModelErrorNotice.test.tsx src/renderer/stores/session/new-chat-with-summary.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** The generation catch copies `status` and `retryAfterMs` from the `ApiError` (or its `cause`) into `errorExtra`; `classifyQuotaError` gets `status`. The composer stays usable throughout (no change to InputBox state on error).
- [ ] **Step 4: Run** the tests, `pnpm check`. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(errors): model errors name the fix on their button`.

### Task 5: Rate limits retry on schedule, then ask (ER3)

**Files:**
- Create: `src/renderer/stores/session/rate-limit-retry.ts`, `src/renderer/stores/session/rate-limit-retry.test.ts`
- Modify: `src/renderer/stores/session/generation.ts` (catch: schedule when `classifyModelError` is `rate-limit`; success write `:1342`: `clearRateLimitAttempts(targetMsg.id)`)
- Modify: `src/renderer/stores/session/stop-generation.ts:33`, `src/renderer/stores/session/messages.ts:122` (`submitNewUserMessage`) — both call `cancelRateLimitRetry(sessionId)` first
- Modify: `src/renderer/components/chat/ModelErrorNotice.tsx` (rate-limit states)
- Modify: `src/renderer/index.tsx` (call `registerChatReviewOpener()` once after the stores init)

**Interfaces:**
- Consumes: `RETRY_DELAYS_MS` from `@shared/types/background` (1b); `addReviewEntry`, `registerReviewOpener` from `@/packages/review` (1b); `switchCurrentSession` (existing); `scopeIdForSession` (6a); `retryFailedMessage` (Task 4).
- Produces:
  ```ts
  export function rateLimitDelayMs(attempt: number, retryAfterMs?: number): number | null // attempt 0-based; null once attempt >= 3
  export function scheduleRateLimitRetry(sessionId: string, msg: Message): void
  export function cancelRateLimitRetry(sessionId: string): void
  export function clearRateLimitAttempts(messageId: string): void
  export async function openChatAndRetry(sessionId: string): Promise<void>
  export function registerChatReviewOpener(): void
  ```
  While waiting the message's `errorExtra` carries `rateLimitAttempt` and `retryAt`; after the third failure `rateLimitGaveUp: true`. Copy (plan-chosen): waiting "{{provider}} is limiting requests. Trying again in {{time}}." **Retry now**; gave up "{{provider}} is still limiting requests. It's waiting in Review." **Retry**. Needs you entry: `{ kind: 'needs-you', scopeId: scopeIdForSession(session), source: providerName, text: '{{provider}} is still limiting requests', sub: 'The chat "{{chat}}" is waiting for a retry.', ref: { type: 'chat', id: sessionId } }` (1b's `ReviewRefType` `'chat'`; `'question'` belongs to slices 5 and 10). This task registers the opener: `registerReviewOpener('chat', (entry) => openChatAndRetry(entry.ref.id))`, where `openChatAndRetry(sessionId: string): Promise<void>` switches to the session and calls `retryFailedMessage` on its last assistant message when that message failed with a rate limit; the registration runs once from `src/renderer/stores/session/rate-limit-retry.ts`'s `registerChatReviewOpener()` called in `src/renderer/index.tsx` after the stores init.

- [ ] **Step 1: Write the failing tests** (fake timers; `generate`, `addReviewEntry` mocked):
  - `rateLimitDelayMs`: `(0) → 10_000`, `(1) → 60_000`, `(2) → 300_000`, `(3) → null`, `(0, 7_000) → 7_000`, `(3, 7_000) → null`.
  - Three consecutive rate-limit failures retry after 10 s, 60 s and 300 s with the same `aiProvider`/`model` each time, then a fourth failure calls `addReviewEntry` once and schedules nothing.
  - A `Retry-After` of 7 000 ms on the first failure retries at 7 s.
  - `stop and new send cancel the pending retry`: after scheduling, `cancelRateLimitRetry('s1')` then advancing 10 s does not call `generate`.
  - A success clears attempts: the next rate limit starts at 10 s again.
  - The give-up entry has `ref: { type: 'chat', id: 's1' }`. `registerChatReviewOpener()` calls `registerReviewOpener` once with `'chat'`; invoking the registered opener with that entry calls `switchCurrentSession('s1')` and `retryFailedMessage` with the failed assistant message; when the last assistant message did not fail, it only switches.
- [ ] **Step 2: Run** `pnpm test -- src/renderer/stores/session/rate-limit-retry.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** with a per-session timer map and a per-message attempt map in module scope; "Retry now" cancels the timer and retries as the next attempt. `rate-limit-retry.ts` imports `addReviewEntry` directly but reaches `retryFailedMessage` through dynamic `import()` at fire time, because `messages.ts` and `stop-generation.ts` import it and `generation.ts` imports `messages.ts`.
- [ ] **Step 4: Run** the test and `pnpm test -- src/renderer/components/chat`. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(errors): rate limits follow Retry-After, back off, then ask in Review`.

### Task 6: Abilities before sending (ER4) and the 80% context warning

**Files:**
- Modify: `src/renderer/utils/modelReadiness.ts` (option `requiresTools`, capability `'tool_use'`; add `turnNeedsTools`), test `src/renderer/utils/modelReadiness.test.ts`
- Modify: `src/renderer/components/InputBox/ModelReadinessNotice.tsx`, `src/renderer/components/InputBox/InputBox.tsx:617-620` (readiness), `:697` (blocking on every layout for `capability-required`), `:1490-1530` (`handleSubmit(needGenerating, opts?: { toolsOff?: boolean })`), `:3088` (notice on every layout)
- Modify: `src/shared/types/session.ts` `MessageSchema` (`toolsOff: z.boolean().optional()`)
- Modify: `src/renderer/stores/session/generation.ts:1100-1200` (tool inputs honour `toolsOff`)
- Create: `src/renderer/components/InputBox/contextFill.ts`, `src/renderer/components/InputBox/contextFill.test.ts`, `src/renderer/components/InputBox/ContextNearFullNotice.tsx`
- Create: `src/renderer/stores/session/tools-off.ts`, `src/renderer/stores/session/tools-off.test.ts`, `src/renderer/stores/session/beforeSendChecks.source.test.ts` (the source test)

**Interfaces:**
- Produces:
  ```ts
  export function turnNeedsTools(s: { agentMode?: boolean; browserArmed?: boolean; computerArmed?: boolean; roomMode?: string }): boolean
  getModelReadiness(selected, providers, options: { requiresVision?: boolean; requiresTools?: boolean }): ModelReadiness
  // capability-required now carries capability: 'vision' | 'tool_use'
  export const CONTEXT_WARN_RATIO = 0.8
  export function contextFillRatio(used?: number, window?: number): number | null
  export function ContextNearFullNotice(props: { ratio: number; onStartNewChat(): void }): JSX.Element
  export function isToolsOffTurn(messages: Message[], targetMsgId: string): boolean // stores/session/tools-off.ts
  ```
  `turnNeedsTools` is true for `agentMode`, `browserArmed`, `computerArmed` or `roomMode === 'swarm'`; web search and knowledge bases are not counted (they have non-tool fallbacks in `stream-text.ts:381-382`). ER4 notice: "{{model}} can't use tools." with **Answer without tools** (primary: `handleSubmit(true, { toolsOff: true })`) and **Choose a model** (a `ModelSelector` filtered to `capabilities.includes('tool_use')`, calling `onSelectModel`). Context notice (plan-chosen, quiet `muted` line above the composer): "This chat is {{pct}}% full. Early messages may be left out." with ghost button **Start a new chat with a summary**.

- [ ] **Step 1: Write the failing tests**
  - `modelReadiness.test.ts`: `requiresTools` with capabilities `['vision']` → `capability-required` / `tool_use`; with `['tool_use']` → ready; `unknown capabilities never block`: model without `capabilities` → ready for both `requiresTools` and `requiresVision`. `turnNeedsTools` true/false table as above.
  - `contextFill.test.ts`: `(79_999, 100_000)` → `0.79999` (no notice), `(80_000, 100_000)` → `0.8` (notice), `(1, 0)` and `(undefined, 1)` → `null`.
  - A source test (as `src/renderer/components/InputBox/mobileTouchTargets.test.ts` reads files): `generation.ts` does not import `modelReadiness`, `headsUp` or `turnNeedsTools`.
  - `tools-off.test.ts`: `isToolsOffTurn([u1(toolsOff), a1], 'a1')` true; `([u1, a1], 'a1')` false; `([u1(toolsOff), a1, u2, a2], 'a2')` false (only the turn's own user message counts); an unknown id → false. The source test also asserts `generation.ts` calls `isToolsOffTurn(` and that each of `webBrowsing:`, `knowledgeBase:`, `enableImageGenerationTool:` in the `streamText(model, {` call references `toolsOffForTurn`.
- [ ] **Step 2: Run** `pnpm test -- src/renderer/utils/modelReadiness.test.ts src/renderer/components/InputBox src/renderer/stores/session`. Expected: FAIL.
- [ ] **Step 3: Implement.** In `generate`, set `const toolsOffForTurn = isToolsOffTurn(messages, targetMsg.id)` and OR it into the same conditions that already use `roomBlocksExternalTools` for every tool input, and skip browser and computer tools. `ContextNearFullNotice` reads `contextTokens` and `effectiveContextWindow` already computed in InputBox (`:678-731`) and calls `startNewChatWithSummary` (Task 4).
- [ ] **Step 4: Run** the tests and `pnpm check`. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(composer): check model abilities before sending; quiet warning at 80% context`.

### Task 7: Cost heads-up sheet (CS1)

**Files:**
- Create: `src/renderer/packages/cost-tracking/headsUp.ts`, `src/renderer/packages/cost-tracking/headsUp.test.ts`
- Create: `src/renderer/components/InputBox/useCostHeadsUp.tsx`, `src/renderer/components/InputBox/useCostHeadsUp.test.tsx`
- Modify: `src/renderer/components/InputBox/InputBox.tsx:1490-1530` (`handleSubmit`: after readiness, before `setIsSubmitting`)

**Interfaces:**
- Consumes: `getModelPricing`, `calculateCost` (`packages/cost-tracking/calculator.ts:143-170`), `settings.usagePricingOverrides`, `isLocalHost(url)` (`@shared/utils/network_utils`), `getCostWarningUsd` (6a), `Sheet({ opened, onClose, title, children, actions })` (1b), `totalTokens` from `useContextTokens` in InputBox.
- Produces:
  ```ts
  export const DEFAULT_OUTPUT_TOKENS = 4_096
  export type CostEstimateInput = { providerId: string; modelId: string; apiHost?: string; inputTokens: number; maxOutputTokens?: number; runs: number }
  export function isLocalModelProvider(providerId: string, apiHost?: string): boolean // ollama, lm-studio, or a localhost apiHost
  export function estimateTurnCostUsd(input: CostEstimateInput, overrides?: PricingOverrides): number | null // null when unpriced
  export function shouldShowCostSheet(i: { estimateUsd: number | null; limitUsd: number; local: boolean }): boolean
  export function formatUsdEstimate(usd: number): string // "$0.73", "<$0.01"
  export function useCostHeadsUp(): { confirm(input: CostEstimateInput): Promise<boolean>; sheet: ReactNode }
  ```
  `runs` = `max(1, agentIds.length) * 2` when `roomMode === 'swarm'`, else 1. Sheet copy (plan-chosen): title "This run may cost about {{cost}}"; body "{{model}} · about {{tokens}} tokens. You asked to hear about runs over {{limit}}. Change the limit in Settings › Models and keys."; primary **Run**, secondary **Cancel**.

- [ ] **Step 1: Write the failing tests**
  - `headsUp.test.ts`: `shouldShowCostSheet` false when `local`, when `limitUsd === 0`, when `estimateUsd` is `null`, when estimate ≤ limit; true when `0.51 > 0.5`. `isLocalModelProvider('ollama')`, `('lm-studio')`, `('custom', 'http://localhost:1234/v1')` true; `('openai')` false. `estimateTurnCostUsd` for `openai`/`gpt-4o` with 100 000 input and 4 096 output and `runs: 2` equals `2 * (0.1 * 2.5 + 0.004096 * 10)`; an unknown model → `null`. `formatUsdEstimate(0.7321)` → `'$0.73'`, `(0.004)` → `'<$0.01'`.
  - `useCostHeadsUp.test.tsx` (jsdom, real 1b `Sheet`): `confirm(input)` over the limit opens a sheet titled "This run may cost about $0.73"; Run resolves `true`, Cancel and Escape resolve `false`; under the limit it resolves `true` without opening.
  - `never interrupts a started run`: `beforeSendChecks.source.test.ts` (Task 6) also asserts `stores/session/generation.ts` and `packages/model-calls/**` contain no reference to `shouldShowCostSheet`.
- [ ] **Step 2: Run** `pnpm test -- src/renderer/packages/cost-tracking/headsUp.test.ts src/renderer/components/InputBox`. Expected: FAIL.
- [ ] **Step 3: Implement.** `useCostHeadsUp` renders 1b's `Sheet` with `actions` = Cancel (`dg-btn dg-btn--ghost`) then Run (`dg-btn dg-btn--primary`, first focus). `handleSubmit` awaits `confirm(...)` only when `needGenerating`; Cancel returns with the draft untouched.
- [ ] **Step 4: Run** the tests and `pnpm check`. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(cost): heads-up sheet before costly runs`.

### Task 8: "/" menu, drop overlay, first-chat suggestions (CO2, CO3, EM3)

**Files:**
- Modify: `src/renderer/components/InputBox/CommandPicker.tsx:25-44` (item kind `skill`, `skills` option, group labels), `src/renderer/components/InputBox/composer-chip-dom.ts:303-308` (`slash` trigger), `src/renderer/packages/commands/slash-tokens.ts` (add `replaceActiveCommandSlashWithSkillToken`), `src/renderer/components/InputBox/InputBox.tsx:1112-1120` (pass skills), `:1444-1455` (skill branch)
- Modify: `src/renderer/stores/uiStore.ts` (`fileDragActive`, `setFileDragActive`), `src/renderer/components/InputBox/InputBox.tsx:2465-2559` (handlers set the store), `:2744-2756` (remove the composer overlay)
- Create: `src/renderer/components/chat/ChatDropOverlay.tsx`; Modify: `src/renderer/routes/session/$sessionId.tsx:286` (render it inside the main column; `routes/quick.tsx` is left alone, slice 8 rewrites it without an InputBox)
- Create: `src/renderer/utils/firstChatSuggestions.ts`, `src/renderer/utils/firstChatSuggestions.test.ts`; Modify: `src/renderer/components/chat/EmptyThreadState.tsx`, `src/renderer/components/chat/MessageList.tsx:199-203` (pass scope name and kind)
- Test: `src/renderer/components/InputBox/CommandPicker.test.ts`, `src/renderer/packages/commands/slash-tokens.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type CommandPickerItem = { kind: 'skill'; skill: SkillPackage } | { kind: 'system'; command: SystemCommand } | { kind: 'package'; command: CommandPackage }
  export function buildCommandPickerItems(query: string, packageCommands: CommandPackage[], options?: { excludePackageIds?: string[]; includeSystem?: boolean; skills?: SkillPackage[]; excludeSkillIds?: string[] }): CommandPickerItem[]
  export function replaceActiveCommandSlashWithSkillToken(text: string, skillName: string, caret?: number): string
  export function ChatDropOverlay(): JSX.Element
  export function firstChatSuggestions(input: { scopeName?: string; scopeKind: 'project' | 'client' | null }): string[] // exactly 3
  ```
  Order: up to 5 skills (`filterSkills`), then system commands, then up to 8 package commands; group labels "Skills" and "Commands". Overlay copy stays "Drop to attach" / "Images · video · PDFs · text · code". Suggestions (plan-chosen): no scope → "What needs me today?", "What changed this week?", "Help me write a reply"; project → "What changed in {{scope}} since I last looked?", "Summarise what we know about {{scope}}", "What's still open in {{scope}}?"; client → "What did we promise {{scope}} last?", "Draft a reply to {{scope}}", "What's still open with {{scope}}?".

- [ ] **Step 1: Write the failing tests**
  - `CommandPicker.test.ts`: with skills `[review-code]`, commands `[deploy]`, query `''` → kinds `['skill', 'system…', 'package']` with every skill before every command; query `'rev'` keeps only matching items; `excludeSkillIds` hides a chosen skill.
  - `slash-tokens.test.ts`: `replaceActiveCommandSlashWithSkillToken('fix /rev', 'review-code')` → `'fix $review-code '`.
  - `firstChatSuggestions.test.ts`: the three cases above, each length 3, `{{scope}}` filled; a scope name with quotes is inserted verbatim.
  - `EmptyThreadState` (jsdom): three `dg-chip` buttons; clicking one calls `onPickStarter` with its text.
  - `ChatDropOverlay` (jsdom): hidden (`aria-hidden="true"`) until `uiStore.setFileDragActive(true)`; then visible with "Drop to attach".
- [ ] **Step 2: Run** `pnpm test -- src/renderer/components/InputBox src/renderer/packages/commands src/renderer/utils/firstChatSuggestions.test.ts src/renderer/components/chat`. Expected: FAIL.
- [ ] **Step 3: Implement.** Choosing a skill from "/" inserts the skill chip with `insertChipAtTrigger(chip, 'slash')` (rich input) or `replaceActiveCommandSlashWithSkillToken` (plain) and updates `selectedSkills` as `handleSkillSelect` does. Drop handling stays on `window` (files dropped anywhere attach); only the overlay moves to the chat column.
- [ ] **Step 4: Run** `pnpm test`, `pnpm check`, `pnpm lint`. Expected: PASS.
- [ ] **Step 5: Look at it.** `pnpm dev:web`, light and dark: answer row and meta, Redo ▾, edit-and-resend branch arrows, chat menu with delete + Undo + ⌘Z, a bad key (ER1), a forced 429 (ER3 countdown), a non-tool model with Browser armed (ER4), a long chat (80% line), an expensive model (CS1), "/" menu, dropping a file on the thread, a new chat in a scope. Compare with canvas screens CH0, CH5, MA1, CM1, ER1–ER5, CS1, CO1–CO3, EM3.
- [ ] **Step 6: Commit**: `feat(composer): / lists skills then commands, chat-wide drop overlay, first-chat suggestions`; add one line to `docs/log.md` under 2026-10-17 and commit `docs: log slice 6b`.
