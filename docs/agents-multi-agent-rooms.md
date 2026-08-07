# Agents & multi-agent rooms

## Overview

**Agents** (formerly Copilots) are persona packages: prompt, avatar, model overrides, tools, and hooks.

Chat sessions can host a **Slack-style room** of up to **3** agent members. Users `@`-mention agents in the chat dock (same interaction class as `$skills`). With **2+** speakers, Chaeboxi runs a sequential multi-agent discussion in the shared thread. The user can interrupt anytime.

## Glossary

| Term | Meaning |
|------|---------|
| Agent | Persona library entry (`AgentDetail` / legacy `CopilotDetail`) |
| Room | Session with `agentIds[]` members |
| Agent mode | Existing tool-loop flag (`session.agentMode`) — single-speaker autonomy |
| Runtime | native / OpenClaw / Pi (multi-agent rooms are **native-only** in v1) |

## Data model

- `Session.agentIds?: string[]` — room members (migrated from `copilotId`)
- `Session.copilotId` — dual-written as `agentIds[0]` for one release
- `Message.agentId` / `Message.name` — speaker attribution
- `Message.mentionedAgentIds` — `@` chips on a user turn

## Caps (v1)

- `MAX_ROOM_AGENTS = 3`
- `MAX_ROOM_ROUNDS = 2`
- `MAX_AGENT_TURNS_PER_USER_MSG = 6`
- Tools **off** in multi-agent room turns

## UX

- Settings → **Agents** (`/settings/agents`; `/settings/copilots` redirects)
- Composer: `@` opens AgentPicker; chips; room member strip “In this chat”
- Assistant bubbles show speaker name when `agentId` is set

## Implementation map

| Area | Path |
|------|------|
| Pure room helpers | `src/shared/agent-room.ts` |
| @ token parse | `src/renderer/packages/agents/` |
| Orchestrator | `src/renderer/stores/session/multi-agent-room.ts` |
| Generation speaker | `src/renderer/stores/session/generation.ts` (`speakerAgentId`, `roomMulti`) |
| Submit wiring | `src/renderer/stores/session/messages.ts` |
| Dock UI | `InputBox`, `AgentPicker`, `AgentRoomStrip` |
