---
type: plan
status: draft
description: "Slice 6c of the redesign: the tool permission sheet with per-scope grants, Swarm as one toggle with a live card and a folded result, and Search as a ⌘K overlay over chats, knowledge and sources"
generated: { by: claude/opus-5.5, at: 2026-10-17T19:00:00+07:00 }
---
# Permission sheet, Swarm card and Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the assistant wants to act, a sheet says what, why and what it touches and offers Allow once · Always in this scope · Not now; Swarm is one toggle under Tools ▾ whose run shows one live card with Stop and ends in one answer with the agents folded behind it; ⌘K opens a search overlay over Chats, Knowledge and Sources with scope chips.

**Architecture:** The permission flow keeps today's gate (`wrapToolsWithApproval`, `toolApprovalStore`, `getToolRiskTier`) and swaps the NiceModal for a promise queue (`requestToolPermission`) drawn by one `ToolPermissionHost` using slice 1b's `Sheet`; grants gain a per-scope map. Swarm keeps the existing orchestrator (`runAgentRoomSwarm`) and adds a run id on each turn, a Stop that lets the captain deliver, and a pure `foldSwarmRuns` that turns a run's messages into one card. Search becomes a provider registry (`registerSearchProvider`) with four built-in providers and a thin overlay that replaces `pages/SearchDialog.tsx`.

**Tech Stack:** React 18, Zustand, Jotai, TanStack Router, Vitest 4 (+ jsdom, Testing Library), Biome.

**Spec:** `docs/specs/2026-10-16-ux-flows.md` (flows 7, 8, 14; Screens CH2, CH3, CH4, SE1; "Decisions made while drawing": Search is an overlay; "Gaps closed": Swarm picks up to three; Accessibility: first focus is the primary, Esc closes), `docs/specs/2026-10-16-redesign-brief.md` (sheets not modals; modes removed: Swarm is one toggle; rooms show only when Swarm is on), `docs/specs/2026-10-17-redesign-roadmap.md` (Contract register, Decisions), `docs/agents-multi-agent-rooms.md`, `design/dango/README.md` (voice).

## Global Constraints

- Needs: slice 1b (`Sheet`, `pushUndo`, `Mascot`, `startNewChat`) for Tasks 1–7; slices 3 (`useScopes`, `isEverywhere`, route `/scope/$scopeId` with `search.tab`, `ScopeSettingsTab`) and 4 (`listKnowledge`) for Tasks 4, 8, 9. Run Tasks 1–3 and 5–7 first; Tasks 4, 8, 9 after 3 and 4 are merged. No fallbacks are built.
- Import shared names from the register paths: `Sheet` from `@/components/ui/Sheet`, `pushUndo` from `@/packages/undo`, `Mascot` from `@/components/brand/Mascot`, `startNewChat` from `@/lib/startNewChat`, `listKnowledge` from `@/packages/knowledge`, `useScopes` / `isEverywhere` from slice 3's exports.
- Classes: `dg-btn`, `dg-btn--primary`, `dg-btn--ghost`, `dg-chip`, `dg-kbd`, `dg-qc`, `dg-qc__bar`, `dg-qc__body`, `dg-qc__foot`, `dg-tool`, `dg-mascot` from `dango-components.css`. No file of this slice contains `dg-sheet` (slice 9's inventory test); the search overlay's layer is its own `.dg-search-layer`.
- Copy is fixed by this plan where the spec is silent and quoted exactly below; sentence case, no emoji, buttons name the action.
- Never automatic, whatever Trust says: tools that send, delete, pay, and workspace file mutations (`isSensitiveToolName`) ask every time and never offer "Always".
- `toolApprovalStore` stays a zustand `persist` store (`tool-approval-store`, `safeStorage`); the new `scopeGrants` field loads as `{}` from old payloads through `merge`; no `migration.ts` step. `Message.swarm` is a new optional Zod field with `.catch(undefined)` (dango-storage-migration: extend, do not migrate).
- Tests: node env by default; UI tests start with `// @vitest-environment jsdom`. Commands: `pnpm test -- <path>`, `pnpm check`, `pnpm lint`.
- Out of this slice: the cost heads-up sheet CS1 and the inspector's run cost (6b; Settings › Usage keeps history); inline knowledge proposals under the answer (4); plan cards AG1/AG2 and tool rows (6a); the scope page and its tabs (3); source kinds and their sync (7, 10 register their own search providers); live regions and focus audit (9).

## Review Focus

- Two tool calls in one step ask at once: one sheet at a time, in order; choosing Always for the first resolves a queued call to the same tool in the same scope without a second sheet (Task 1).
- The user presses Stop or the 120 s timeout passes while the sheet is open: the sheet closes, the call returns the refusal, and the next queued request shows (Task 1, Task 3).
- A grant made for a tool whose risk tier later rises (MCP server updated its description) must not auto-approve the riskier call (Task 2).
- Stop pressed during the captain's planning turn, before any task exists, still ends in one answer marked "Stopped early" (Task 6).
- Typing fast in Search: results of an older query never replace those of the newer one, and ⌘↵ on a hit from the Everywhere scope starts a chat with no scope rather than an invalid one (Tasks 8, 9).

---

### Task 1: Permission requests: what, why, touches, and the queue

**Files:**
- Create: `src/renderer/packages/tool-permission/describe.ts`, `describe.test.ts`, `queue.ts`, `queue.test.ts`, `index.ts`

**Interfaces:**
- Produces:
  ```ts
  export type PermissionChoice = 'once' | 'always' | 'deny'
  export type ToolActionSummary = { what: string; why?: string; touches: string[] }
  export function describeToolAction(toolName: string, args: unknown, description?: string): ToolActionSummary
  export function alwaysAsks(toolName: string): boolean
  export function canAlways(toolName: string, riskTier: ToolRiskTier): boolean
  export function toolLabel(toolName: string): string
  export type PermissionRequest = { id: string; sessionId: string; scopeId?: string; toolName: string; riskTier: ToolRiskTier; summary: ToolActionSummary; allowAlways: boolean }
  export function requestToolPermission(req: Omit<PermissionRequest, 'id'>, opts?: { signal?: AbortSignal; timeoutMs?: number }): Promise<PermissionChoice>
  export function resolvePermission(id: string, choice: PermissionChoice): void
  export function usePermissionHead(): PermissionRequest | null
  ```
- Rules: `alwaysAsks` is true for `isSensitiveToolName(name)` and for names matching `/(^|[_-])(send|reply|delete|remove|trash|pay|purchase|checkout|transfer)([_-]|$)/i`. `canAlways` = `!alwaysAsks(name) && riskTier !== ToolRiskTier.CRITICAL`. `toolLabel('browser_click')` → `'Browser click'`. `what` by name: `edit_file`/`create_file`/`apply_workspace_changes` → `Edit {{path}}` (`Edit {{n}} files` for more than one); `delete_file` → `Delete {{path}}`; `run_local_code`/`prepare_local_execution` or names with `exec|command|shell|terminal` → `Run a command`; `browser_navigate` → `Open {{host}}`; other `browser_*` → `Use the browser on {{host}}` (or `Use the browser`); `computer_*` → `Use your computer: {{action}}` (action = suffix with `_` → space); send-like names → `Send a message`; else `Use {{toolLabel}}`. `why` = first non-empty string of `args.reason`, `args.explanation`, `args.purpose`, else the first sentence of `description` (≤ 140 chars), else absent. `touches` = paths from `path`, `file_path`, `paths[]`, `changes[].path`; host of `url`; `command` cut to 80 chars; to/recipient for send-likes; deduplicated, in that order.
- Queue: FIFO; `usePermissionHead` returns the first open request. `timeoutMs` default `120_000` → `'deny'`; an aborted `signal` → `'deny'`; both remove the entry. Resolving a head with `'always'` also resolves every queued entry with the same `toolName`, `scopeId` (or same `sessionId` when unscoped) and `allowAlways` as `'always'`.

- [ ] **Step 1: Write the failing tests.**
  - `describe.test.ts`: `edit_file {path:'docs/a.md'}` → `{ what: 'Edit docs/a.md', touches: ['docs/a.md'] }`; `apply_workspace_changes {changes:[{path:'a'},{path:'b'}]}` → `what 'Edit 2 files'`, touches `['a','b']`; `browser_navigate {url:'https://github.com/x'}` → `'Open github.com'`, touches `['github.com']`; `computer_click {}` → `'Use your computer: click'`; `run_local_code {command:'x'.repeat(200), reason:'Run the tests'}` → `why 'Run the tests'`, touches[0] length 80; `mcp_gmail_send_email` → `'Send a message'`; `alwaysAsks('delete_file')`, `('gmail_send')`, `('stripe_pay')`, `('edit_file')` true; `('browser_click')`, `('web_search')` false; `canAlways('browser_click', HIGH)` true, `(…, CRITICAL)` false.
  - `queue.test.ts` (fake timers): two requests → head is the first; resolving it makes the second head; `once queued pair resolves on always`: two `browser_click` requests with `scopeId 's1'` → resolving the first `'always'` resolves both promises `'always'` and head becomes null; a third with `scopeId 's2'` stays queued; `timeout denies`: advance 120 000 ms → `'deny'`, head null; `abort denies`: `controller.abort()` → `'deny'`, the next request becomes head.
- [ ] **Step 2: Run** `pnpm test -- src/renderer/packages/tool-permission`. Expected: FAIL, modules not found.
- [ ] **Step 3: Implement** the two modules; the queue is a module-level array plus a listener set; `usePermissionHead` uses `useSyncExternalStore`.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(permission): describe tool actions and queue permission requests`.

### Task 2: Grants per scope and the gate

**Files:**
- Modify: `src/renderer/stores/toolApprovalStore.ts` (whole file), `src/renderer/packages/model-calls/wrap-tools-approval.ts:1-147`, `wrap-tools-approval.test.ts`
- Modify: `src/renderer/packages/model-calls/stream-text.ts:290-330` (param `scopeId?: string`), `:477`, `:847-906` (pass `{ scopeId }` to every `wrapToolsWithApproval`), `src/renderer/stores/session/generation.ts:1108`, `:1289` (`scopeId: getEffectiveProjectId(session)`)

**Interfaces:**
- Consumes: Task 1 (`requestToolPermission`, `describeToolAction`, `canAlways`).
- Produces:
  ```ts
  export type ScopeToolGrant = { toolName: string; riskTier: ToolRiskTier; grantedAt: number }
  // ToolApprovalScope becomes 'once' | 'session' | 'scope'; audit `scope` adds 'scope'
  // new store actions, called as toolApprovalStore.getState().addScopeGrant(...)
  addScopeGrant(scopeId: string, grant: ScopeToolGrant): void
  revokeScopeGrant(scopeId: string, toolName: string): void
  export function getScopeGrant(scopeId: string, toolName: string): ScopeToolGrant | undefined
  export function useScopeGrants(scopeId: string): ScopeToolGrant[] // newest first
  export function wrapToolsWithApproval(sessionId: string | undefined, tools: ToolSet, opts?: { scopeId?: string }): ToolSet
  ```
- Gate order per call: LOW and not `alwaysAsks` → auto (as today). Else if `canAlways` and a grant exists with the same `riskTier` — scope grant when `scopeId` is set, else today's session approval — → auto, audit `auto-approve`. Else `requestToolPermission({ sessionId, scopeId, toolName, riskTier, summary, allowAlways: canAlways(...) }, { signal: context?.abortSignal })`. `'always'` → `addScopeGrant` when scoped, else `addApproval(sessionId, { scope: 'session', … })`. The refusal result keeps `denied: true, toolName, riskTier` and its `message` becomes: `The user chose "Not now" for this action. Do not retry it. Tell the user in one sentence what you did not do and why.`

- [ ] **Step 1: Write the failing tests** in `wrap-tools-approval.test.ts` (mock `@/packages/tool-permission` instead of NiceModal; keep the two existing cases, now asserting `requestToolPermission` was called):
  - `scope grant auto-approves in the same scope`: `getScopeGrant('s1','browser_click')` returns `{ riskTier: HIGH }` → executes without a request; in scope `'s2'` it requests.
  - `grant does not cover a riskier tier`: grant `MEDIUM`, call risk `HIGH` → requests.
  - `always in a scope stores a scope grant`: request resolves `'always'` with `scopeId 's1'` → `addScopeGrant('s1', { toolName, riskTier })`; without `scopeId` → `addApproval(sessionId, { scope: 'session' })`.
  - `delete never offers always`: `delete_file` request has `allowAlways: false`, and an existing scope grant for it is ignored.
  - `refusal is a sentence`: `'deny'` → result `message` equals the string above; `execute` not called.
  - `toolApprovalStore merge`: persisted payload without `scopeGrants` hydrates to `{}`; `revokeScopeGrant` removes only that tool.
- [ ] **Step 2: Run** `pnpm test -- src/renderer/packages/model-calls/wrap-tools-approval.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the store fields (persist `scopeGrants` in `partialize`, default it in `merge`), the gate, and thread `scopeId` from `generation.ts` through `streamText`.
- [ ] **Step 4: Run** `pnpm test -- src/renderer/packages/model-calls` and `pnpm check`. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(permission): grants per scope; refusals come back as a sentence`.

### Task 3: The permission sheet replaces the approval modal (CH2)

**Files:**
- Create: `src/renderer/components/permission/ToolPermissionSheet.tsx`, `ToolPermissionHost.tsx`, `ToolPermissionSheet.test.tsx`
- Modify: `src/renderer/routes/__root.tsx:226` (mount `<ToolPermissionHost />` beside the search overlay), `src/renderer/modals/index.tsx:42` (drop `'tool-approval'`)
- Delete: `src/renderer/modals/ToolApproval.tsx`, `src/renderer/components/ToolAuditPanel/` (unused; the audit log stays in the store)

**Interfaces:**
- Consumes: `Sheet` (1b), Task 1 (`usePermissionHead`, `resolvePermission`).
- Produces: `ToolPermissionSheet(props: { request: PermissionRequest | null; onChoose(choice: PermissionChoice): void }): JSX.Element | null`; `ToolPermissionHost(): JSX.Element` (reads the head with `usePermissionHead`, calls `resolvePermission(head.id, choice)`).

Layout and copy: `Sheet` title = `summary.what`; body: `summary.why` as one `--dango-ink-2` line when present; "Touches" label (caption) and up to 5 items in `--dango-font-mono`, then "and {{count}} more". Hint (caption, `--dango-muted`) when `alwaysAsks`: "Dango always asks before it sends, deletes or changes your files." Actions left to right: `dg-btn dg-btn--ghost` **Not now**, `dg-btn` **Always in this scope** (unscoped chat: **Always in this chat**; hidden when `!allowAlways`), `dg-btn dg-btn--primary` **Allow once** with `data-autofocus`. `onClose` (Esc, scrim) = **Not now**.

- [ ] **Step 1: Write the failing tests** (`ToolPermissionSheet.test.tsx`, jsdom, i18n mocked to identity):
  - renders a dialog named "Edit docs/a.md", the why line, and `docs/a.md` under "Touches".
  - `first focus is Allow once`: `document.activeElement` has text "Allow once".
  - `Esc is Not now`: keydown Escape → `onChoose('deny')` once.
  - buttons call `onChoose('once')`, `('always')`, `('deny')`.
  - `delete hides always`: `allowAlways: false` → no "Always in this scope"; hint text present.
  - `unscoped`: no `scopeId` → button reads "Always in this chat".
  - `seven touches`: shows 5 paths and "and 2 more".
  - Host: two queued requests → after clicking Allow once the second request's title shows; aborting the head's signal closes the sheet.
- [ ] **Step 2: Run** `pnpm test -- src/renderer/components/permission`. Expected: FAIL.
- [ ] **Step 3: Implement**; remove the modal registration and the two deleted paths; `rg "tool-approval'|ToolAuditPanel|ToolApprovalModalResult" src` returns nothing.
- [ ] **Step 4: Run** `pnpm test -- src/renderer/components/permission src/renderer/packages/model-calls`, `pnpm check`. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(permission): tool permission sheet replaces the approval modal`.

### Task 4: See and revoke what a scope allows

**Files:**
- Create: `src/renderer/components/permission/ScopePermissions.tsx`, `ScopePermissions.test.tsx`
- Modify: `src/renderer/components/scope/ScopeSettingsTab.tsx` (slice 3; render `<ScopePermissions scopeId={scope.id} />` after the Everywhere section, before "Delete scope")

**Interfaces:**
- Consumes: `useScopeGrants`, `revokeScopeGrant`, `addScopeGrant` (Task 2), `toolLabel` (Task 1), `pushUndo` (1b).
- Produces: `ScopePermissions(props: { scopeId: string }): JSX.Element`.

Copy: heading "Allowed without asking"; caption "Dango does these in this scope without asking. Sending and deleting always ask."; each row `toolLabel` · caption "Since {{date}}" (`toLocaleDateString`) · `dg-btn dg-btn--ghost` **Stop allowing**; empty: "Nothing yet. When you choose Always in this scope, it shows here." Stop allowing calls `revokeScopeGrant` then `pushUndo({ message: t('Dango will ask before “{{label}}” again.'), undo: () => addScopeGrant(scopeId, grant), group: 'other' })`.

- [ ] **Step 1: Write the failing tests**: two grants → two rows, newest first; empty copy with none; clicking Stop allowing removes the row and calls `pushUndo` with that message; invoking the captured `undo` restores the row; Everywhere (`'everywhere'`) renders the section like any scope.
- [ ] **Step 2: Run** `pnpm test -- src/renderer/components/permission/ScopePermissions.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** and mount it.
- [ ] **Step 4: Run** the test and `pnpm test -- src/renderer/components/scope`. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(permission): scope settings list what runs without asking`.

### Task 5: Swarm is one toggle under Tools ▾

**Files:**
- Modify: `src/renderer/components/InputBox/ComposerToolsMenu.tsx:43-79` (props), after the Computer use item (`:331-358`) add the Swarm row
- Modify: `src/renderer/components/InputBox/InputBox.tsx:173` (import), `:1323-1334` (`handleRoomModeChange` → `handleSwarmChange`), `:2713-2719` (`swarmOn`), `:2726` (drop `<TeamRoomActions>`), `:2846-2855` (strip only when `swarmOn` or one agent), `:3105` (pass Swarm props), `:3202-3209` (remove `<TeamModeSelect>`)
- Modify: `src/renderer/stores/session/multi-agent-room.ts:87-89` (`setSessionRoomMode(sessionId, roomMode: RoomMode | undefined)`), `:629-632`; `src/renderer/stores/session/messages.ts:240` (pass the session's `roomMode`); the home route's draft room mode (`routes/index.tsx:298-311`, or `routes/new.tsx` after 1b)
- Modify: `src/renderer/components/chat/AgentRoomStrip.tsx:92-98` (drop the swarm live label; Task 7's card shows it)
- Delete: `src/renderer/components/InputBox/TeamModeSelect.tsx`
- Create: `src/renderer/stores/session/swarm-toggle.test.ts`, `src/renderer/components/InputBox/ComposerToolsMenu.swarm.test.tsx`

**Interfaces:**
- Produces: `isSwarmOn(roomMode: string | undefined): boolean` (`roomMode === 'swarm'`) exported from `src/shared/agent-room.ts`; `shouldRunMultiAgentRoom(mentionedAgentIds: string[] | undefined, roomAgentIds: string[], roomMode: string | undefined): boolean` = two or more speakers and `isSwarmOn`. `ComposerToolsMenuProps` adds `swarmOn: boolean; swarmAgentCount: number; onSwarmChange(on: boolean): void`.

Swarm off means no room run: a chat with several agents answers as the first speaker (`speakers[0]`, today's solo path); legacy sessions stored with `'discuss'` or `'work'` read as off. Row copy: label "Swarm"; caption off "Several agents work on one answer"; caption on with fewer than 2 agents "Add 2 or 3 agents with @"; a `Switch` like the Browser row; hidden when `isOpenClawModel` (rooms are native-only). Turning it off writes `roomMode: undefined`.

- [ ] **Step 1: Write the failing tests.**
  - `swarm-toggle.test.ts`: `shouldRunMultiAgentRoom(undefined, ['a','b'], 'swarm')` true; with `undefined`, `'discuss'`, `'work'` false; `(undefined, ['a'], 'swarm')` false; `isSwarmOn('swarm')` true.
  - `ComposerToolsMenu.swarm.test.tsx` (jsdom, menu opened): the Swarm row's switch reflects `swarmOn`; clicking it calls `onSwarmChange(true)`; with `swarmOn` and `swarmAgentCount 1` the caption is "Add 2 or 3 agents with @"; `isOpenClawModel` hides the row.
  - Source scan in the same test: `InputBox.tsx` contains no `TeamModeSelect` and no `<TeamRoomActions`.
- [ ] **Step 2: Run** `pnpm test -- src/renderer/stores/session/swarm-toggle.test.ts src/renderer/components/InputBox/ComposerToolsMenu.swarm.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.** If `src/renderer/theme/themeMapping.test.ts` (slice 3) orders `<ScopePill` before `<TeamModeSelect`, change that bound to `<ModelSelector`.
- [ ] **Step 4: Run** `pnpm test -- src/renderer/components/InputBox src/renderer/stores/session src/shared/agent-room.test.ts src/renderer/theme`, `pnpm check`. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(swarm): Swarm is a per-chat toggle under Tools; team mode picker goes`.

### Task 6: Swarm runs carry an id, and Stop lets the captain write

**Files:**
- Modify: `src/shared/types/session.ts:437-440` (Message field), `src/shared/agent-room.ts:160-185` and `:329-342` (stopped-early wording), `src/shared/agent-room.test.ts`
- Modify: `src/renderer/stores/session/team-room-state.ts:9-22` (`agentCount?: number`), add stop flags; `multi-agent-room.ts:105-145` (tag turns), `multi-agent-room-swarm.ts:20-33`, `:61-278`; `generation.ts:520-538`, `:798-847` (pass `swarmStoppedEarly` into the protocol options)
- Create: `src/renderer/stores/session/multi-agent-room-swarm.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // Message
  swarm: z.object({ runId: z.string(), taskTitle: z.string().optional(), stoppedEarly: z.boolean().optional() }).optional().catch(undefined)
  // team-room-state.ts
  export function requestSwarmStop(sessionId: string): Promise<void> // sets the flag, then stopSessionGeneration(sessionId)
  export function isSwarmStopRequested(sessionId: string): boolean
  export function useSwarmLive(sessionId: string): (NonNullable<TeamRoomLiveStatus> & { stopping: boolean }) | null // only when mode === 'swarm'
  // SwarmSpeakerTurn params add: runId: string; stoppedEarly?: boolean
  // buildProtocolForRoomRole / buildRoomContinuePrompt / buildSwarmDeliverProtocol options add: stoppedEarly?: boolean
  ```
- Every swarm turn (plan, do, deliver and the "could not build a task board" note) is written with `swarm: { runId, taskTitle?, stoppedEarly? }`; `runId` = `swarm-${runStartedAt}`. `setTeamRoomLive` for swarm includes `agentCount: speakers.length`. After any turn, `isSwarmStopRequested` wins over the interrupt check: stop the loop, leave unfinished run tasks `pending`, and run the captain's deliver turn with `stoppedEarly: true` (also when stopped during planning with no board). Stop during deliver is an ordinary Stop of that answer. A new user message still aborts without a deliver turn. The flag clears when the run ends. Deliver wording when stopped: `- The user stopped the run early. Write the best answer from the work so far and say in one line what was not done.`

- [ ] **Step 1: Write the failing tests.**
  - `multi-agent-room-swarm.test.ts` (mock `chatStore`, `taskStore`, `insertMessage`, `resolveAgentMeta`; a fake `generateSpeakerTurn` that records params): `every turn shares one runId`; `live status counts agents` (`agentCount: 3`); `stop during a task delivers early`: `requestSwarmStop` called inside the first `do` → next call is `deliver` with `stoppedEarly: true`, remaining tasks stay `pending`; `stop during planning still delivers`: stop inside `plan` → the only other call is `deliver` with `stoppedEarly: true`; `new user message aborts without deliver` (unchanged behaviour).
  - `agent-room.test.ts`: `buildSwarmDeliverProtocol('Ana', ['Ana','Bo'], { stoppedEarly: true })` contains "The user stopped the run early."; without it, it does not.
  - Session schema: a message with `swarm: 5` parses with `swarm` undefined.
- [ ] **Step 2: Run** `pnpm test -- src/renderer/stores/session/multi-agent-room-swarm.test.ts src/shared/agent-room.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same plus `pnpm check`. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(swarm): run ids on turns; Stop lets the captain answer with what exists`.

### Task 7: The live card and the folded result (CH3, CH4)

**Files:**
- Create: `src/renderer/components/chat/swarm/foldSwarmRuns.ts`, `foldSwarmRuns.test.ts`, `SwarmLiveCard.tsx`, `SwarmWorkedWith.tsx`, `SwarmCards.test.tsx`, `swarm.css`
- Modify: `src/renderer/components/chat/MessageList.tsx:115-117` (fold the list), `:236-292` (render the anchors)

**Interfaces:**
- Consumes: `Message.swarm`, `useSwarmLive`, `requestSwarmStop` (Task 6); `Mascot` (1b).
- Produces:
  ```ts
  export type SwarmAgentRow = { agentId: string; name: string; provider?: string; model?: string; captain: boolean; contribution: string[] }
  export type SwarmRun = { runId: string; agents: SwarmAgentRow[]; rounds: number; tokens?: number; stoppedEarly: boolean; answerId?: string }
  export function foldSwarmRuns(messages: Message[]): { visible: Message[]; runs: Record<string, SwarmRun>; anchorOf: Record<string, string> } // anchorOf: messageId → runId
  export function swarmLiveLabel(live: { agentCount?: number; phase: string; taskIndex?: number; taskTotal?: number; stopping: boolean }): string
  export function swarmSummaryLabel(run: SwarmRun): string
  SwarmLiveCard(props: { sessionId: string }): JSX.Element | null
  SwarmWorkedWith(props: { run: SwarmRun }): JSX.Element
  ```
- Folding: messages with `swarm` and `roomRole !== 'deliver'` leave `visible`; each run keeps one anchor in place of its last hidden turn: the deliver message when present (`answerId`), else the run's latest turn. `agents` in order of first turn, the plan turn's speaker is `captain`; contributions: plan → "Planned the work", do → its `swarm.taskTitle` (else "Did a task"), deliver → "Wrote the answer". `rounds` = number of `do` turns. `tokens` = sum of `usage.totalTokens ?? (inputTokens + outputTokens)` over the run, absent when none reported.
- Copy: live `Working with {{count}} agents · planning` / `· round {{x}} of {{y}}` / `· writing the answer`; stopping `Working with {{count}} agents · stopping, the captain is writing with what exists`; button `dg-btn` **Stop** (disabled while stopping); `Mascot state="working" size={20}`. Summary `Worked with {{count}} agents · {{rounds}} rounds · {{tokens}} tokens` (`1 round`; tokens as `980` or `12.4k`; the tokens part dropped when absent), then a chevron; a run with no answer and no live status reads `Worked with {{count}} agents · stopped before an answer`. "Stopped early" (caption) above the summary when `stoppedEarly`. Expanded rows: name (+ " · captain"), `{{provider}} · {{model}}` in mono caption, contributions joined with "; ".
- Rendering: the deliver anchor renders `Message` as today, then `SwarmWorkedWith` below it (closed `<details>`, `.dg-tool` row look). A non-deliver anchor renders `SwarmLiveCard` when `useSwarmLive(session.id)` is set, else `SwarmWorkedWith`. Hidden turns never render `AgentSpeakerHeader`.

- [ ] **Step 1: Write the failing tests.**
  - `foldSwarmRuns.test.ts`: user, plan(Ana), do(Bo,'Draft intro'), do(Cy,'Check numbers'), deliver(Ana) → `visible` = [user, deliver]; run has agents Ana (captain; "Planned the work", "Wrote the answer"), Bo ("Draft intro"), Cy; `rounds 2`; `tokens` sums usage; a run without deliver keeps its last turn as anchor; two runs in one chat fold separately; a message without `swarm` is untouched.
  - `swarmLiveLabel`: plan → `'Working with 3 agents · planning'`; do 2/5 → `'Working with 3 agents · round 2 of 5'`; deliver → `'Working with 3 agents · writing the answer'`. `swarmSummaryLabel` with `rounds 1, tokens 12_400` → `'Worked with 3 agents · 1 round · 12.4k tokens'`.
  - `SwarmCards.test.tsx` (jsdom): the live card's Stop calls `requestSwarmStop(sessionId)` and turns disabled; `SwarmWorkedWith` is collapsed by default, shows "Stopped early" when set, and lists three rows after a click.
- [ ] **Step 2: Run** `pnpm test -- src/renderer/components/chat/swarm`. Expected: FAIL.
- [ ] **Step 3: Implement** and wire `MessageList` (`currentMessageList` = `foldSwarmRuns(...).visible`; `isTeamRoomCompactRole` styling stays for legacy discuss turns).
- [ ] **Step 4: Run** the tests, `pnpm check`. Expected: PASS.
- [ ] **Step 5: Look at it.** `pnpm dev:web`: two agents, Swarm on, send; Stop mid-run; compare with CH3 and CH4 in light and dark.
- [ ] **Step 6: Commit**: `feat(swarm): one live card while agents work, one answer after`.

### Task 8: Search providers: chats, knowledge, sources

**Files:**
- Create: `src/renderer/packages/search/types.ts`, `registry.ts`, `providers/chats.ts`, `providers/knowledge.ts`, `providers/workspaceFiles.ts`, `providers/importedThreads.ts`, `attach.ts`, `useSearch.ts`, `index.ts`, and tests `registry.test.ts`, `providers.test.ts`, `useSearch.test.tsx`

**Interfaces:**
- Consumes: `searchSessions` (`stores/sessionHelpers.ts:913`), `getEffectiveProjectId`, `listKnowledge(scopeId, { query })` (4), `useScopes` / `isEverywhere` (3), `platform.restoreProjectBinding` + `platform.searchWorkspace`, `loadImportedHistory` + `searchImportedSnapshot`.
- Produces:
  ```ts
  export type SearchGroup = 'chats' | 'knowledge' | 'sources'
  export type SearchHit = { id: string; group: SearchGroup; title: string; excerpt?: string; scopeId?: string; sourceLabel: string; open(): void | Promise<void> }
  export type SearchQuery = { text: string; scopeIds: string[] | 'all' }
  export type SearchProvider = { id: string; group: SearchGroup; minChars?: number; search(q: SearchQuery, signal: AbortSignal): Promise<SearchHit[]> }
  export function registerSearchProvider(p: SearchProvider): () => void // same id replaces
  export function listSearchProviders(): SearchProvider[]
  export function registerBuiltInSearchProviders(): void // idempotent
  export function attachPrefill(hit: SearchHit): string
  export function openChatHit(sessionId: string, messageId?: string): void // moved from SearchDialog.tsx:240-263
  export function useSearch(text: string, scopeIds: string[] | 'all'): { groups: Record<SearchGroup, SearchHit[]>; loading: boolean }
  ```
- Providers: **chats** matches session names first (from `ChatSessionsList` metas), then message hits from `searchSessions`, one hit per chat (excerpt = first matching message, 160 chars), filtered by `getEffectiveProjectId` when scoped; `sourceLabel` `Chat “{{name}}”`. **knowledge** = `listKnowledge(id, { query })` for each chosen scope (All = every scope, Everywhere included), title = item text, `sourceLabel` `{{scopeName}} knowledge`, open → `/scope/$scopeId` with `search: { tab: 'knowledge' }`. **workspaceFiles** (group sources, `minChars 2`, desktop with `supportsProjectWorkspace`): for each chosen scope with a `ready` binding, `searchWorkspace(capabilityId, text)`; title = `relativePath`, excerpt, `sourceLabel` `{{relativePath}}:{{line}}`, open → `/scope/$scopeId` with `search: { tab: 'files' }`. **importedThreads** (group sources, only when `scopeIds === 'all'`), `sourceLabel` `ChatGPT “{{title}}”`, open → `NiceModal.show('imported-conversation', …)` as today. Each group keeps at most 8 hits.
- `attachPrefill(hit)` = `> {{excerpt ?? title, newlines → spaces, max 280 chars}}\n> — {{sourceLabel}}\n\n`.
- `useSearch`: 150 ms debounce; providers run in parallel, each group fills as its provider returns; a newer text or scope aborts the older `AbortController` and drops its late results; empty text → empty groups.

- [ ] **Step 1: Write the failing tests.**
  - `registry.test.ts`: registering the same id twice keeps one; the returned function unregisters; `registerBuiltInSearchProviders()` twice → four providers.
  - `providers.test.ts` (mocks): chats returns a name match before a message-only match and drops a chat in another scope when `scopeIds ['s1']`; knowledge calls `listKnowledge('s1', { query: 'launch' })` and labels "Acme knowledge"; importedThreads returns `[]` when scoped; workspaceFiles skips a scope whose binding is `missing`; `attachPrefill` of a hit with excerpt `'a\nb'` and label `Chat “Plan”` equals `'> a b\n> — Chat “Plan”\n\n'`.
  - `useSearch.test.tsx` (jsdom, fake timers): `stale results are dropped`: provider resolves "la" after "launch" → groups hold only "launch" results; `scope change re-runs`; empty text → no provider call.
- [ ] **Step 2: Run** `pnpm test -- src/renderer/packages/search`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same and `pnpm check`. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(search): providers for chats, knowledge and sources`.

### Task 9: The search overlay (SE1)

**Files:**
- Create: `src/renderer/components/search/SearchOverlay.tsx`, `search.css`, `SearchOverlay.test.tsx`
- Modify: `src/renderer/routes/__root.tsx:26`, `:226` (`<SearchOverlay />` replaces `<SearchDialog />`); `docs/log.md` (one line under 2026-10-17)
- Delete: `src/renderer/pages/SearchDialog.tsx`

**Interfaces:**
- Consumes: Task 8; `useUIStore` `openSearchDialog` / `setOpenSearchDialog` (unchanged, so ⌘K in `useShortcut.tsx:94-102` and the Sidebar buttons keep working; `globalOnly` is ignored); `useScopes`, `isEverywhere`; `startNewChat` (1b).
- Produces: `SearchOverlay(): JSX.Element | null`.

Layout and copy: a fixed `.dg-search-layer` (scrim `--dango-scrim`, click closes) holding a `dg-qc` panel at `top: 12vh`, `role="dialog"`, `aria-modal="true"`, `aria-label` "Search". Bar: search icon and input, placeholder and `aria-label` "Search chats, knowledge and sources", focused on open. Chips row: `dg-chip` buttons with `aria-pressed`, "All" first, then each scope from `useScopes().scopes` in order; default All. Results: `role="listbox"`, group headings "Chats", "Knowledge", "Sources" (empty groups hidden), each hit `role="option"` with title, excerpt (one line, `--dango-ink-2`) and `sourceLabel` (caption); the input carries `aria-activedescendant`. No hits: "Nothing found for “{{query}}”". Foot (`dg-qc__foot`): `dg-kbd` hints "↵ Open", "⌘↵ New chat with it" ("Ctrl ↵" off macOS), "Esc Close"; when `platformCapabilities.supportsImportedArchives`, a `dg-link` "Import ChatGPT archive" on the right (opens `'import-chatgpt-archive'` as today).

Keys: ↓/↑ move across the flat list (wrapping), ↵ runs `hit.open()` and closes, ⌘↵ / Ctrl+↵ closes and calls `startNewChat({ scopeId: hit.scopeId && !isEverywhere(hit.scopeId) ? hit.scopeId : undefined, prefill: attachPrefill(hit) })`, Esc closes and returns focus to the element focused before opening.

- [ ] **Step 1: Write the failing tests** (`SearchOverlay.test.tsx`, jsdom; `useSearch`, `useScopes`, `startNewChat` mocked):
  - opening focuses the input; three group headings render in order Chats, Knowledge, Sources; an empty group is not rendered.
  - `chips`: "All" is pressed; clicking "Acme" calls `useSearch` with `['acme']` and presses it.
  - `↵ opens`: ArrowDown then Enter calls the second hit's `open` and closes the overlay.
  - `⌘↵ attaches`: Meta+Enter on a knowledge hit in scope `acme` → `startNewChat({ scopeId: 'acme', prefill: attachPrefill(hit) })`; on an Everywhere hit → `scopeId: undefined`.
  - `Esc` closes and focus returns to the opener button; nothing found shows "Nothing found for “zzz”".
  - Source scan: `__root.tsx` has no `SearchDialog`; no file under `src/renderer/components/search` contains `dg-sheet`.
- [ ] **Step 2: Run** `pnpm test -- src/renderer/components/search`. Expected: FAIL.
- [ ] **Step 3: Implement**; delete `pages/SearchDialog.tsx`.
- [ ] **Step 4: Run** `pnpm test`, `pnpm check`, `pnpm lint`. Expected: PASS.
- [ ] **Step 5: Look at it.** `pnpm dev:web`: ⌘K from a chat and from a scope page, filter by a scope, ↵ and ⌘↵, then a tool call that edits a file (sheet, Esc, Always in this scope, revoke in scope Settings); light and dark; compare with SE1 and CH2.
- [ ] **Step 6: Commit**: `feat(search): ⌘K overlay with chats, knowledge and sources`; then add to `docs/log.md` "Slice 6c: tool permission sheet with per-scope grants, Swarm toggle and run card, ⌘K search overlay" and commit `docs: log slice 6c`.
