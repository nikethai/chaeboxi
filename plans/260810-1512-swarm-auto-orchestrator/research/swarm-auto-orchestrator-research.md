# Research Report: Swarm + Auto Orchestrator Task Assignment

**Date:** 2026-08-10  
**Topic:** Multi-agent swarm patterns + auto task assignment for Chaeboxi  
**Status:** Complete (architecture intel for ship plan)

## Table of contents

1. [Executive Summary](#executive-summary)
2. [Research Methodology](#research-methodology)
3. [Key Findings](#key-findings)
4. [Comparative Analysis](#comparative-analysis)
5. [Chaeboxi Gap Analysis](#chaeboxi-gap-analysis)
6. [Implementation Recommendations](#implementation-recommendations)
7. [Resources](#resources)
8. [Unresolved Questions](#unresolved-questions)

---

## Executive Summary

Industry 2025–2026 multi-agent stacks converge on **four production patterns**: sequential pipeline, hierarchical manager→workers, handoffs (router), and **shared task board + claim** (Claude Code Agent Teams). Chaeboxi already ships the first two in thin form as **Discuss** (roundtable) and **Work** (plan → lead do → review → deliver). That is solid product ground — **not** a greenfield swarm.

What users mean by “swarm + auto orchestrator” is usually: **(1)** a lead/manager that **decomposes** a goal into tasks, **(2)** **assigns** tasks to specialized agents by capability, **(3)** runs work with visibility/progress, optionally **parallel**, **(4)** **merges** results. Claude Code’s Agent Teams is the closest product reference: lead + teammates + shared task list + claim/assign + inter-agent messaging — still experimental, high token cost, explicit caps.

**Brutal take:** Do **not** import CrewAI/LangGraph/AutoGen into Chaeboxi. Extend existing `multi-agent-room` + `taskStore` into a third room mode **`swarm`** (or evolve Work into **Work v2 / Swarm**) with an orchestrator phase that writes tasks, assigns owners, then executes. Ship **sequential assignment first**; parallel later. Cap agents at 3–5, tasks per run, and always keep user interrupt.

---

## Research Methodology

- Sources consulted: ~15 (web + Claude Code docs + Chaeboxi codebase/docs/prior plans)
- Date range: 2025-03 → 2026-08
- Key search terms: multi-agent swarm orchestration, CrewAI hierarchical, OpenAI Agents SDK handoffs, Claude Code agent teams, Cursor background agents, task assignment
- Gemini CLI: unavailable (exit 127) → WebSearch + official docs fetch
- Prior Chaeboxi research reused: `plans/260807-1830-agents-multi-agent-chat/research/`, `docs/agents-multi-agent-rooms.md`

---

## Key Findings

### 1. Technology overview

| Pattern | Core idea | Best for |
|---------|-----------|----------|
| **Group chat / debate** | Shared thread, turn-taking | Research, tradeoffs, “talk it out” |
| **Sequential pipeline** | Fixed A→B→C roles | Draft→edit→review |
| **Hierarchical / manager** | Manager plans + assigns tasks to specialists | Multi-step deliverables |
| **Handoffs** | Agent transfers control when out of scope | Domain routing |
| **Agents-as-tools** | Manager keeps final answer; specialists are callable tools | Bounded specialist skills |
| **Shared task board + claim** | Tasks in shared list; lead assigns or workers claim | Parallel independent work |

Chaeboxi today:

| Chaeboxi mode | Industry analogue |
|---------------|-------------------|
| Discuss | Group chat / council (capped rounds) |
| Work | Fixed hierarchical pipeline (not dynamic assignment) |
| `create_task` / `update_task` / `list_tasks` | Solo agent checklist (not multi-owner board) |

### 2. Current state & trends (2026)

1. **OpenAI Swarm → Agents SDK** — handoffs + agents-as-tools + guardrails; deliberately minimal orchestration.
2. **CrewAI** — role crews; process types: sequential, hierarchical (manager delegates), consensual; Flows wrap autonomy in deterministic steps.
3. **LangGraph** — explicit graph + checkpointing; production control, higher complexity.
4. **AutoGen / AG2** — conversation-centric multi-agent; research-heavy.
5. **Claude Code Agent Teams** (experimental) — lead + independent teammates + **shared task list** + claim/assign + mailbox messaging; **subagents ≠ teams** (subagents only report up; teams talk peer-to-peer).
6. **Cursor** — background/cloud agents + control-plane UI; more “many jobs” than in-thread swarm debate.
7. Production survivors emphasize **orchestration with caps**, human steering, and **not** unbounded free debate.

### 3. Best practices (consensus)

1. **Lead/manager owns decomposition**; workers get **narrow, self-contained tasks**.
2. **Shared task ledger** is the coordination primitive (not chat alone).
3. **Speaker/assignee selection**: start rule-based (role match, lead pick); LLM pick only if needed.
4. **Caps**: 3–5 agents; limited rounds/tasks; user interrupt always.
5. **Tools**: discuss = tools off; execute = tools on only for assigned workers with agentMode.
6. **Cost**: N agents × context ≈ linear; teams often **2–5×** solo. Prefer solo/subagent for sequential work.
7. **File/work isolation** matters for true parallel code edits (worktrees) — Chaeboxi chat app is not Claude Code; parallel tool races need explicit policy.
8. **Human-in-the-loop**: plan approval, kill switch, re-assign.
9. **Do not free-run unattended** for long; status UI is product, not nice-to-have.

### 4. Security considerations

- Teammate permission prompts must not be bypassable via peer messages (Claude Code models this explicitly).
- Swarm increases **tool blast radius** — keep Work-style: only executors get tools.
- Task board must not store secrets; agent prompts may leak cross-agent context if full history shared.
- Local-first Chaeboxi: orchestrator state in session storage only; no cloud control plane required for v1.

### 5. Performance insights

- Sequential swarm: predictable latency = sum of turns; easier to ship.
- Parallel swarm: lower wall-clock, higher peak API cost, harder cancel/interrupt, race on shared session tools.
- Context: each full independent agent window is expensive; **shared thread** (Chaeboxi style) is cheaper but noisier than isolated contexts.
- Chaeboxi reuses one session thread + continue bridges → good for Discuss/Work; for Swarm prefer **task-scoped prompts** (goal + task + prior artifact summary) rather than full debate transcript every time.

---

## Comparative Analysis

| Product / framework | Orchestration | Task assign | Parallel | Peer messaging | Fit for Chaeboxi |
|---------------------|---------------|-------------|----------|----------------|------------------|
| CrewAI hierarchical | Manager + crew | Manager assigns Tasks | Limited | Via process | Conceptual model only |
| OpenAI Agents SDK | Handoffs / tools | Implicit in handoff | No default swarm | No | Handoff later |
| LangGraph | Graph edges | Explicit nodes | Yes | Via state | Overkill for v1 |
| Claude Code Agent Teams | Lead + task board | Assign + self-claim | Yes (process) | Mailbox | **Best product north star** |
| Cursor background agents | Job queue / control plane | User or agent kickoff | Yes (VMs) | Weak | Desktop job UI inspiration |
| Chaeboxi Discuss/Work today | Fixed scripts | Lead = first `@` only | No | Thread only | **Foundation to extend** |

### What Claude Code got right (steal carefully)

1. **Shared task list** as coordination spine  
2. **Lead assigns OR self-claim**  
3. **Dependencies** between tasks  
4. **Subagents vs teams** distinction (fan-out vs collaboration)  
5. **Experimental flag** + cost honesty  

### What not to copy blindly

1. Full separate process per agent (Chaeboxi is single renderer + LLM stream model)  
2. Mailbox JSON files under `~/.claude/teams`  
3. Unbounded teammate count  
4. Peer tool permission relay  

---

## Chaeboxi Gap Analysis

### Already built (reuse)

| Asset | Path / note |
|-------|-------------|
| Room membership | `Session.agentIds`, `@` mentions, max 3 |
| Discuss/Work orchestrator | `multi-agent-room.ts` |
| Protocols | `agent-room.ts` (stances, plan/do/review/deliver) |
| Live UI strip | `team-room-state.ts`, `TeamRoomActions`, `AgentRoomStrip` |
| Task tools | `task-tracking.ts` + `taskStore` |
| Agent personas | Settings Agents, model/tool overrides |
| Interrupt | user send aborts queue |

### Gaps for swarm + auto assign

| Gap | Severity | Notes |
|-----|----------|-------|
| No dynamic task decomposition step owned by orchestrator | High | Work “plan” is chat turns, not structured tasks |
| Tasks have no `assigneeAgentId` / deps / claim | High | taskStore is solo checklist |
| Assignment = static `roomLeadId` / first speaker | High | No skill/role matching |
| No parallel fan-out of tool runs | Medium | YAGNI for v1 if sequential assign works |
| No “swarm” mode / product language | Medium | Discuss/Work only |
| No subagent (result-only) path vs team path | Medium | All room speakers share thread |
| Cost meter / estimate for multi-agent runs | Low | Trust/UX |

### Honest scope cut

**v1 Swarm ≠ Claude Code Agent Teams.**  
v1 = **hierarchical Work with a real task board + auto assignment + sequential execute**.  
v2 = parallel execute + claim + optional handoff.

---

## Implementation Recommendations

### Product model (recommended)

Add room mode **`swarm`** (or upgrade Work):

```text
User goal (2+ agents, Swarm mode, agentMode on)
  → Orchestrator (lead) produces structured TaskPlan JSON
  → Persist tasks with assigneeAgentId + deps
  → For each ready task (topo order):
        assigned agent executes (tools on if allowed)
        updates task status
  → Lead synthesize / deliver
  → User can interrupt, re-assign, or “continue swarm”
```

### Assignment policy (v1)

Priority order (deterministic, testable):

1. User explicit `@` on a task (later UI)  
2. Agent name/role match from persona prompt tags / `AgentDetail` capabilities (if present)  
3. Round-robin among room members excluding pure “reviewer” if tagged  
4. Fallback: `roomLeadId` or first agent  

Optional **one LLM assign call** only if rule-based confidence low — defer if possible (cost + flakiness).

### Data model additions (minimal)

```ts
// Task (extend existing session task)
{
  id, title, status, progress,
  assigneeAgentId?: string
  dependsOn?: string[]
  roomRole?: 'plan' | 'do' | 'review' | 'deliver' | 'swarm_task'
  createdBy: 'orchestrator' | 'agent' | 'user'
}

// Session
roomMode?: 'discuss' | 'work' | 'swarm'
swarmState?: {
  phase: 'planning' | 'assigning' | 'executing' | 'synthesizing' | 'idle'
  planMessageId?: string
  currentTaskId?: string
}
```

### Architecture (keep thin)

```
shared/
  agent-room.ts          # protocols + assignment pure fns
  swarm-plan.ts          # parse/validate TaskPlan schema
renderer/stores/session/
  multi-agent-room.ts    # add runAgentRoomSwarm()
  team-room-state.ts     # phase + current assignee
stores/
  taskStore.ts           # assignee + deps + claim API
packages/model-calls/
  toolsets/task-tracking.ts  # optional assign_task tool for lead
```

**Do not** add Python CrewAI bridge. **Do not** new Rust process swarm for v1.

### Quick start ship phases

See parent `plan.md`. Summary:

1. **Schema + task board multi-owner**  
2. **Orchestrator plan turn → structured tasks**  
3. **Sequential execute by assignee**  
4. **UX: Swarm mode + live assign strip**  
5. **Parallel + claim (v1.5)**  

### Common pitfalls

1. Replaying full multi-agent debate into every worker → token blowup  
2. All agents tools-on in parallel → races, double-edits, messy cancel  
3. Unbounded “keep going until done” loops without max tasks/turns  
4. Fake swarm: three monologues with no task ledger (current Work risk)  
5. Importing heavy frameworks instead of 200–400 LOC orchestrator  

### Code-shape example (assignment pure)

```ts
function assignTasks(
  tasks: { id: string; title: string; preferredRole?: string }[],
  agents: { id: string; name: string; tags: string[] }[],
  leadId: string
): Record<string, string> {
  const load = Object.fromEntries(agents.map((a) => [a.id, 0]))
  const out: Record<string, string> = {}
  for (const t of tasks) {
    const byTag = agents.find((a) =>
      t.preferredRole ? a.tags.includes(t.preferredRole) : false
    )
    const leastBusy = [...agents].sort((a, b) => load[a.id] - load[b.id])[0]
    const id = byTag?.id ?? leastBusy?.id ?? leadId
    out[t.id] = id
    load[id] += 1
  }
  return out
}
```

---

## Resources

### Official / primary

- [Claude Code Agent Teams](https://code.claude.com/docs/en/agent-teams)
- OpenAI Agents SDK (successor to Swarm) — platform docs
- CrewAI multi-agent task automation docs
- Langfuse / industry comparisons 2025–2026 multi-agent frameworks

### Chaeboxi internal

- `docs/agents-multi-agent-rooms.md`
- `plans/2026-08-08-team-room-discuss-work/plan.md`
- `plans/260807-1830-agents-multi-agent-chat/research/agents-multi-agent-research.md`
- `plans/2026-08-07-in-chat-todo-app/plan.md`
- `src/renderer/stores/session/multi-agent-room.ts`
- `src/renderer/packages/model-calls/toolsets/task-tracking.ts`

### Further reading

- Addy Osmani — “The Code Agent Orchestra” (orchestrator vs single agent product patterns)
- Azure multi-agent architecture patterns (group chat, concurrent, sequential, handoff, magentic)

---

## Unresolved questions

1. Product name: new mode **Swarm** vs evolve **Work** into task-board Work?  
2. Max agents for swarm: keep 3 or raise to 5?  
3. Parallel execute in v1 or strictly sequential? (recommend sequential)  
4. Should orchestrator be a **dedicated system agent** (not a room persona) or always the **lead persona**?  
5. Persist swarm task board across session reload (yes if taskStore persists)?  
6. OpenClaw/Pi multi-runtime swarm? (docs say team rooms native-only v1 — keep that)  

---

## Appendices

### A. Glossary

| Term | Definition |
|------|------------|
| Swarm | Multi-agent run with task decomposition + assignment + execute |
| Orchestrator / lead | Agent (or system role) that plans and assigns |
| Task board | Shared list of work items with status + owner |
| Claim | Worker picks unassigned ready task |
| Subagent | Result-only worker; no peer coordination |
| Handoff | Transfer of control between agents |

### B. Mapping to Chaeboxi room roles

| Swarm phase | Reuse `roomRole` |
|-------------|------------------|
| Plan tasks | `plan` (lead only, structured) |
| Execute task | `do` (assignee) |
| Peer review optional | `review` |
| Final merge | `deliver` / `synthesis` |
| Discuss still separate | `turn` |

### C. Raw notes

- Gemini research path skipped (CLI missing).  
- Prior team-room plan explicitly deferred “LLM manager speaker pick” — swarm reopens that as **task assign**, not speaker pick for debate.
