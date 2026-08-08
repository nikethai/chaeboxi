# Agents & multi-agent team rooms

## Overview

**Agents** (formerly Copilots) are persona packages: prompt, avatar, model overrides, tools, and hooks.

Chat sessions can host a **room** of up to **3** agent members. Users `@`-mention agents in the chat dock (same interaction class as `$skills`). With **2+** speakers, Chaeboxi runs a **Team room**:

| Mode | Default | Behavior |
|------|---------|----------|
| **Discuss** | Yes | 2 short sequential rounds (A↔B…), stances (Proposer/Critic/Integrator). **No auto Final.** User may request **Team answer** or **Keep discussing**. |
| **Work** | Opt-in | Plan (all) → **Do** (lead, tools on) → Review (peers) → Deliver (lead). |

The user can interrupt anytime (new send aborts remaining queue).

## Glossary

| Term | Meaning |
|------|---------|
| Agent | Persona library entry (`AgentDetail` / legacy `CopilotDetail`) |
| Room | Session with `agentIds[]` members |
| Discuss turn | Short multi-agent reply (`Message.roomRole: 'turn'`) |
| Team answer | On-demand synthesis (`Message.roomRole: 'synthesis'`) |
| Work phases | `plan` · `do` · `review` · `deliver` |
| Lead | First speaker / first `@` / `session.roomLeadId` |
| Agent mode | Existing tool-loop flag (`session.agentMode`) — required for lead tools in Work |
| Runtime | native / OpenClaw / Pi (team rooms are **native-only** in v1) |

## Data model

- `Session.agentIds?: string[]` — room members (migrated from `copilotId`)
- `Session.roomMode?: 'discuss' | 'work'`
- `Session.roomLeadId?: string` — optional lead override
- `Session.copilotId` — dual-written as `agentIds[0]` for one release
- `Message.agentId` / `Message.name` — speaker attribution
- `Message.mentionedAgentIds` — `@` chips on a user turn
- `Message.roomRole?: 'turn' | 'synthesis' | 'plan' | 'do' | 'review' | 'deliver'`
- `Message.roomRound?: number` — 1-based discuss round

## Caps

- `MAX_ROOM_AGENTS = 3`
- `MAX_ROOM_ROUNDS = 2` (default discuss after each user message)
- `MAX_ROOM_KEEP_DISCUSS_ROUNDS = 3` (with Keep discussing)
- `MAX_AGENT_TURNS_PER_USER_MSG = 6`
- Tools **off** in discuss / plan / review / synthesis
- Tools **on** only for Work **do** / **deliver** (lead; respects agent toolAccess + agentMode)
- Single `@` → one full reply (no multi-room orchestration)
- Room multi injects a **user continue** bridge when history ends on assistant

## UX

- Settings → **Agents** (`/settings/agents`; `/settings/copilots` redirects)
- Composer: `@` chips for room members; **Team mode** compact dropdown next to model select when 2+ agents (Discuss | Work)
- **New chat (blank):** multi-select up to 3 agents via **search combobox** + selected chips (prompt preview only for 1 agent); Team mode available before first send via draft props
- Post-discuss bar: **Team answer** · **Keep discussing** · **Switch to Work**
- Assistant bubbles with `agentId` show **avatar + name** via `AgentSpeakerHeader`
- Discuss/plan/review turns grouped visually as **Team discussion**
- Team answer / Working / Deliverable badges on primary turns
- Room strip live status: “Round 2/2 · Name speaking…”
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

## Implementation map

| Area | Path |
|------|------|
| Pure room helpers | `src/shared/agent-room.ts` |
| Orchestrator | `src/renderer/stores/session/multi-agent-room.ts` |
| Live/actions state | `src/renderer/stores/session/team-room-state.ts` |
| Generation | `src/renderer/stores/session/generation.ts` |
| Submit wiring | `src/renderer/stores/session/messages.ts` |
| Speaker UI | `AgentSpeakerHeader`, `Message.tsx`, `MessageList.tsx` |
| Actions bar | `TeamRoomActions.tsx` |
| Dock UI | `InputBox`, `AgentPicker`, `AgentRoomStrip` |
