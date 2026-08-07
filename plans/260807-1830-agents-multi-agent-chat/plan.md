# Plan: Agents as Slack-Style Multi-Agent Chat Rooms

**Status:** Implemented (phases 1–5) — verify in app  
**Date:** 2026-08-07  
**Product metaphor:** Session = Slack channel · Agents = room members · User = peer who can interrupt  
**Research:** [research/agents-multi-agent-research.md](./research/agents-multi-agent-research.md)  
**Related (do not block):** `plans/260807-1714-pi-sdk-integration/`

---

## 1. Goal

1. Rebrand **Copilots → Agents** in product UX.
2. **@-mention** agents in the chat dock (like `$skills`).
3. **2+ agents** discuss in a shared thread with short conversational turns.
4. **User joins anytime** — interrupt, reply, re-@, keep the room going.

**Success feel:** Tag agents, watch them talk like coworkers in a channel, jump in yourself.

---

## 2. Locked product decisions

| Decision | Choice |
|----------|--------|
| Model | **Slack room** (not council report) |
| Follow-up without `@` | Room members (`session.agentIds`) continue |
| First multi-`@` | Invite/add to room membership |
| Turns | Short Slack-like; sequential v1 |
| Auto depth | **2 rounds** after user message |
| Caps | **Max 3 agents**, **max 6 turns** per user msg |
| Tools in multi room | **Off** (discussion-only) |
| Interrupt | New send aborts queue |
| Rename | UI + aliases first; storage dual-read |
| Featured | Keep under Agents |
| Frameworks | None — thin orchestrator on `generation.ts` |
| Runtimes | Native-only multi-agent v1 |

### Glossary

| Term | Meaning |
|------|---------|
| Agent | Persona (was Copilot) |
| Room | Session with 0–N agent members |
| Member | id in `session.agentIds` |
| @ mention | Invite into turn + room |
| Agent mode | Existing tool-loop (`session.agentMode`) |
| Runtime | native / OpenClaw / Pi |

---

## 3. Non-goals (v1)

- CrewAI / AutoGen / LangGraph  
- Multi-runtime rooms  
- Unbounded debate / parallel essay dumps as default  
- All agents with tools  
- Magentic ledgers  
- Bare “Agents” label for OpenClaw (use qualified name)

**Later:** Ask all, Pipeline, LLM speaker pick, Keep discussing button, driver-with-tools.

---

## 4. Architecture

```text
InputBox @picker + chips
  → room membership (agentIds, cap 3)
  → multi-agent room orchestrator
      speakers = mentioned || room
      0 → normal · 1 → single persona · 2+ → sequential rounds
  → generation.ts per speaker (tools off if multi)
  → Message { agentId, name, avatar }
```

**ROOM_PROTOCOL:** short group-chat replies; speak only as self; user may interrupt; no speaking for others.

**Constants:** `MAX_ROOM_AGENTS=3`, `MAX_ROOM_ROUNDS=2`, `MAX_AGENT_TURNS_PER_USER_MSG=6`, tools off in multi.

---

## 5. Data model

```ts
// Session
agentIds?: string[]          // migrate from copilotId
// Message
agentId?: string
mentionedAgentIds?: string[] // on user msgs (like skillIds)
// Types
type AgentDetail = CopilotDetail  // alias during rename
```

Storage: keep `MyCopilots` key v1; dual-write `copilotId = agentIds[0]` one release.

---

## 6. Phases

| Phase | Name | Effort | Outcome |
|-------|------|--------|---------|
| 0 | PoC (optional) | 0.5–1d | Dual sequential speakers |
| 1 | Rename + migration | 1–2d | Agents UI; copilotId→agentIds |
| 2 | @ single | 2–3d | AgentPicker + chips + 1-agent path |
| 3 | Room orchestrator | 3–5d | Multi sequential + interrupt |
| 4 | Message/room UI | 2–3d | Avatars, member strip, typing |
| 5 | Tests/docs | 1–2d | Caps, migration, regression |

**Total:** ~2–3 weeks focused.

### Cook order

1 → 2 → 3 → 4 → 5 (0 optional before 3)

---

## 7. Key files

| Area | Paths |
|------|--------|
| Types | `src/shared/types.ts`, `session.ts` |
| Library | `hooks/useCopilots.ts` → agents alias |
| Orchestrator | **new** `stores/session/multi-agent-room.ts` |
| Generation | `stores/session/generation.ts` |
| Dock | `InputBox/*`, **new** `AgentPicker.tsx` |
| UI | `Message.tsx`, `MessageList.tsx` |
| Settings | copilots routes → agents + redirects |
| i18n | locales (en min) |

---

## 8. Ship-ready acceptance

- [ ] Settings/nav = Agents; legacy redirects  
- [ ] `@` picker + chips in dock  
- [ ] 1 agent ≈ current copilot  
- [ ] 2–3 agents discuss as named speakers  
- [ ] Room persists; no-@ follow-up continues room  
- [ ] Interrupt + Stop work; caps + tools-off  
- [ ] Old copilot data loads; single/no-agent unbroken  
- [ ] Focused tests + types clean  

---

## 9. Risks

Cost (caps), context bloat (short replies + compaction), OpenClaw name collision (qualified labels), interrupt races (one AbortController).

---

## 10. Next

Implement Phase 1 (rename + session migration), then 2–5 with verification per phase.
