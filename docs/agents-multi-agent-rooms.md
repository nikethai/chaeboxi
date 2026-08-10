# Agents & multi-agent team rooms

## Overview

**Agents** (formerly Copilots) are persona packages: prompt, avatar, model overrides, tools, and hooks.

Chat sessions can host a **room** of up to **3** agent members. Users `@`-mention agents in the chat dock (same interaction class as `$skills`). With **2+** speakers, Chaeboxi runs a **Team room**:

| Mode | Default | Behavior |
|------|---------|----------|
| **Discuss** | Yes | 2 short sequential rounds (A↔B…), stances (Proposer/Critic/Integrator). **No auto Final.** User may request **Team answer** or **Keep discussing**. |
| **Work** | Opt-in | Plan (all) → **Do** (lead, tools on) → Review (peers) → Deliver (lead). Fixed pipeline; one lead does the work. |
| **Swarm** | Opt-in | Lead **orchestrator** creates a **task board**, **auto-assigns** owners, executes **sequentially**, then delivers. Multi-owner checklist. Uses more tokens. |

The user can interrupt anytime (new send aborts remaining queue).

## Glossary

| Term | Meaning |
|------|---------|
| Agent | Persona library entry (`AgentDetail` / legacy `CopilotDetail`) |
| Room | Session with `agentIds[]` members |
| Discuss turn | Short multi-agent reply (`Message.roomRole: 'turn'`) |
| Team answer | On-demand synthesis (`Message.roomRole: 'synthesis'`) |
| Work phases | `plan` · `do` · `review` · `deliver` |
| Swarm | Lead plan (task tools) → `assignTasks` → assignee `do` per task → lead `deliver` |
| Lead | First speaker / first `@` / `session.roomLeadId` |
| Agent mode | Existing tool-loop flag (`session.agentMode`) — required for tools on Work/Swarm **do** / **deliver** |
| Runtime | native / OpenClaw / Pi (team rooms are **native-only** in v1) |

## Data model

- `Session.agentIds?: string[]` — room members (migrated from `copilotId`)
- `Session.roomMode?: 'discuss' | 'work' | 'swarm'`
- `Session.roomLeadId?: string` — optional lead override
- `Session.copilotId` — dual-written as `agentIds[0]` for one release
- `Message.agentId` / `Message.name` — speaker attribution
- `Message.mentionedAgentIds` — `@` chips on a user turn
- `Message.roomRole?: 'turn' | 'synthesis' | 'plan' | 'do' | 'review' | 'deliver'`
- `Message.roomRound?: number` — 1-based discuss round
- Session tasks (`taskStore`): `assigneeAgentId?`, `dependsOn?`, `createdBy?` for Swarm multi-owner board

## Caps

- `MAX_ROOM_AGENTS = 3`
- `MAX_ROOM_ROUNDS = 2` (default discuss after each user message)
- `MAX_ROOM_KEEP_DISCUSS_ROUNDS = 3` (with Keep discussing)
- `MAX_AGENT_TURNS_PER_USER_MSG = 6` (discuss)
- `MAX_SWARM_TASKS = 12`, `MAX_SWARM_TURNS = 15` (plan + tasks + deliver)
- Tools **off** in discuss / Work plan / review / synthesis
- Tools **on** for Work/Swarm **do** / **deliver** (assignee; respects agent toolAccess + agentMode)
- Swarm **plan**: **task tools only** (`create_task` / `update_task` / `list_tasks`)
- Single `@` → one full reply (no multi-room orchestration)
- Room multi injects a **user continue** bridge when history ends on assistant

## UX

- Settings → **Agents** (`/settings/agents`; `/settings/copilots` redirects)
- Composer: `@` chips for room members; **Team mode** compact dropdown next to model select when 2+ agents (Discuss | Work | **Swarm**)
- **New chat (blank):** multi-select up to 3 agents via **search combobox** + selected chips (prompt preview only for 1 agent); Team mode available before first send via draft props
- Post-discuss bar: **Team answer** · **Keep discussing** · **Switch to Work**
- Assistant bubbles with `agentId` show **avatar + name** via `AgentSpeakerHeader`
- Discuss/plan/review turns grouped visually as **Team discussion**
- Team answer / Working / Deliverable badges on primary turns
- Room strip live status: “Round 2/2 · Name speaking…” or “Swarm · Task 2/5 · Name working…”
- Task progress dock shows assignee when set
- Empty provider responses: one automatic retry, then soft placeholder

## Flow

### Discuss

```text
speakers = mentioned || room members
if 0: normal chat
if 1: one assistant message, full reply
if 2+:
  for round 1..2:
    for each speaker: insert assistant { roomRole: turn, roomRound } → short discussion
  → show Team answer / Keep discussing (no auto synthesis)
```

### Work

```text
plan: each speaker once (tools off)
do: lead (tools on if agentMode)
review: peers (tools off)
deliver: lead (tools optional)
```

### Swarm

```text
lead plan (task tools only) → create_task × N
  soft retry once if board empty; optional JSON fallback from plan prose
assignTasks (rule-based: explicit → name/tag match → least-loaded → lead)
for each ready task (deps done, sequential):
  assignee do (tools if agentMode); update status done/failed
  failed task: continue remaining ready (do not abort whole run)
lead deliver
interrupt: new user message aborts remaining queue
```

## Implementation map

| Area | Path |
|------|------|
| Pure room helpers | `src/shared/agent-room.ts` (`RoomMode`, `assignTasks`, swarm protocols) |
| Caps | `src/shared/types.ts` (`MAX_SWARM_TASKS=12`, `MAX_SWARM_TURNS=15`) |
| Swarm plan parse | `src/shared/swarm-plan.ts` |
| Swarm loop | `src/renderer/stores/session/multi-agent-room-swarm.ts` (`runAgentRoomSwarm`) |
| Room entry / modes | `src/renderer/stores/session/multi-agent-room.ts` (dispatches discuss/work/swarm) |
| Live/actions state | `src/renderer/stores/session/team-room-state.ts` |
| Task board | `src/renderer/stores/taskStore.ts` |
| Generation | `src/renderer/stores/session/generation.ts` |
| Submit wiring | `src/renderer/stores/session/messages.ts` |
| Speaker UI | `AgentSpeakerHeader`, `Message.tsx`, `MessageList.tsx` |
| Actions bar | `TeamRoomActions.tsx` |
| Dock UI | `InputBox`, `TeamModeSelect`, `AgentPicker`, `AgentRoomStrip` |

## Related agent tools

When Work/Swarm **do** / **deliver** enable tools (and `agentMode` is on), agents can call the full tool surface for the session—including media tools:

- **`read_video_url`** — public YouTube / Vimeo / TikTok / Facebook links (metadata + transcript). See [video-url-reader.md](./video-url-reader.md).
- **`read_video`** — local uploaded `FILE_KEY` frame sample (not remote URLs).

Configure Video URL in **Settings → Video URL**.
