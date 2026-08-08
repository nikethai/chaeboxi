# Agents & multi-agent rooms

## Overview

**Agents** (formerly Copilots) are persona packages: prompt, avatar, model overrides, tools, and hooks.

Chat sessions can host a **room** of up to **3** agent members. Users `@`-mention agents in the chat dock (same interaction class as `$skills`). With **2+** speakers, Chaeboxi runs a **council hybrid**:

1. Short sequential discussion turns (A ↔ B …)
2. One **Final answer** synthesis from the **lead** (first mentioned / first speaker)

The user can interrupt anytime (new send aborts remaining discussion **and** skips synthesis).

## Glossary

| Term | Meaning |
|------|---------|
| Agent | Persona library entry (`AgentDetail` / legacy `CopilotDetail`) |
| Room | Session with `agentIds[]` members |
| Discussion turn | Short multi-agent reply (`Message.roomRole: 'turn'`) |
| Synthesis | Final full answer (`Message.roomRole: 'synthesis'`) |
| Lead | First speaker in resolved order (first `@` this turn, else room order) |
| Agent mode | Existing tool-loop flag (`session.agentMode`) — single-speaker autonomy |
| Runtime | native / OpenClaw / Pi (multi-agent rooms are **native-only** in v1) |

## Data model

- `Session.agentIds?: string[]` — room members (migrated from `copilotId`)
- `Session.copilotId` — dual-written as `agentIds[0]` for one release
- `Message.agentId` / `Message.name` — speaker attribution
- `Message.mentionedAgentIds` — `@` chips on a user turn
- `Message.roomRole?: 'turn' | 'synthesis'` — multi-agent turn kind

## Caps (v1)

- `MAX_ROOM_AGENTS = 3`
- `MAX_ROOM_ROUNDS = 1` (each tagged agent speaks once, then synthesis)
- `MAX_AGENT_TURNS_PER_USER_MSG = 6`
- Tools **off** in multi-agent room turns (discussion + synthesis)
- Single `@` → one full reply (no self-debate, no synthesis)
- Room multi injects a **user continue** bridge when history ends on assistant (avoids empty Gemini/OpenAI completions)

## UX

- Settings → **Agents** (`/settings/agents`; `/settings/copilots` redirects)
- Composer: `@` chips for **this turn** (not duplicated with room strip); idle room shows “In this chat”
- Assistant bubbles with `agentId` show **avatar (emoji/pic) + name** via `AgentSpeakerHeader` (resolves built-in + local + **remote** catalog — same as `@` picker)
- Multi turns: subtle per-agent accent ring (no auto-collapse)
- Synthesis message: **Final answer** badge; skill chips prefer synthesis only
- When Final answer starts/finishes, chat **auto-scrolls to bottom** (discussion often leaves the viewport mid-list)
- Room turns: **tools/web/KB forced off** (text-only) so personas like Deep Researcher cannot hang in tool loops
- Empty provider responses: one automatic retry, then soft placeholder (not blank shell)

## Parallel vs sequential

v1 is **sequential** (A then B). Parallel fan-out is a different product mode (independent answers + merge) and is **not** the default for conversation/debate.

## Flow

```text
speakers = mentioned || room members
if 0: normal chat
if 1: one assistant message (icon + name), full reply
if 2+:
  for each speaker once (round-robin, 1 round):
    insert assistant { roomRole: turn } → short discussion
    (API history ends with user continue bridge if prior was assistant)
  if not interrupted && ≥1 discussion turn:
    insert assistant { roomRole: synthesis, lead = speakers[0] } → full answer
```

## Implementation map

| Area | Path |
|------|------|
| Pure room helpers | `src/shared/agent-room.ts` |
| Agent meta resolve | `src/renderer/packages/agents/resolve-agent-meta.ts` |
| @ token parse | `src/renderer/packages/agents/` |
| Orchestrator | `src/renderer/stores/session/multi-agent-room.ts` |
| Generation speaker | `src/renderer/stores/session/generation.ts` (`speakerAgentId`, `roomMulti`, `roomRole`) |
| Submit wiring | `src/renderer/stores/session/messages.ts` |
| Speaker UI | `AgentSpeakerHeader`, `Message.tsx` |
| Dock UI | `InputBox`, `AgentPicker`, `AgentRoomStrip` |
