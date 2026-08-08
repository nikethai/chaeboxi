# Plan: Team Room — Discussion + Work Together

**Status:** Implemented (phases 1–3) — verify in app  
**Date:** 2026-08-08  
**Source feedback (enduser + QA):**
1. “Nhìn nó multiturn vay” — looks like rigid multi-turn handoff, not real collab  
2. “Nó có tranh luận được khum” — debate depth is weak  

**Owner answers:**
1. Feedback from **enduser and QA**  
2. Goal: **not** “multiple turn” monologues — **more discussion + do tasks together**  
3. Want **best product recommendation** on Final answer / flow  

**Related:**
- Ship doc: `docs/agents-multi-agent-rooms.md`
- v1 plan: `plans/260807-1830-agents-multi-agent-chat/`
- Code: `src/shared/agent-room.ts`, `src/renderer/stores/session/multi-agent-room.ts`, `generation.ts`

---

## 1. Problem (honest)

| What users see | What system does | Gap |
|----------------|------------------|-----|
| Named multi bubbles | `MAX_ROOM_ROUNDS = 1` then auto **Final answer** | Looks multi-turn; is **one pass + report** |
| “Can they debate?” | Soft “disagree when useful” only | No rebuttal round, no stance |
| “Work together?” | `roomMulti` **forces tools off** | Cannot co-do tasks |
| Slack room metaphor | Council hybrid always synthesizes | Feels like generated multi-speaker FAQ, not a team |

Original product plan wanted **2 rounds** + optional continue; ship cut to **1 round + always synthesis**. That maximized “demo multi-agent” and minimized cost, but failed the social/team bar endusers expect.

---

## 2. Product north star

**Metaphor shift**

| Old (v1 ship) | New (v2 target) |
|---------------|-----------------|
| Council panel → auto Final answer | **Team room**: peers discuss, then act |
| Sequential monologues | Short discussion that **builds / rebuts** |
| Tools always off | Tools for **lead during work**; discuss stays light |
| Always dump synthesis | **On-demand team answer** + work deliverable |

**Success feel**

1. User `@` 2–3 agents on a question → they **talk to each other** (not three essays).  
2. User asks to build/fix something → team **plans briefly, one lead executes with tools, peers review**.  
3. Thread does **not** feel like rigid multi-turn karaoke; discussion is grouped; deliverable is primary.  
4. User can jump in anytime (interrupt unchanged).

**Non-goals (v2)**

- AutoGen / CrewAI / LangGraph  
- Unbounded free debate  
- All agents tool-running in parallel (cost + race chaos)  
- Multi-runtime rooms (OpenClaw + native mix)  
- LLM “manager” speaker pick (defer)

---

## 3. Locked recommendations (best defaults)

### 3.1 Two intents, one room

| Mode | When | Behavior |
|------|------|----------|
| **Discuss** | Default multi-`@` / question-ish | 2 rounds short discussion; **no auto Final** |
| **Work** | Explicit “Work together” or user has Agent mode + multi-agent | Plan discuss (1 short round) → **Lead tools on** → peer review → lead patch/deliver |

Composer: mode chip **Discuss | Work** (default Discuss). Session remembers last mode.

### 3.2 Final answer policy (answer to Q3)

**Recommendation: on-demand synthesis (best), not auto Final.**

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| Always auto Final (today) | Guaranteed “answer” | Kills discussion feel; fake multiturn report | Reject as default |
| Never synthesize | Pure Slack | User left to dig thread | Reject alone |
| **On-demand “Team answer”** | User control; discussion real; cost only when needed | Extra click | **Default Discuss** |
| Auto Final only in Work | Deliverable is the point | Different semantics | **Work mode deliverable = lead output after review**, not a separate essay |

**Discuss flow end state**

```text
[Round 1] A → B (→ C)
[Round 2] A → B (rebut / refine)   // max 2 rounds default
→ sticky bar: [Team answer] [Keep discussing] [Switch to Work]
```

- **Team answer** = today’s synthesis (lead = first speaker / first `@`).  
- **Keep discussing** = +1 round (cap total rounds ≤ 3).  
- User message anytime = interrupt + new cycle.

**Work flow end state**

```text
[Plan] short sequential takes (tools off)
[Do]   lead agent tools ON (existing agentMode path)
[Review] peers short critique (tools off)
[Deliver] lead final message (tools optional if needs fix)
```

No separate “Final answer” badge spam unless user hits Team answer in Discuss.

### 3.3 Debate / tranh luận

- Default **2 rounds** (`MAX_ROOM_ROUNDS = 2` for Discuss).  
- Round ≥2 protocol: must **agree / disagree / extend** prior claims; no pure restate.  
- Optional stance inject by order: first = Proposer, second = Critic, third = Integrator (label in UI, not only system prompt).  
- Still max 3 agents; max turns ≤ 6 per user message (Discuss).

### 3.4 “Do task together” (tools)

**Lead + collaborators** only (KISS):

| Role | Who | Tools | Job |
|------|-----|-------|-----|
| Lead | First `@` or user-picked | ON (if model supports; respect agent toolAccess) | Execute plan, produce artifact |
| Collaborators | Other room members | OFF | Plan, challenge, review |

Hard rules:
- Only **one** tool-using speaker at a time.  
- Discuss mode: tools **still off**.  
- Work mode: tools only on **lead Do / Deliver** turns.  
- Cap tool steps via existing `maxSteps` / agent settings.

### 3.5 UX: stop looking like “multiturn karaoke”

Goal: discussion looks like a **team huddle**, not N full assistant essays.

| Change | Detail |
|--------|--------|
| **Discussion group** | Wrap consecutive `roomRole: turn` in a collapsible **Team discussion** block (default expanded while live, collapsed-after with summary “2 agents · 4 turns”) |
| **Compact turns** | Slightly tighter bubbles inside group; keep avatar+name; de-emphasize vs user / deliverable |
| **Room strip live** | “A speaking…” / “Round 2/2” on `AgentRoomStrip` |
| **Primary message** | Team answer / Work deliverable full-width open prose (current assistant style) |
| **No auto Final** | Removes the “report after karaoke” smell |
| **Copy** | Avoid “Final answer” as default; use **Team answer** / **Deliverable** |

Design must follow `docs/design-guidelines.md` (dark studio, no AI-slop gradients, quiet tools UI).

---

## 4. Architecture

```text
InputBox: @agents + mode chip (Discuss | Work)
        │
        ▼
messages.submit
  speakers = mention || room (≥2 → team path)
        │
        ├─ Discuss orchestrator
        │    rounds=2, tools off
        │    queue turns → optional Team answer on user action
        │
        └─ Work orchestrator
             plan turns (tools off)
             lead generate (tools on, roomMulti partial)
             review turns (tools off)
             lead deliver (tools optional)
        │
        ▼
generation.ts
  roomPhase: 'discuss' | 'plan' | 'do' | 'review' | 'deliver' | 'team_answer'
  tools: off except do/deliver
  protocols: agent-room.ts pure helpers
        │
        ▼
Message UI
  DiscussionGroup (turns)
  TeamAnswer / Deliverable (primary)
  AgentRoomStrip (status)
```

### 4.1 Data model (additive)

```ts
// Session (optional persistence)
roomMode?: 'discuss' | 'work'     // last mode
roomLeadId?: string               // override first-@ lead

// Message
roomRole?: 'turn' | 'synthesis' | 'plan' | 'do' | 'review' | 'deliver'
roomRound?: number                // 1-based discuss round
// existing: agentId, name, mentionedAgentIds
```

Keep Zod `.optional().catch(undefined)` for migration safety.

### 4.2 Constants

| Constant | Discuss | Work |
|----------|---------|------|
| Agents | ≤3 | ≤3 |
| Rounds | 2 default, Keep discussing → max 3 | Plan = 1 pass |
| Turns / user msg | ≤6 | plan(N) + do(1) + review(N-1) + deliver(1) ≤ ~8 soft cap |
| Tools | off | lead do/deliver only |

### 4.3 Key files

| Area | Path | Change |
|------|------|--------|
| Caps / types | `src/shared/types.ts`, `types/session.ts` | rounds, modes, roomRole expand |
| Pure protocols | `src/shared/agent-room.ts` + tests | debate protocol, work roles, no auto synth helper |
| Orchestrator | `src/renderer/stores/session/multi-agent-room.ts` | discuss vs work runners; Team answer action |
| Generation | `src/renderer/stores/session/generation.ts` | tools allow on do/deliver; phase protocols |
| Submit | `src/renderer/stores/session/messages.ts` | wire mode |
| Composer | `InputBox/*` | Discuss/Work chip |
| Message UI | `Message.tsx`, new `TeamDiscussionGroup.tsx` | group + compact |
| Room strip | `AgentRoomStrip` | live round/speaker |
| Docs | `docs/agents-multi-agent-rooms.md` | rewrite v2 contract |
| i18n | locales | Team answer, Work together, Round n |

---

## 5. Phases

### Phase 0 — Product lock + acceptance scripts (0.5d)

**Outcome:** Written acceptance scenarios (below) approved.  
**No code** beyond docs in plan reports if needed.

### Phase 1 — Real discussion (no fake multiturn) (2–3d)

**Goal:** Fix “tranh luận” + stop auto-report feel.

1. `MAX_ROOM_ROUNDS = 2` for Discuss path.  
2. Remove auto synthesis from happy path; add `requestTeamAnswer(sessionId)`.  
3. Strengthen discuss protocol (rebut / stance by order).  
4. Sticky post-discussion actions: Team answer / Keep discussing.  
5. Unit tests: queue 2 agents × 2 rounds; `shouldRunSynthesis` only when user requests.  
6. Docs update for Discuss behavior.

**Acceptance**
- [ ] 2 agents produce 4 discuss turns, **no** automatic Final  
- [ ] Round-2 content references round-1 (spot check prompts / fixture)  
- [ ] Team answer produces lead synthesis once  
- [ ] Keep discussing adds one more round up to cap  
- [ ] Interrupt still aborts remaining queue  
- [ ] Single `@` path unchanged  

### Phase 2 — Team discussion UX (2–3d)

**Goal:** “Doesn’t look like multiturn karaoke.”

1. `TeamDiscussionGroup` collapses consecutive turns after complete.  
2. Live “Round x/y · Name speaking” on strip.  
3. Rename Final answer → **Team answer** in UI/i18n.  
4. Compact turn styling inside group; primary answer full prose.  
5. Manual UX pass vs design-guidelines.

**Acceptance**
- [ ] Completed discussion shows as one group with summary  
- [ ] Streaming still readable (group expanded while generating)  
- [ ] Team answer visually primary  
- [ ] No layout regression for single-agent messages  

### Phase 3 — Work together (3–5d)

**Goal:** Shared task execution.

1. Composer mode chip Discuss | Work.  
2. Work orchestrator: plan → do (tools) → review → deliver.  
3. `generation.ts`: `roomMulti` no longer blanket tools-off; gate by phase.  
4. Lead resolution: first mention / `roomLeadId` / room strip picker.  
5. Tests: tools off in plan/review; tools on in do; one lead only.  
6. Safety: abort, maxSteps, existing tool UI quiet style.

**Acceptance**
- [ ] Work mode: lead can call tools; peers cannot in same cycle  
- [ ] Plan + review are short and attributed  
- [ ] Deliverable is lead’s last work message (or explicit deliver turn)  
- [ ] Discuss mode still tools-off  
- [ ] Cost/time acceptable for 2-agent work smoke test  

### Phase 4 — Hardening + QA (1–2d)

1. Empty/retry behavior preserved.  
2. Rate-limit / cost telemetry notes if existing hooks.  
3. Enduser scripts + QA checklist.  
4. Changelog / docs final.  
5. Focused vitest + `pnpm check` on touched types.

**Acceptance**
- [ ] Original feedback scenarios pass (see §6)  
- [ ] No regression: 0-agent, 1-agent, skills, agentMode solo  
- [ ] Types + unit tests green  

**Total estimate:** ~8–13 focused days (phased ship: Phase 1 can ship alone).

---

## 6. Acceptance scenarios (enduser + QA)

| # | Persona | Scenario | Pass criteria |
|---|---------|----------|---------------|
| S1 | Enduser | `@A @B` “Should we use X or Y?” | Real back-and-forth (2 rounds); no auto Final; Team answer optional |
| S2 | Enduser | Follow-up without `@` | Room continues in same mode |
| S3 | Enduser | “Build a checklist for launch” + Work | Plan → tools do → review → usable deliverable |
| S4 | QA | Interrupt mid-round | Queue stops; no orphan synthesis |
| S5 | QA | 3 agents Discuss | Cap respected; rounds × speakers ≤ max turns |
| S6 | QA | Single agent | Identical to pre-v2 persona reply |
| S7 | QA | Tools in Discuss | No tool calls |
| S8 | QA | Tools in Work | Only lead do/deliver |
| S9 | QA | Collapse UX | Discussion group summary accurate |
| S10 | Enduser | Debate quality | Critic disagrees or steelmans; not pure echo (manual rubric) |

---

## 7. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Cost 2–3× single chat | Caps; on-demand Team answer; short discuss protocol |
| Polite model echo | Stance roles + round-2 must-rebut rules |
| Tools hang in multi | One lead; existing maxSteps; tools UI + cancel |
| UX clutter | Group collapse; primary deliverable |
| Scope creep (manager LLM, parallel tools) | Explicit non-goals |
| Plan/docs drift (again) | Phase 0 acceptance; update `docs/agents-multi-agent-rooms.md` in same PR as behavior |

---

## 8. Decision log

| Decision | Choice | Why |
|----------|--------|-----|
| Default mode | **Discuss** | Safer, cheaper, matches “tranh luận” feedback |
| Auto Final | **Off** | Best for discussion feel; user asks Team answer |
| Work tools | **Lead only** | Real collab without multi-agent tool races |
| Rounds | **2 default / 3 max** | Real debate without unbounded loop |
| Frameworks | **None** | Extend thin orchestrator |
| Ship split | **Phase 1 first** | Fastest user-visible fix for QA/enduser |

---

## 9. Implementation order (cook)

```text
Phase 1 (discuss depth + no auto Final)
  → Phase 2 (grouping UX)
  → Phase 3 (Work + tools for lead)
  → Phase 4 (QA harden)
```

Phase 1 alone already answers both original feedback lines if paired with copy. Phase 2 + 3 deliver the “not multiturn / work together” north star.

---

## 10. Out of scope / later backlog

- LLM picks next speaker  
- Parallel “ask all” fan-out mode  
- Multi-lead tools  
- OpenClaw/Pi multi-agent rooms  
- Consensus auto-stop  
- Per-agent debate style settings  

---

## 11. Next actions after plan approval

1. Confirm Phase 1 ship-alone OK (recommended).  
2. Optional: quick half-day PoC on rounds=2 + no auto Final before full Phase 2 UI.  
3. Cook Phase 1 with tests + doc update.  
4. QA run S1–S10; iterate protocol wording if echo persists.

---

## Unresolved (only if you want to override defaults)

None blocking if recommendations in §3 are accepted. Optional overrides:

- Default mode Work for power users? (not recommended)  
- Auto Team answer when discussion is short (e.g. all turns &lt; N tokens)? (nice later)  
- Lead picker always visible vs first-`@` only?
