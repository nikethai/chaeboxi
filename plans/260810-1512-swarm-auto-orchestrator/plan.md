# Plan: Swarm Mode + Auto Orchestrator Task Assignment

**Status:** Implemented v1 · review **9.0/10** (0 critical) · cook --auto **done**  
**Date:** 2026-08-10  
**Research:** `research/swarm-auto-orchestrator-research.md`  
**Related:** `docs/agents-multi-agent-rooms.md`, Work mode, `taskStore` / task tools  
**Summary:** `reports/implementation-summary.md`  
**Code review:** `reports/2026-08-10-code-review-swarm-auto-orchestrator.md` (6.5)  
**Re-review:** `reports/2026-08-10-code-review-swarm-auto-orchestrator-rereview.md` — **9.0/10**, criticals **0**

### Implementation checklist (vs acceptance)

| AC / phase | Status |
|------------|--------|
| Phase 0 product lock | **Done** (D1–D5 locked: `swarm` mode, sequential, max 3 agents, lead orchestrator, tools-first hybrid) |
| Phase 1 task board multi-owner | **Done** (`assigneeAgentId`, `dependsOn`, `listReadyTasks`, tests) |
| Phase 2 plan → tasks | **Done** (task tools + JSON fallback + soft retry) |
| Phase 3 assign + sequential execute | **Done** (`assignTasks`, `runAgentRoomSwarm`) — C1 fixed |
| Phase 4 UX + docs | **Done** (mode dropdown, strip, task dock assignee, docs; Re-plan/Skip bar deferred optional) |
| Phase 5 hardening | **Done** (caps, interrupt baseline, clearOpenSwarmTasks, continue-on-fail, review 9.0; agentMode banner deferred optional) |
| Phase 6 later (parallel / self-claim / tags UI / multi-runtime) | **Out of scope** (post-v1) |
| AC1 task list with owners | **Done** |
| AC2 dep order + assignee bubbles | **Done** |
| AC3 interrupt stops queue | **Done** (baseline count+id; mid-run + turn cancel) |
| AC4 tools policy | **Done** (plan task-only; do/deliver + agentMode) |
| AC5 Discuss/Work unchanged | **Done** (additive swarm branch) |
| AC6 caps | **Done** (`MAX_SWARM_TASKS/TURNS`) |
| AC7 docs + unit tests | **Done** (docs + helpers + interrupt baseline tests; full loop mocks still light/optional) |

### Post-ship notes (v1 complete)

1. ~~P0 interrupt baseline~~ Done (`baselineMsgCount` + `baselineLastId`).
2. ~~P1 stale board~~ Done (`clearOpenSwarmTasks` at run start).
3. ~~P1 swarm continue prompt~~ Done (`buildRoomContinuePrompt` + generation wiring).
4. Optional polish (not blocking v1): pure interrupt helper export; mock loop tests; Re-plan/Skip UX; agentMode banner; dep-cycle soft-fail.
5. Phase 6 items remain later — see §5 Phase 6.

---

## 1. Goal

Ship a **Swarm** capability: multi-agent rooms where a **lead orchestrator** decomposes the user goal into tasks, **auto-assigns** tasks to room agents, executes with progress visibility, and delivers a merged result.

**North star feel**

1. User picks 2–3 agents → mode **Swarm** → states a multi-step goal.  
2. Lead writes a short plan as **structured tasks** (visible checklist, owners).  
3. Each task runs under the **assigned** agent (tools only for executors).  
4. User sees who is working, can interrupt, can request re-plan.  
5. Not karaoke monologues; not unbounded free debate.

**Non-goals (v1)**

- Import CrewAI / LangGraph / AutoGen  
- Parallel multi-tool races across agents  
- Peer mailbox messaging like Claude Code  
- Multi-runtime (OpenClaw + native) swarms  
- Self-claim marketplace with many agents  
- Separate OS processes per agent  

---

## 2. Why this shape (brutal)

| Option | Verdict |
|--------|---------|
| Greenfield “agent OS” | Overkill; months; wrong for chat client |
| Glue Python CrewAI via sidecar | License/process/UX hell; not local-first TS |
| Discuss-only with more rounds | Already shipped; not task orchestration |
| Work mode only (plan→do→review→deliver) | Close but **no task board, no multi-assignee** |
| **Evolve Work → Swarm (task board + assign)** | **Ship path** — reuses 80% of code |

Chaeboxi already has Discuss + Work + task tools. Swarm is the **missing hierarchical assign loop**.

---

## 3. Product decisions (recommended defaults)

| Decision | Recommendation | Rationale |
|----------|----------------|-----------|
| Mode name | **`swarm`** as third `roomMode` | Clear vs Discuss/Work; marketing “swarm” matches ask |
| Orchestrator | Lead persona (`roomLeadId` / first member) | No new system agent type in v1 |
| Assignment | Rule-based first; optional LLM only if tags miss | Deterministic + testable |
| Execute order | **Sequential** topo by deps | Cancel/cost/safety |
| Caps | Agents ≤3 (raise later), tasks ≤12, max agent turns ≤ MAX_AGENT_TURNS | Cost + UX |
| Tools | Only assignee on `do` tasks; lead tools off during plan/assign | Same as Work safety model |
| Parallel | v1.5+ | After sequential is solid |
| Runtime | Native only | Match team rooms v1 |

---

## 4. Architecture

```text
                    ┌─────────────────────────┐
  User goal         │  Room mode = swarm      │
  agentIds[2+]      │  agentMode on preferred │
                    └───────────┬─────────────┘
                                ▼
                    ┌─────────────────────────┐
                    │  Orchestrator (lead)    │
                    │  plan → TaskPlan JSON   │
                    └───────────┬─────────────┘
                                ▼
                    ┌─────────────────────────┐
                    │  taskStore (session)    │
                    │  title, status,         │
                    │  assigneeAgentId, deps  │
                    └───────────┬─────────────┘
                                ▼
              for each ready task (sequential)
                    ┌─────────────────────────┐
                    │  Assignee agent `do`    │
                    │  tools if agentMode     │
                    │  update_task on done    │
                    └───────────┬─────────────┘
                                ▼
                    ┌─────────────────────────┐
                    │  Lead deliver/synthesis │
                    └─────────────────────────┘
```

### Boundaries

| Component | Owns | Does not own |
|-----------|------|--------------|
| `swarm-plan.ts` (new shared) | Schema parse/validate TaskPlan | UI |
| `agent-room.ts` | `assignTasks()`, swarm protocols | Persistence |
| `multi-agent-room.ts` | `runAgentRoomSwarm()` loop | Persona catalog |
| `taskStore` | Multi-owner tasks, deps, hydrate | LLM calls |
| `task-tracking` tools | Model-visible mutations | Orchestrator graph |
| `team-room-state` | Live phase/assignee for strip | History |
| Discuss/Work | Unchanged default paths | Swarm internals |

### Key files to touch

| Action | Path |
|--------|------|
| Extend | `src/shared/types.ts` (`MAX_*` if needed) |
| Extend | `src/shared/types/session.ts` (`roomMode` + task fields) |
| Extend | `src/shared/agent-room.ts` |
| Create | `src/shared/swarm-plan.ts` + tests |
| Extend | `src/renderer/stores/taskStore.ts` |
| Extend | `src/renderer/packages/model-calls/toolsets/task-tracking.ts` |
| Extend | `src/renderer/stores/session/multi-agent-room.ts` |
| Extend | `src/renderer/stores/session/team-room-state.ts` |
| Extend | `TeamRoomActions`, mode dropdown, `AgentRoomStrip` |
| Update | `docs/agents-multi-agent-rooms.md` |

---

## 5. Phases

### Phase 0 — Product lock (0.5 day) — **DONE**

- Confirm: new `swarm` mode vs Work upgrade  
- Confirm sequential-only v1  
- Confirm agent cap 3  
- Write acceptance criteria (below)

**Exit:** decisions in this plan marked Final. ✅

### Phase 1 — Task board multi-owner foundation — **DONE**

**Requirements**

- Task model: `assigneeAgentId?`, `dependsOn?: string[]`, `createdBy`  
- `taskStore` APIs: setAssignee, setDeps, listReadyTasks, claim (noop or single-owner)  
- Persist with existing session hydrate path  
- Unit tests for topo-ready queue  

**Validation:** store tests only; no UI swarm yet. ✅

### Phase 2 — Orchestrator plan → structured tasks — **DONE**

**Requirements**

- Lead `plan` turn with **strict JSON** schema (or tool `create_task` × N + `assign_task`)  
- Prefer **tool-based** creation (reuse task tools) over free JSON in prose — more reliable  
- New protocol `buildSwarmPlanProtocol`  
- On plan complete: tasks visible in TaskProgress dock with assignees  

**Validation:** mock lead plan populates board; invalid plan soft-fails + one retry. ✅

### Phase 3 — Auto assign + sequential execute — **DONE**

**Requirements**

- Pure `assignTasks(tasks, agents, leadId)` with tags/round-robin  
- `runAgentRoomSwarm`: for ready tasks → `generateSpeakerTurn` with `roomRole: 'do'`, `speakerAgentId = assignee`  
- Update task status in_progress → done/failed  
- Interrupt on new user message (reuse Work interrupt)  
- Final lead `deliver` when all done or max turns  

**Validation:** unit tests for assign; integration-style test for queue order; manual 2-agent swarm goal. ✅

### Phase 4 — UX + docs — **DONE**

**Requirements**

- Mode dropdown: Discuss | Work | **Swarm**  
- Live strip: `Swarm · Task 2/5 · Researcher working…`  
- Actions bar: Re-plan | Skip task | Stop swarm | Team answer (optional) — *Re-plan/Skip deferred optional*  
- Docs update in `agents-multi-agent-rooms.md`  
- Cost hint in empty/help copy (multi-agent uses more tokens)

**Validation:** manual UX on desktop web; interrupt mid-task. ✅ (core UX shipped)

### Phase 5 — Hardening (ship gate) — **DONE**

- Caps, empty assignee fallback, failed task continue vs abort policy  
- agentMode off → swarm still plans but tools disabled (clear banner) — *banner deferred optional*  
- Lint/typecheck/focused tests  
- Code review on orchestrator cancel paths — re-review **9.0/10**, 0 critical  

### Phase 6 — Later (explicitly out of v1) — **OUT OF SCOPE**

- Parallel fan-out with concurrency=2  
- Self-claim  
- LLM manager reassignment  
- Agent capability tags UI on Agent settings  
- OpenClaw/Pi swarm  

---

## 6. Acceptance criteria (v1)

1. With 2+ agents + Swarm mode, user goal produces a **task list with owners** without manual task typing.  
2. Tasks execute **in dependency order**, each under **correct assignee** bubble (`Message.agentId`).  
3. User **interrupt** stops remaining queue (same as Discuss/Work).  
4. Tools only when assignee turn + agentMode + toolAccess allow.  
5. Discuss and Work modes **unchanged**.  
6. Caps enforced: agents, tasks, turns.  
7. Docs + unit tests for assign + ready-queue.  

---

## 7. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Plan JSON flaky | Prefer task tools; retry once; fallback to Work pipeline |
| Cost explosion | Caps; sequential; short worker context (task brief only) |
| Users confuse Work vs Swarm | Copy: Work = fixed pipeline; Swarm = auto task assign |
| Race if parallel later | Ship sequential; file/tool mutex if parallel added |
| Orchestrator does all work itself | Protocol: “only create/assign tasks; do not implement in plan turn” |
| Cancel bugs | Reuse Work interrupt checks each loop iteration |

---

## 8. Effort estimate

| Phase | Effort |
|-------|--------|
| 0 Product lock | 0.5 d |
| 1 Task model | 1–1.5 d |
| 2 Plan → tasks | 1.5–2 d |
| 3 Assign + execute | 2–3 d |
| 4 UX + docs | 1–1.5 d |
| 5 Hardening | 1 d |
| **Total v1** | **~7–10 engineer-days** |

---

## 9. Decision log (locked for v1)

| # | Question | Options | Decision |
|---|----------|---------|----------|
| D1 | New mode or Work v2? | `swarm` mode / evolve Work | **`swarm` mode** — locked |
| D2 | Parallel in v1? | yes / no | **no** — locked |
| D3 | Max agents | 3 / 5 | **3** (raise with parallel) — locked |
| D4 | Orchestrator identity | lead persona / system “Orchestrator” | **lead persona** — locked |
| D5 | Plan mechanism | free JSON / tools only / hybrid | **tools-first hybrid** — locked |

---

## 10. Next actions

**v1 complete** (Phases 0–5). Remaining is optional polish + Phase 6 later work only:

1. ~~User locks D1–D5.~~ Done.  
2. ~~Implement Phase 1–5.~~ Done (cook --auto).  
3. ~~Code review + C1 fix + re-review.~~ Done (9.0/10, 0 critical).  
4. Optional dogfood: “research X, draft Y, critique Z” with 3 built-in agents.  
5. Optional polish: Re-plan/Skip bar, agentMode banner, deeper loop mocks.  
6. Phase 6 (parallel / self-claim / tags UI / multi-runtime) — **later / out of v1**.
