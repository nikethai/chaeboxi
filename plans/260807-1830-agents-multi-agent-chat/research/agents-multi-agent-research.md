# Research Report: Copilots → Agents + Multi-Agent Chat Tagging

**Date:** 2026-08-07  
**Scope:** Rename copilots to agents; @-tag agents in chat dock; multi-agent discussion with human-in-the-loop  
**Sources:** Chaeboxi codebase, Azure AI agent orchestration guide, AutoGen/CrewAI/LangGraph pattern literature (2025–2026)

---

## Executive Summary

Chaeboxi already has a strong **single-persona** foundation branded as **Copilots**: prompt + model overrides + tool access + hooks + maxSteps, applied via `session.copilotId`. The chat dock already has a proven **inline picker pattern** for skills (`$`), presets (`/`), and OpenClaw commands. OpenClaw and the Pi SDK plan already use the word **Agent** for tool-using runtimes — so a rename needs careful product vocabulary.

The product vision (tag multiple agents → they discuss in thread → user joins) maps cleanly to industry **group chat orchestration** (also called roundtable / multiagent debate / council). That is the right first multi-agent pattern; sequential pipeline and concurrent fan-out are useful later variants, not v1 defaults.

**Recommendation:** Do **not** import CrewAI/AutoGen/LangGraph for v1. Build a thin **Chaeboxi multi-agent orchestrator** on top of existing `generation.ts` + message store. Reuse skill-picker UX for `@` agent mentions. Rename UI/copy to Agents while keeping storage/migration aliases. Ship in phases: rename + single-agent parity → @ tagging → multi-agent group chat → polish/cost controls.

---

## 1. Current Architecture (codebase)

### 1.1 What a Copilot is today

`CopilotDetail` (`src/shared/types.ts`):

| Field | Role |
|-------|------|
| `id`, `name`, `prompt` | Persona identity + system prompt |
| `emojiAvatar` / `picUrl` | Avatar |
| `modelSettings` | temp / topP / maxTokens overlays |
| `maxSteps` | Agent-mode tool loop limit (1–25, default 5) |
| `toolAccess` | allowlist/denylist + MCP include |
| `hooks` | preTurn / postTurn (inject context, datetime, web-fetch, validate) |
| `starred`, `usedCount`, `builtIn` | UX/catalog |

Built-ins: Deep Researcher, Code Assistant, Writing Editor, Data Analyst, Task Planner (`useCopilots.ts`).

### 1.2 How copilots attach to chat

```
Settings UI (My Copilots + Featured)
        │
        ▼
session.copilotId  (SessionSchema, single optional string)
        │
        ├── New session screen: injects system message from prompt
        ├── generation.ts: overlays modelSettings, maxSteps, toolAccess, hooks
        └── Folder.defaultCopilotId for project defaults
```

**Hard limit today:** one `copilotId` per session. Messages have no `agentId` / speaker attribution beyond generic `role: assistant` and optional `name`.

### 1.3 Chat dock affordances (reuse)

`InputBox` already supports:

- `$skill` → SkillPicker + chips on user message (`skillIds`)
- `/preset` and OpenClaw `/commands`
- Composer chips for selected skills

**Direct pattern for agents:** `@agent` picker mirroring `$skill`.

### 1.4 Naming collisions (critical)

| Term today | Meaning |
|------------|---------|
| **Copilot** | Persona / system-prompt package (this feature) |
| **agentMode** | Session flag: multi-step tool use |
| **OpenClaw Agent** | Remote gateway agent runtime |
| **Pi Agent** (planned) | Local agent runtime |
| **Agent** (proposed) | User-facing rename of Copilot |

Without a glossary, Settings “Agents”, OpenClaw “Agents”, and “Agent mode” will confuse users and docs.

**Proposed product glossary:**

| Product term | Technical term | Meaning |
|--------------|----------------|---------|
| **Agent** | Agent persona (`AgentDetail`, was Copilot) | Named persona with prompt/tools/hooks |
| **Agent mode** | `session.agentMode` | Tool-loop autonomy for *the active speaker* |
| **Runtime** | native / openclaw / pi | Where generation runs |
| **Team / Roundtable** | multi-agent session mode | Multiple agents in one thread |

---

## 2. Industry patterns (multi-agent)

Microsoft Azure Architecture Center (2026) and production multi-agent literature converge on five patterns:

| Pattern | Fit for Chaeboxi vision | v1? |
|---------|-------------------------|-----|
| **Group chat** (roundtable / debate / council) | **Best match** — agents talk in shared thread; human joins | **Yes** |
| **Concurrent** (fan-out) | Multiple agents answer same question in parallel, then optional summary | Optional v1.1 |
| **Sequential** (pipeline) | A→B→C refine (draft→review→polish) | v2 |
| **Handoff** | Dynamic transfer of control | later |
| **Magentic** (manager + task ledger) | Open-ended planning with tools | later / Pi path |

**AutoGen-style** “agents converse until terminate” ≈ group chat.  
**CrewAI-style** “role crew + process” ≈ sequential/hierarchical, less like a social chat dock.  
**LangGraph** = explicit graph control; overkill until workflows need branching.

### 2.1 Group chat design rules (from production guidance)

1. **Chat manager** decides next speaker (not free-for-all infinite loops).
2. Cap participants (**≤3 agents recommended** for controllability; soft max 5).
3. Cap rounds / turns; always allow user interrupt.
4. Prefer **read-only tools** in pure discussion mode; tool use only when agentMode + explicit approval patterns already exist.
5. Cost ≈ N agents × rounds × tokens; multi-agent debate often **~2–3×** single-model cost.
6. Human-in-the-loop is a first-class participant (user’s vision matches this).

### 2.2 Speaker selection strategies (for manager)

| Strategy | Pros | Cons |
|----------|------|------|
| Round-robin fixed order | Simple, predictable | Dumb when irrelevant |
| User-mentioned order only | Matches @ tags | No cross-talk |
| LLM moderator picks next | Natural discussion | Extra call + cost |
| Concurrent then synthesize | Fast | Less “discussion” feel |
| Hybrid: one round concurrent + optional reply rounds | Good UX/cost balance | Slightly more code |

**Recommended v1 strategy:**  
Tagged agents each speak **once in tagged order** (sequential roundtable), then optional **1–2 reply rounds** if “Continue discussion” or until max rounds / user message. Later: LLM speaker selection.

---

## 3. Design recommendations for Chaeboxi

### 3.1 Product model

```
Agent (persona library)     = renamed CopilotDetail
Session.agentIds[]          = active participants (replaces single copilotId)
Message.agentId?            = which persona produced assistant message
Turn mention chips          = @-selected agents for *this user message* (like skillIds)
Multi-agent mode            = session or turn with 2+ agents
```

**UX flow (happy path):**

1. User types in chat dock: `What should we ship next? @Task Planner @Deep Researcher`
2. InputBox shows AgentPicker on `@`, inserts chips (like skills).
3. On send:
   - User message stored with `mentionedAgentIds: [...]`
   - Orchestrator creates N assistant messages (or N sequential generates into thread), each labeled with agent name/avatar.
4. Agents discuss (roundtable).
5. User sends follow-up without tags → all active session agents continue, **or** only last speakers — product decision (see open questions).
6. User can re-@ a subset to re-scope the round.

### 3.2 Message UI

- Assistant bubble shows **agent avatar + name** (Message already has optional `name`).
- Distinct colors / badges per agent in thread.
- Optional “speaking…” status for current agent in multi-turn.
- Collapse long multi-agent rounds into a group header (“3 agents discussed · 6 turns”).

### 3.3 Prompt construction (per agent turn)

For each speaking agent:

```
system: agent.prompt
+ multi-agent protocol block:
  "You are one participant in a group discussion.
   Other participants: [...]. User is also present.
   Respond as yourself only. Be concise. Build on prior points.
   Do not speak for other agents."
context: conversation history (including other agents' messages as assistant|name or role-play as distinct speakers)
```

Map other agents into the model context as:

- Prefer structured messages with `name` field where provider supports it (OpenAI-compatible).
- Fallback: prefix content with `**Deep Researcher:** ...` for providers that ignore `name`.

### 3.4 Orchestrator placement

```
submitNewUserMessage
  → if mentionedAgentIds.length <= 1: existing single-agent path
  → else: multiAgentOrchestrator.run({ sessionId, agentIds, userMsg, strategy })
       for each turn:
         set ephemeral speaker = agent
         apply that agent’s modelSettings / toolAccess / hooks
         stream into new assistant message with agentId + name
         abort if user cancel / maxRounds
```

Keep orchestration in `src/renderer/stores/session/` (e.g. `multi-agent-orchestrator.ts`) — same process as generation, no new backend required for native chat.

### 3.5 Rename strategy (KISS + migration)

**Do not big-bang rename all symbols in one PR** if avoidable; prefer:

| Layer | Approach |
|-------|----------|
| UI strings / i18n | Copilot → Agent immediately |
| Routes | `/settings/agents` with redirect from `/settings/copilots` |
| Storage key | Keep `MyCopilots` or migrate once to `MyAgents` with read-fallback |
| Types | `AgentDetail` alias or rename + re-export `CopilotDetail` deprecated |
| Analytics events | New `agent_*` + dual-write old events short term |

### 3.6 Relation to Pi SDK / OpenClaw plans

- **This feature** = multi-persona **native chat orchestration** (prompt personas).
- **Pi / OpenClaw** = optional **runtimes** for tool-heavy single agent.
- v1 multi-agent discussion should run on **native** provider path only.
- Later: one tagged agent may resolve to OpenClaw/Pi runtime; multi-runtime group chat is out of scope for v1.

### 3.7 What NOT to do (YAGNI)

- Do not add CrewAI / AutoGen / LangGraph deps for v1.
- Do not build full A2A protocol / distributed agent mesh.
- Do not auto-spawn tool loops for every agent in a debate (cost + chaos).
- Do not rename `agentMode` flag in same change (confusing); keep technical name, improve UI labels (“Tools” / “Autonomous tools”).

---

## 4. Comparative options

| Approach | Effort | Risk | UX quality | Cost control |
|----------|--------|------|------------|--------------|
| A. Rename only (no multi) | S | Low | Low vs vision | N/A |
| B. @ tag single agent only | M | Low | Medium | Good |
| C. @ multi sequential roundtable (native) | M–L | Medium | High match | Good with caps |
| D. Concurrent + judge | L | Medium | Fast but less “chat” | Higher |
| E. External framework (CrewAI etc.) | XL | High integration | Variable | Harder |

**Pick C as target; B as intermediate milestone.**

---

## 5. Risks

| Risk | Mitigation |
|------|------------|
| Cost explosion | max agents (3), max rounds (3), max tokens per speaker, kill switch |
| Infinite discussion | hard turn budget; user message always preempts |
| Context window blow-up | compact older multi-agent turns; reuse existing compaction |
| Naming confusion with OpenClaw/Pi | glossary + UI sections “My Agents” vs “Runtimes” |
| Provider without message `name` | content prefix fallback |
| Tool conflicts (two agents write files) | discussion mode = tools off by default |
| Storage migration | dual-read; one-time migrate on load |
| Race with generation cancel | shared abort controller per round |

---

## 6. Implementation recommendations

### Quick start (PoC, ~1–2 days)

1. Add `@` picker (clone SkillPicker).
2. On submit with 2 agents: sequential generate twice into same session with different system prompts + labeled messages.
3. No rename yet — prove orchestration.

### Code touch map (expected)

| Area | Files (indicative) |
|------|-------------------|
| Types | `shared/types.ts`, `shared/types/session.ts` |
| Store | `hooks/useCopilots.ts` → agents, `stores/session/generation.ts`, new orchestrator |
| UI dock | `InputBox/*`, AgentPicker, Message.tsx avatar/name |
| Settings | `routes/settings/copilots.tsx` → agents, Sidebar labels |
| i18n | locales en (+ others as needed) |
| Tests | orchestrator unit tests, InputBox mention parse, migration |

### Common pitfalls

- Replacing system prompt mid-session without preserving history context.
- Running all agents in parallel without rate-limit awareness.
- Using one shared `copilotId` only — blocks multi-speaker attribution.
- Forgetting cancel/abort across multi-step generation.

---

## 7. Resources

- Azure: [AI Agent Orchestration Patterns](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns)
- AutoGen conversation model (group chat / human-in-loop)
- CrewAI process model (for future sequential crews)
- Chaeboxi: `generation.ts` copilot overlays, `SkillPicker` mention UX, Pi plan `plans/260807-1714-pi-sdk-integration/`

---

## Unresolved questions

1. Default when user sends follow-up **without** @: all session agents, last round’s agents, or single primary?
2. Should multi-agent rounds enable **tools** (agentMode) or discussion-only?
3. Max agents / max rounds product defaults?
4. Should “Featured” remote copilots remain community-sourced under Agents?
5. Full type rename now vs UI-only rename + aliases?
6. Conflict with OpenClaw AgentSelector labeling — rename OpenClaw UI to “OpenClaw runtimes”?
