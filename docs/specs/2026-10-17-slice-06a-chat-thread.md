---
type: plan
status: draft
description: "Slice 6a of the redesign: the thinking live line, one-line tool blocks, the plan card with progress folded in, and artifacts in the inspector"
generated: { by: claude/opus-5.5, at: 2026-10-17T19:00:00+07:00 }
---
# Slice 6a: Chat Thread Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An assistant turn reads as one calm column: a live thinking line from the moment of sending, "Thought for N s ›" and one-line tool blocks after it, a plan card that runs and reports its own progress, and artifacts that open in the inspector with Preview, Code, Full screen, Copy, Download and versions.

**Architecture:** Pure helpers (`packages/thinking/*`, `components/plan/planSteps.ts`) carry every rule the spec pins (8 s, 30 s, 5 s announcements, open/closed default, tool summary wording, plan state) and are unit-tested in node. Thin components (`ThinkingLine`, `ToolBlock`, `PlanCard`) render them with the `dg-*` classes slice 1 shipped and slice 1b's `Mascot`. `Message.tsx` swaps its old renderers (`AssistantPending`, `ReasoningContentUI`, the `ThinkingGroupUI` header, `PlanApproval`) for these; the dock loses `TaskProgress`. Plan lifecycle facts (revised, version, started, finished) are stored on the plan part; a finished plan with staged edits files one Change entry through slice 1b's `addReviewEntry`.

**Tech Stack:** React 18, Mantine 7 (only where already used), Lucide icons, Vitest 4 (+ jsdom, Testing Library), Zod, Biome.

**Spec:** `docs/specs/2026-10-16-ux-flows.md` (Screens CH0, CH1, CH7, CH8, AG1, AG2, AR1; "Thinking and waiting"; "Gaps closed on 2026-10-17": plans, artifacts), `docs/specs/2026-10-17-redesign-roadmap.md` (shared names), `design/dango/README.md`, design-system component READMEs ThinkingLine, PlanCard, Inspector, Mascot (artifact `C7dPipWhJubTMddvKR7C3W`, files `project/components/<Name>/README.md` and `preview.html`).

## Global Constraints

- Needs slice 1 (merged) and slice 1b (contract register in the roadmap): `Mascot`, `MascotState` from `src/renderer/components/brand/Mascot.tsx`; `addReviewEntry(input)` from `src/renderer/packages/review/`. Import them; never re-create them.
- Needs slice 2 (merges before 6a): `ShowThinking` type and the `showThinking` setting from `src/shared/types/settings.ts`; `getShowThinking` still guards bad values. Reads, with fallbacks until merged: slice 3 scope `kind` (absent → `'project'`) and `EVERYWHERE_SCOPE_ID` (until slice 3 is on `main`, `packages/chat-review/index.ts` holds the literal `'everywhere'` with a comment to switch to the import). Settings and scope kind are read only through `packages/chat-settings.ts`.
- Slice 6b (actions, menu, errors, cost) builds on this plan and must merge after it.
- Copy, exact: "Thinking", "Still thinking", "Still working. Nothing is stuck; this model thinks before it writes.", "Thought for {{duration}}", "Stop", "Proposed plan", "{{count}} steps", "edits files · asks before applying", "Run plan", "Request changes", "Reject", "↵ run · E change · Esc reject", "Running plan · step {{current}} of {{total}}", "Edits are staged and arrive in Review as one Change.", "Ran plan · {{count}} steps · {{duration}}", "Plan v{{version}}", "Preview", "Code", "Full screen", "Exit full screen", "Copy", "Download". Plan-chosen copy (spec silent): "Running plan", "Plan stopped · {{done}} of {{total}} done", "Continue", "Rejected plan", "Plan finished: {{title}}" (Change entry text), "From the chat \"{{chat}}\"" (its sub).
- Durations use `formatDangoDuration`: `"1 s"` minimum, `"12 s"`, `"1 m 12 s"`, `"2 m"`.
- No step is offered to switch models mid-turn: the live line holds exactly one button, Stop.
- Screen readers hear the rolling summary at most every 5 000 ms through one `role="status"` element, never the token stream.
- The mascot appears at most once on screen: the live line hides it while a plan card in the same message is running.
- Reuse `dg-think`, `dg-think__title`, `dg-think__time`, `dg-think__body`, `dg-tool`, `dg-tool__verb`, `dg-tool__size`, `dg-plan*`, `dg-chip`, `dg-chip--blue`, `dg-btn`, `dg-btn--primary`, `dg-btn--ghost`, `dg-kbd`, `dg-mascot`. `dango-components.css` stays a verbatim copy of the design system: new CSS only for what those classes lack goes in `src/renderer/static/dango-chat.css` (created in Task 2, imported in `src/renderer/index.tsx` right after `dango-components.css`), tokens only.
- Icons: Lucide, 15–16 px, stroke 1.8. No emoji. Sentence case.
- New interface strings go through `t()` and get an English entry in `src/renderer/i18n/locales/en/translation.json`.
- Schema changes are optional Zod fields (dango-storage-migration: no `CurrentVersion` bump, old payloads still parse).
- Android: `ThinkingLine` (with `Mascot`) loads eagerly; `ToolBlock` and `PlanCard` stay behind the existing `isAgentEnabled` lazy imports in `Message.tsx`.
- Out of this slice: message actions, chat menu, model errors, cost sheet, "/" menu, drop overlay, first-chat suggestions (slice 6b); the tool permission sheet CH2, Swarm card CH3/CH4 and Search SE1 (slice 6c); the `Mascot` component and the Review store (slice 1b); the scope inspector's Sources/Knowledge/Files tabs (slices 3, 4, 7); announcing the finished answer to screen readers (slice 9); Review rendering of Change entries (slice 5).

## Review Focus

- A model that streams no reasoning at all: the live line shows from send until the first answer token, then leaves nothing behind, not an empty "Thought for" row (Task 2 test `non-thinking model leaves no thought block`).
- Reasoning whose last line is a code fence, a heading or 400 characters long: the summary is plain text, at most 120 characters plus "…" (Task 1 test `rollingSummary cleans markdown and truncates`).
- The user opens or closes the thinking text while the stream continues: their choice holds; the default never snaps it back (Task 2 test `user toggle survives new tokens`).
- A plan revised twice: v1 and v2 are folded and cannot be run; only v3 shows Run plan (Task 5 test `revised plans fold and lose their actions`).
- A plan stopped mid-run, or finished with nothing staged, files no Change entry; a finished plan with staged edits files exactly one (Task 4 tests `no change entry without staged edits`, `one change entry per finished plan`).

---

### Task 1: Thinking rules and setting accessors

**Files:**
- Create: `src/renderer/packages/thinking/thinking.ts`, `src/renderer/packages/thinking/thinking.test.ts`
- Create: `src/renderer/packages/chat-settings.ts`, `src/renderer/packages/chat-settings.test.ts`
- Modify: `src/renderer/hooks/useThinkingTimer.ts` (add `formatDangoDuration` beside `formatWorkedDuration`)

**Interfaces:**
- Produces:
  ```ts
  export const THINKING_STILL_MS = 8_000
  export const THINKING_REASSURE_MS = 30_000
  export const THINKING_ANNOUNCE_MS = 5_000
  export function thinkingStage(elapsedMs: number): 'thinking' | 'still' | 'reassure'
  export function rollingSummary(text: string, maxChars?: number): string // default 120
  export function thinkingOpenByDefault(pref: ShowThinking, scopeKind: 'project' | 'client' | null): boolean
  export function formatDangoDuration(ms: number): string
  // ShowThinking is imported from '@shared/types/settings' (slice 2)
  export function getShowThinking(settings: unknown): ShowThinking
  export function getCostWarningUsd(settings: unknown): number
  export function scopeKindOf(project: unknown): 'project' | 'client'
  ```

- [ ] **Step 1: Write the failing tests**
  - `thinking.test.ts`: `thinkingStage(7_999) === 'thinking'`, `(8_000) === 'still'`, `(29_999) === 'still'`, `(30_000) === 'reassure'`. `rollingSummary cleans markdown and truncates`: `rollingSummary('First idea\n\n## Checking the brief\n')` is `'Checking the brief'`; a last line of `'```ts'` falls back to the previous non-fence line; `'> - **bold** step'` becomes `'bold step'`; a 400-char line returns 120 chars ending in `'…'`; `''` returns `''`. `thinkingOpenByDefault`: `('open', 'client')` true, `('closed', 'project')` false, `('auto', 'project')` true, `('auto', 'client')` false, `('auto', null)` true. `formatDangoDuration`: `0 → '1 s'`, `12_400 → '12 s'`, `72_000 → '1 m 12 s'`, `120_000 → '2 m'`.
  - `chat-settings.test.ts`: `getShowThinking({})` and `({ showThinking: 'loud' })` are `'auto'`; `({ showThinking: 'closed' })` is `'closed'`. `getCostWarningUsd({})` is `0.5`; `({ costWarningUsd: 0 })` is `0`; `({ costWarningUsd: -1 })` and `({ costWarningUsd: 'x' })` are `0.5`. `scopeKindOf({ kind: 'client' })` is `'client'`; `scopeKindOf({})` and `scopeKindOf(undefined)` are `'project'`.
- [ ] **Step 2: Run** `pnpm test -- src/renderer/packages/thinking src/renderer/packages/chat-settings.test.ts`. Expected: FAIL, modules not found.
- [ ] **Step 3: Implement.** The accessors read unknown input defensively and are the only place slice 6 reads `showThinking`, `costWarningUsd` and scope `kind`.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(chat): thinking rules and setting accessors`.

### Task 2: The thinking live line

**Files:**
- Create: `src/renderer/components/chat/ThinkingLine.tsx`, `src/renderer/components/chat/ThinkingLine.test.tsx`
- Create: `src/renderer/hooks/useThrottledValue.ts`, `src/renderer/static/dango-chat.css` (the `sr-only` status line, the 30 s note row, the Stop button inside `summary`; tokens only)
- Modify: `src/renderer/index.tsx` (import `./static/dango-chat.css` after `./static/dango-components.css`)
- Modify: `src/renderer/components/chat/Message.tsx:107-108` (imports), `:726-728` and `:758-765` (reasoning renders), `:917-921` (pending render), `Props` at `:135-150` (add `thinkingDefaultOpen?: boolean`, default `true`)
- Modify: `src/renderer/components/chat/MessageList.tsx:271-292` (pass `thinkingDefaultOpen`)
- Delete: `src/renderer/components/message-parts/ReasoningContentUI.tsx` and its re-export at `src/renderer/components/message-parts/ToolCallPartUI.tsx:33`

**Interfaces:**
- Consumes: `Mascot` (slice 1b); Task 1 (`thinkingStage`, `rollingSummary`, `formatDangoDuration`, `THINKING_ANNOUNCE_MS`, `thinkingOpenByDefault`, `getShowThinking`, `scopeKindOf`); `useThinkingTimer(startTime, isActive)`; `stopSessionGeneration(sessionId, message)` from `@/stores/session/stop-generation`; `useProjects()`.
- Produces:
  ```ts
  export type ThinkingLineProps = {
    live: boolean
    startedAt?: number       // live timer origin
    durationMs?: number      // finished: total thought time
    text: string             // full thinking text (reasoning + mid-turn monologue)
    toolHint?: string        // live summary when there is no thought yet, e.g. "searched the web"
    defaultOpen: boolean
    showMascot?: boolean     // default true
    onStop?: () => void
  }
  export function ThinkingLine(props: ThinkingLineProps): JSX.Element | null
  export function useThrottledValue<T>(value: T, intervalMs: number): T
  ```

- [ ] **Step 1: Write the failing tests** (`ThinkingLine.test.tsx`, jsdom, fake timers, `MantineProvider`):
  - `live line before any thought`: `live`, `startedAt = now`, `text = ''` → shows "Thinking", the thinking mascot, `"1 s"` in `.dg-think__time`, and a button named "Stop"; clicking Stop calls `onStop` and does not toggle the `details`.
  - `still thinking at 8 s`: advance 8 000 ms → title reads "Still thinking"; at 30 000 ms the line "Still working. Nothing is stuck; this model thinks before it writes." is present; at both times the only `button` is "Stop".
  - `rolling summary`: `text = 'a\nchecking the brief'` → title contains "Thinking · checking the brief…"; with `text = ''` and `toolHint = 'searched the web'` → "Thinking · searched the web…".
  - `announces at most every 5 s`: the `role="status"` element starts with the first summary; changing `text` twice within 4 000 ms leaves it unchanged; after 5 000 ms it holds the latest summary.
  - `finished line`: `live = false`, `durationMs = 6 200`, `text = 'x'` → summary "Thought for 6 s", no mascot, no Stop; `details.open` equals `defaultOpen`.
  - `non-thinking model leaves no thought block`: `live = false`, `text = ''` → renders nothing.
  - `user toggle survives new tokens`: `defaultOpen = true`, click the summary (closes), rerender with longer `text` → still closed.
  - `showMascot = false` → no `svg.dg-mascot`.
- [ ] **Step 2: Run** `pnpm test -- src/renderer/components/chat/ThinkingLine.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement `ThinkingLine`** as one `<details className="dg-think">` whose `open` is controlled state seeded from `defaultOpen` once (a `userToggledRef` blocks reseeding); live title `<strong>Thinking|Still thinking</strong>` plus ` · {summary}…` when a summary exists; the 30 s line sits under the summary row; the status element is visually hidden (`sr-only`) and fed by `useThrottledValue(summary, THINKING_ANNOUNCE_MS)`; body renders `Markdown` with LaTeX and Mermaid off, as the old reasoning body did.
- [ ] **Step 4: Wire it into `Message.tsx`.** The pending branch (`shouldShowAssistantPending(...)`) renders `<ThinkingLine live startedAt={msg.timestamp} text="" … onStop>`; standalone reasoning parts and legacy `msg.reasoningContent` render `<ThinkingLine live={isLastPartAndGenerating} startedAt={part.startTime} durationMs={part.duration} text={part.text} …>`. `onStop` dynamically imports `stopSessionGeneration` and calls it with `(sessionId, msg)`. `MessageList` computes `thinkingDefaultOpen = thinkingOpenByDefault(getShowThinking(settings), project ? scopeKindOf(project) : null)` once per session, with `project` found by `currentSession.projectId ?? currentSession.folderId` in `useProjects().projects`.
- [ ] **Step 5: Run** `pnpm test -- src/renderer/components/chat src/renderer/utils` and `pnpm check`. Expected: PASS; no new tsc errors vs `main`.
- [ ] **Step 6: Commit**: `feat(chat): thinking live line with timed reassurance and Stop`.

### Task 3: Tool blocks collapse to one line

**Files:**
- Create: `src/renderer/packages/thinking/tool-summary.ts`, `src/renderer/packages/thinking/tool-summary.test.ts`
- Create: `src/renderer/components/message-parts/ToolBlock.tsx`, `src/renderer/components/message-parts/ToolBlock.test.tsx`
- Modify: `src/renderer/components/message-parts/ThinkingGroupUI.tsx` (rewrite, same export and props plus `defaultOpen: boolean`, `showMascot: boolean`, `onStop: () => void`)
- Modify: `src/renderer/components/chat/Message.tsx:732-757` (pass the new props; Suspense fallback becomes `<ThinkingLine live …>`)

**Interfaces:**
- Consumes: `isTaskTrackingTool(name)` from `@/packages/tools/task-tools`; `ToolCallPartUI`; Task 2 `ThinkingLine`.
- Produces:
  ```ts
  export type ToolRow = { verb: string; target: string; size?: string }
  export function summarizeToolCalls(parts: MessageToolCallPart[]): string
  export function liveToolHint(parts: MessageToolCallPart[]): string | undefined // running call's phrase, lower case
  export function toolRow(part: MessageToolCallPart): ToolRow
  export function ToolBlock(props: { parts: MessageToolCallPart[] }): JSX.Element | null
  ```

Summary phrases, joined with " · ", first letter upper-cased, groups in first-seen order, task-tracking tools left out:

| Tools | Phrase | Row verb |
|---|---|---|
| `read_file` | read {{n}} file / files | read |
| `file_search`, `code_search`, `search_file_content` | searched files | search |
| `web_search` | searched the web | search |
| `parse_link`, `read_video`, `read_video_url` | opened {{n}} link / links | open |
| `query_knowledge_base`, `memory_*` | searched scope knowledge | search |
| `create_file`, `edit_file`, `delete_file` | staged {{n}} edit / edits | edit |
| `terminal` | ran {{n}} command / commands | run |
| `browser_*` | used the browser | use |
| `computer_*` | used the computer | use |
| anything else | used {{n}} tool / tools | use |

Calls in state `error` add " · {{n}} failed". Row target: first string among `args.path`, `args.query`, `args.url`, `args.command`, `args.fileKey`, else the tool name. Row size: a string result or `result.content` string → `"{len/1000 to one decimal}k"` when ≥ 1 000 chars, else none; an array result or `result.results` array → `"{n} hit"`/`"{n} hits"`.

- [ ] **Step 1: Write the failing tests**
  - `tool-summary.test.ts`: two `read_file` + one `query_knowledge_base` → `'Read 2 files · searched scope knowledge'`; one `edit_file` in state `error` → `'Staged 1 edit · 1 failed'`; `create_task` alone → `''`; `toolRow` of `read_file` with `args.path = 'docs/a.md'` and a 4 100-char result → `{ verb: 'read', target: 'docs/a.md', size: '4.1k' }`; `web_search` with `result.results` of length 1 → size `'1 hit'`; `liveToolHint` of a running `web_search` → `'searched the web'`.
  - `ToolBlock.test.tsx` (jsdom): collapsed `details.dg-think` titled with the summary and closed by default; opening shows one `.dg-tool` row per call with `.dg-tool__verb` text; clicking a row reveals that call's `ToolCallPartUI` (mocked); empty summary → renders nothing.
  - In `ThinkingGroupUI` (new `ThinkingGroupUI.test.tsx`): while `message.generating` and `isLastGroup`, only a live `ThinkingLine` renders (no `ToolBlock`), with `toolHint` from `liveToolHint`; once settled, a "Thought for …" line (when reasoning exists) followed by the `ToolBlock`.
- [ ] **Step 2: Run** `pnpm test -- src/renderer/packages/thinking src/renderer/components/message-parts`. Expected: FAIL.
- [ ] **Step 3: Implement** the helpers, `ToolBlock` (`dg-think` details, `dg-tool` rows as buttons with `aria-expanded`), and the `ThinkingGroupUI` rewrite. Thought duration for the finished line: sum of reasoning `duration`, else the old `settledMs`. Remove the old label morph, copy button and `msg-worked-*` markup from this component (leave their CSS; slice 9 prunes).
- [ ] **Step 4: Run** the same command plus `pnpm check`. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(chat): tool calls collapse to one line with mono rows`.

### Task 4: Plan lifecycle and the Change entry

**Files:**
- Modify: `src/shared/types/session.ts:230-234` (`MessagePlanPartSchema`)
- Modify: `src/renderer/stores/session/generation.ts:117-192` (plan decisions), `:1243-1256` (plan part on finish), `:1416-1418` (after execution)
- Create: `src/renderer/packages/chat-review/index.ts`, `src/renderer/packages/chat-review/index.test.ts`
- Create: `src/renderer/stores/session/plan-lifecycle.ts`, `src/renderer/stores/session/plan-lifecycle.test.ts`

**Interfaces:**
- Consumes: `getStagedChangeSetId(sessionId)` from `@/packages/model-calls/toolsets/file`; `addReviewEntry(input): Promise<ReviewEntry>` from `@/packages/review` (slice 1b; it merges an open entry with the same `ref`).
- Produces:
  ```ts
  // MessagePlanPartSchema gains:
  status: z.enum(['pending', 'approved', 'rejected', 'revised']).default('pending')
  version: z.number().int().positive().optional()   // absent = 1
  startedAt: z.number().optional()
  finishedAt: z.number().optional()

  export function scopeIdForSession(session: Pick<Session, 'projectId'>): string // projectId ?? EVERYWHERE_SCOPE_ID
  export function nextPlanVersion(messages: Message[], beforeMessageId: string): number
  export function planTitle(planText: string): string // first parsed step, else first non-empty line, max 80 chars
  export async function recordFinishedPlan(session: Session, messageId: string, plan: MessagePlanPart): Promise<void>
  ```

- [ ] **Step 1: Write the failing tests**
  - `chat-review/index.test.ts`: `scopeIdForSession({ projectId: 'p1' })` is `'p1'`; `scopeIdForSession({})` is `'everywhere'` (the value of `EVERYWHERE_SCOPE_ID`; the test pins it so the switch to the import changes nothing).
  - `plan-lifecycle.test.ts`: `nextPlanVersion` returns 1 with no earlier plan, 2 when the latest earlier plan is `revised` without `version`, 3 when it is `revised` with `version: 2`, 1 when it is `approved`. `no change entry without staged edits`: `recordFinishedPlan` with `getStagedChangeSetId` → `undefined` does not call `addReviewEntry` (mocked `@/packages/review`). `one change entry per finished plan`: with change set `'cs-1'` it calls `addReviewEntry` once with `{ kind: 'change', ref: { type: 'change', id: 'cs-1' }, text: 'Plan finished: Move plans/*.md to docs/specs/', sub: 'From the chat "Docs move"', scopeId }`, and a second call for the same plan (same `finishedAt`) does nothing.
  - Extend `src/renderer/stores/sessionActions.test.ts`: `requestPlanChanges` sets the old part to `revised` (not `rejected`); `approveAndExecutePlan` sets `startedAt`; old payloads with `status: 'rejected'` and no `version` still parse.
- [ ] **Step 2: Run** `pnpm test -- src/renderer/packages/chat-review src/renderer/stores/session/plan-lifecycle.test.ts src/renderer/stores/sessionActions.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** `recordFinishedPlan` imports `addReviewEntry` directly. In `generation.ts`: `updatePendingPlanStatus` accepts `'revised'`; `approveAndExecutePlan` writes `startedAt: Date.now()` with the approval; `requestPlanChanges` uses `'revised'`; the new pending plan at `:1248` gets `version: nextPlanVersion(messages, targetMsg.id)`; in the execution branch at `:1244` the kept plan becomes `{ ...existingPlanPart, finishedAt: Date.now() }`; after `:1416` call `recordFinishedPlan(session, targetMsg.id, finalPlanPart)` (non-fatal `try`). Remember recorded plans by `messageId:finishedAt` in a module `Set` so retries cannot file twice (1b's merge-by-`ref` is the second guard).
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(plan): record plan versions and timing; finished plan files one Change entry`.

### Task 5: The plan card

**Files:**
- Create: `src/renderer/components/plan/planSteps.ts`, `src/renderer/components/plan/planSteps.test.ts`
- Create: `src/renderer/components/plan/PlanCard.tsx`, `src/renderer/components/plan/PlanCard.test.tsx`
- Modify: `src/renderer/components/chat/Message.tsx:123-125` (lazy import → `PlanCard`), `:855-865` (render)
- Modify: `src/renderer/components/chat/ChatDockStack.tsx` (drop `TaskProgress`, `onContinueTasks`, `taskDetailsMode`), callers `src/renderer/routes/session/$sessionId.tsx:341-347`, `src/renderer/routes/quick.tsx:329`
- Delete: `src/renderer/components/PlanApproval/` and `src/renderer/components/TaskProgress/` (move `sortTasksForDisplay` and its test cases into `planSteps.ts` / `planSteps.test.ts`)

**Interfaces:**
- Consumes: Task 4 schema; `useTaskStore`, `Task` from `@/stores/taskStore`; `approveAndExecutePlan`, `requestPlanChanges`, `rejectPlan` (existing); `continueActiveSessionTasks(sessionId)` from `@/stores/session/messages`; `Mascot` (1b), `formatDangoDuration`, `useThinkingTimer`.
- Produces:
  ```ts
  export type PlanCardState = 'proposed' | 'running' | 'stopped' | 'finished' | 'rejected' | 'revised'
  export type PlanStepView = { title: string; status: 'pending' | 'current' | 'done' | 'failed' }
  export function parsePlanSteps(planText: string): string[]          // numbered or bulleted lines, max 20
  export function planCardState(plan: MessagePlanPart, generating: boolean): PlanCardState
  export function planStepViews(planText: string, tasks: Task[]): PlanStepView[] // tasks win when non-empty
  export function sortTasksForDisplay(tasks: Task[]): Task[]
  export type PlanCardProps = {
    plan: MessagePlanPart; sessionId: string; generating: boolean; touchesFiles: boolean
    onRun(): Promise<void>; onRequestChanges(feedback: string): Promise<void>; onReject(): Promise<void>; onStop(): void
  }
  export default function PlanCard(props: PlanCardProps): JSX.Element
  ```
  `planCardState`: `pending` → proposed; `revised` → revised; `rejected` → rejected; `approved` with `finishedAt` → finished; `approved` and generating → running; `approved`, not generating, no `finishedAt` → stopped.

- [ ] **Step 1: Write the failing tests**
  - `planSteps.test.ts`: `parsePlanSteps('Intro\n1. Find\n2) Update\n- Move\n* Log')` is `['Find', 'Update', 'Move', 'Log']`; plain prose → `[]`; the six `planCardState` cases above; `planStepViews` with tasks `[done, in-progress, pending]` → statuses `done, current, pending`; without tasks → every step `pending`; the moved `sortTasksForDisplay` cases.
  - `PlanCard.test.tsx` (jsdom): proposed card shows "Proposed plan", chip "3 steps", the blue chip "edits files · asks before applying" only when `touchesFiles`, buttons Run plan / Request changes / Reject and the hint "↵ run · E change · Esc reject"; with the card focused, Enter calls `onRun`, `e` opens the feedback field, Escape calls `onReject`. Running card with tasks `[done, in-progress, pending, pending]` shows the working mascot, "Running plan · step 2 of 4", a timer, the done step with `is-done`, the current one with `is-current`, Stop (calls `onStop`) and "Edits are staged and arrive in Review as one Change."; no Run plan button. Finished card is a closed `details` titled "Ran plan · 4 steps · 2 m" for `startedAt`/`finishedAt` 120 000 ms apart. `revised plans fold and lose their actions`: `status: 'revised', version: 2` → closed `details` "Plan v2" and no buttons. Stopped card shows "Plan stopped · 1 of 4 done" and Continue, which calls `continueActiveSessionTasks('s1')`.
  - In `Message` tests (new `Message.plan.test.tsx`, heavy children mocked): a generating message with an approved plan renders its `ThinkingLine` with `showMascot={false}`.
- [ ] **Step 2: Run** `pnpm test -- src/renderer/components/plan src/renderer/components/chat`. Expected: FAIL.
- [ ] **Step 3: Implement.** Proposed/running sections use `dg-plan`, `dg-plan__head`, `dg-plan__time`, `dg-plan__n`, `dg-plan__note`, `dg-plan__actions`; finished, rejected and revised use a closed `<details>` whose body is the step list (or the plan Markdown when no steps parse). The feedback field keeps PlanApproval's copy ("Describe what the revised plan should change", "Request revised plan", "Cancel") and its busy/error handling. `Message.tsx` passes `touchesFiles = Boolean(session.agentMode && (session.projectId || session.workspaceRoot))` through a new `Message` prop `planTouchesFiles` set by `MessageList`, and `onStop` as in Task 2. Outside plans, task lists stay visible in the thread through `TodoAppCard`.
- [ ] **Step 4: Run** `pnpm test`, `pnpm check`, `pnpm lint`. Expected: PASS, no regressions vs `main`.
- [ ] **Step 5: Commit**: `feat(plan): plan card with progress replaces PlanApproval and the task dock`.

### Task 6: Artifacts in the inspector

**Files:**
- Create: `src/renderer/components/workspace/artifactFile.ts`, `src/renderer/components/workspace/artifactFile.test.ts`, `src/renderer/components/workspace/WorkspacePanel.test.tsx`
- Modify: `src/renderer/components/workspace/WorkspacePanel.tsx:229` (aria-label), `:310-370` (header actions)
- Modify: `src/renderer/stores/uiStore.ts:80` (`workspaceWidthPx` default `520` → `460`)
- Modify: `src/renderer/components/Artifact.tsx:265-272` (tooltip and label "Open in workspace" → "Open")

**Interfaces:**
- Consumes: `platform.exporter.exportTextFile(filename, content)`; `ArtifactKind` from `@shared/artifacts`.
- Produces: `artifactFileName(input: { title?: string; kind: ArtifactKind; language?: string }): string`.
  Extensions: html `.html`, svg `.svg`, markdown `.md`, mermaid `.mmd`; code by language: js/javascript `.js`, ts/typescript `.ts`, tsx `.tsx`, jsx `.jsx`, py/python `.py`, css `.css`, json `.json`, sh/bash `.sh`, else `.txt`. Base name: title lower-cased, runs of non `[a-z0-9]` → `-`, trimmed of `-`, max 60 chars, empty → `artifact`.

- [ ] **Step 1: Write the failing tests**
  - `artifactFile.test.ts`: `{ title: 'Pricing Table v2', kind: 'html' }` → `'pricing-table-v2.html'`; `{ kind: 'code', language: 'python' }` → `'artifact.py'`; `{ title: '***', kind: 'code', language: 'zig' }` → `'artifact.txt'`; a 90-char title yields a base of 60 chars.
  - `WorkspacePanel.test.tsx` (jsdom, `uiStore` seeded with a two-version html artifact, `platform` mocked): the panel's `aria-label` is "Artifact"; tabs "Preview" and "Code"; toolbar buttons "Full screen" (pressing it flips to "Exit full screen"), "Copy", "Download" (calls `exportTextFile('<slug>.html', <current version content>)`), "Close"; the version pager shows "v2" and Previous version switches content to v1; Download after paging exports v1's content.
- [ ] **Step 2: Run** `pnpm test -- src/renderer/components/workspace`. Expected: FAIL.
- [ ] **Step 3: Implement** the helper, the Download button (Lucide `Download`, between Copy and Close), the relabels ("Expand workspace" → "Full screen", "Exit full workspace" → "Exit full screen", "Copy source" → "Copy", "Close workspace" → "Close", `aria-label` "Artifact Studio" → "Artifact", toolbar label → "Artifact actions") and the 460 px default.
- [ ] **Step 4: Run** `pnpm test`, `pnpm check`, `pnpm lint`. Expected: PASS.
- [ ] **Step 5: Look at it.** `pnpm dev:web`: send a prompt to a reasoning model (live line, 8 s and 30 s copy, Stop), a tool-using turn (one-line block), a plan run in a folder scope (card states), and an HTML artifact (inspector actions), in light and dark. Compare with canvas screens CH1, CH7, CH8, AG1, AG2, AR1 and fix what is off.
- [ ] **Step 6: Commit**: `feat(artifacts): inspector download, labels and 460 px width`; then add one line to `docs/log.md` under 2026-10-17 and commit `docs: log slice 6a`.
