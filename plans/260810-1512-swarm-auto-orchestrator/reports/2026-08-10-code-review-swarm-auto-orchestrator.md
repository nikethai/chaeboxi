## Code Review Summary

### Scope
- Files reviewed:
  - `src/shared/agent-room.ts`, `src/shared/swarm-plan.ts`, `src/shared/types.ts`, `src/shared/types/session.ts`
  - `src/renderer/stores/session/multi-agent-room-swarm.ts`, `multi-agent-room.ts`, `generation.ts`, `team-room-state.ts`, `index.ts`
  - `src/renderer/stores/taskStore.ts`, `taskStore.test.ts`
  - `src/renderer/packages/model-calls/toolsets/task-tracking.ts`
  - UI: `TeamModeSelect.tsx`, `AgentRoomStrip.tsx`, `TaskProgressDetails.tsx`, `InputBox.tsx`, `routes/index.tsx`
  - `docs/agents-multi-agent-rooms.md`
  - tests: `agent-room.test.ts`, `swarm-plan.test.ts`
- Lines analyzed: ~+640 changed / ~900 core new+touched
- Review focus: Swarm + auto orchestrator (uncommitted)
- Updated plans: `plans/260810-1512-swarm-auto-orchestrator/plan.md`

### Overall Assessment
**Score: 6.5/10**

Solid architecture (pure assign, task board fields, modular swarm loop, task-tools-only plan path, caps, tests). **Ship blocked** by critical interrupt helper that treats the triggering user message as cancel → swarm never starts.

### Critical Issues

#### C1. Swarm exits immediately — `userInterrupted` true on start
**File:** `src/renderer/stores/session/multi-agent-room-swarm.ts`

```ts
const userInterrupted = async (): Promise<boolean> => {
  const session = await chatStore.getSession(sessionId)
  if (!session) return true
  return session.messages[session.messages.length - 1]?.role === 'user'
}

// plan block first lines:
if (await userInterrupted()) { ... return }
```

Multi-agent path inserts **user only** (no placeholder assistant) then calls `runAgentRoomSwarm`. Last role is always `user` → early return, no plan/do/deliver.

Work/Discuss avoid this: interrupt only when `i > 0` (after ≥1 agent turn).

**Fix (recommended):** baseline message count (or triggering user msg id) at run start:

```ts
const startLen = (await chatStore.getSession(sessionId))?.messages.length ?? 0
const userInterrupted = async () => {
  const session = await chatStore.getSession(sessionId)
  if (!session) return true
  const last = session.messages[session.messages.length - 1]
  return last?.role === 'user' && session.messages.length > startLen
}
```

Or drop pre-plan interrupt check; keep checks after plan + loop (last is assistant until new user).

**Impact:** Feature non-functional. Must fix before merge.

### High Priority Findings

#### H1. Stale board re-run on next Swarm
`runTaskIds` = all session pending/in-progress (capped 12). No clear/archive of prior Swarm leftovers. Second goal may re-execute old pending tasks.

**Mitigation:** On swarm start (after plan or before assign), clear done-only keep / archive prior pending, or only materialize/run tasks created this plan turn (timestamp or plan-run id).

#### H2. Continue prompt says "No tools" on swarm plan retry
`buildRoomContinuePrompt('plan')` → "No tools."  
Retry plan: history ends on assistant → continue bridge injected while system protocol + tools allow `create_task`. Contradicts; may suppress tool use on retry.

**Fix:** Mode-aware continue prompt, or swarm-specific continue string when `roomMode === 'swarm' && roomRole === 'plan'`.

#### H3. No orchestrator loop unit tests
Covered: `assignTasks`, `listReadyTasks`, `parseSwarmPlanFromText`, tool-role helpers.  
Missing: mock `generateSpeakerTurn` for interrupt-after-N, failed-continue, empty board retry, turn caps. Bug C1 would have been caught.

### Medium Priority Improvements

#### M1. Dep cycles / missing deps never ready
`sanitizeDependsOn` drops self-ref; no cycle detect; missing dep id never `done` → tasks stuck pending; loop exits → deliver. Silent incomplete run.

#### M2. Failed dep blocks dependents (by design, document)
`listReadyTasks` requires deps `done` only. Failed parent → dependents never ready → continue other ready. Matches docs. Optional: mark blocked deps failed when parent fails.

#### M3. Auto-done on any usable text
If model returns text without `update_task` and no error → `done`. Weak "I can't" replies may still mark done.

#### M4. TaskProgress shows raw `assigneeAgentId` slice
Show agent display name via `resolveAgentMeta`.

#### M5. `listReadyTasks` vs `listReadyTasksFrom` DRY
Store method duplicates pure helper; use `listReadyTasksFrom` inside store.

#### M6. Phase 4 UX incomplete (acceptable if scoped)
No Re-plan / Skip task / Stop swarm actions bar. Interrupt via new send only. Docs OK; plan Phase 4 partial.

#### M7. agentMode-off banner missing
Plan Phase 5: plan still runs, tools off on do, clear banner — not implemented.

### Low Priority Suggestions

- `agent-room.ts` ~523 lines; swarm protocols OK; further split only if growing.
- `generation.ts` already large; tool-policy block could be helper later.
- Cap messaging: `MAX_SESSION_TASKS=20` vs `MAX_SWARM_TASKS=12` — lead can create >12; only first 12 by `createdAt` run.
- Docs map says orchestrator in `multi-agent-room.ts`; impl is `multi-agent-room-swarm.ts` (re-export OK).

### Positive Observations

- Clean split: pure `assignTasks` / `swarm-plan` / store / loop module
- Tool policy correct intent: `roomRoleAllowsTaskToolsOnly` + `CANONICAL_TASK_TOOLS`; stream-text custom tools skip MCP/web merge
- Do/deliver still gated by `agentMode` + `roomRoleAllowsTools`
- Discuss/Work paths: mode switch only adds `swarm` branch; Work plan stays tools `{}`
- Caps: `MAX_SWARM_TASKS=12`, `MAX_SWARM_TURNS=15` coherent with plan+retry+tasks+deliver
- Sequential ready-queue; failed tasks don't abort independent ready
- Interrupt mid-task resets `in-progress` → `pending`
- Soft plan retry + JSON fallback materialize
- UI: TeamModeSelect MODE_META, strip `Swarm · Task i/n`, session schema `swarm`
- Tests green: agent-room, swarm-plan, taskStore assignee/deps; full suite 1184 pass; `tsc --noEmit` OK
- Docs updated for Swarm flow + caps

### Recommended Actions

1. **[P0]** Fix C1 interrupt baseline before any ship
2. **[P0]** Add loop unit tests: start-not-interrupt, mid-run interrupt, empty board retry, max turns
3. **[P1]** H2 continue-prompt for swarm plan
4. **[P1]** H1 stale task isolation per swarm run
5. **[P2]** Dep cycle / missing-dep handling or soft-fail in deliver
6. **[P2]** Display name for assignees; optional agentMode-off banner
7. Re-review after C1 + tests → target ≥9.5 for auto-approve

### Metrics
- Type Coverage: `pnpm check` clean
- Test Coverage: unit good for pure helpers; **0** for `runAgentRoomSwarm` control flow
- Linting Issues: not separately run; format consistent with Biome style in diffs
- Discuss/Work regression risk: **low** if C1-only in swarm file (tool policy branches additive)

### Unresolved questions
- On new Swarm goal: clear prior pending board or keep?
- Failed dependency: skip dependents as failed vs leave pending forever?
- Ship Re-plan/Skip in v1 or defer to Phase 6?

---

**Status:** DONE_WITH_CONCERNS  
**Summary:** Architecture and tool policy look right; **critical interrupt-on-start bug makes Swarm non-functional**. Fix C1 + add loop tests before merge.  
**Concerns/Blockers:** C1 blocks ship; H1/H2 should land same PR if possible.
