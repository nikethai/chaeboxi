# Plan: New Chat — Multi-Agent Select + Agent Search

**Status:** Implemented (phases 1–3) — verify in app  
**Date:** 2026-08-08  
**Scope:** Blank / new-chat screen (`src/renderer/routes/index.tsx` + related dock pieces)  
**Related:** Team room (`docs/agents-multi-agent-rooms.md`, `MAX_ROOM_AGENTS = 3`)  
**Prior discussion:** Multi-select agents on first paint; selected UI match Image #2; agent search combobox; tags ≠ skills  

---

## 1. Problem

| Area | Today | Pain |
|------|--------|------|
| Agent pick | Horizontal scroller, **single** select | Cannot start a multi-agent room from blank |
| Selected UI | One chip + X + full prompt (good for 1) | Branch hides picker entirely; no multi chips |
| Discovery | Up to 10 chips + arrows | Feels noisy / “unmeaning” on first open |
| Tags | Static `dark-first`, `indigo · solid`, … | Marketing, not skills; confuses first paint |
| Skills | Only `$` in composer | OK — do **not** replace tags with skills |
| Team mode on blank | `InputBox` reads `currentSession` for `sessionId=new` | Often no store session → mode / room strip lag until after create |

**North star:** From blank, user can pick **0–3 agents** via **search**, see **consistent selected chips**, send once → session is already a team room (Discuss/Work) when ≥2.

---

## 2. Locked product decisions

| Decision | Choice |
|----------|--------|
| Multi-select | **Yes**, max `MAX_ROOM_AGENTS` (3) |
| Selected chrome | Same chip DNA as Image #2 (`CopilotItem` selected style) |
| Prompt preview | **Only when exactly 1** agent selected (`line-clamp-5`) |
| Multi (2–3) | Chips + Clear only; **no** multi-prompt walls |
| Primary discovery | **Agent search combobox** (not long scroller) |
| Horizontal scroller | Demote / remove as default; optional “Suggested” ≤5 when search empty |
| Tags | **Not skills.** Soften: keep ≤2 product truths **or** remove strip (recommend **remove** or 2 max: e.g. `local-first` + `desktop`) |
| Skills on blank | **No** dock combobox in this plan — keep `$` / composer |
| Cap | Reuse `MAX_ROOM_AGENTS` from `@shared/types` |
| Order | Selection order = speaker order / lead = first |

### Non-goals

- Skills search combobox on blank (backlog)  
- Changing in-session `@` picker (already multi)  
- Remote-only agent marketplace redesign  
- Auto-select agents on load  

---

## 3. UX specification

### 3.1 Blank dock layout

```text
┌─ blank workbench ──────────────────────────────────┐
│  Pick a thread…          │  Starters (desktop)     │
│  (tags: remove or ≤2)    │                         │
└────────────────────────────────────────────────────┘
┌─ session-dock ─────────────────────────────────────┐
│  AGENTS                    [ Search agents…    ▾ ] │
│  [A selected] [B selected] [C]          [Clear]    │  ← multi chips
│  (if 1 agent: prompt preview line-clamp-5)         │
│  ┌ InputBox ─────────────────────────────────────┐ │
│  │ draft…     [Team mode ▾ if ≥2] [Model] [↑]    │ │
│  └───────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────┘
```

### 3.2 Interactions

| Action | Behavior |
|--------|----------|
| Open search | Dropdown list (fuzzy, reuse `filterAgents` / `fuzzyScoreAgent`) |
| Pick agent | Toggle add if not selected and `len < 3`; toast/disable if at cap |
| Click selected chip / X on chip | Remove that agent |
| Clear | `agentIds = undefined`, `copilotId = undefined`, reset system messages |
| Pick when already 1 | Add second → multi mode; drop prompt preview |
| Deep link `?copilotId=` | Seed `agentIds: [id]` (keep) |
| Submit | Create session with `agentIds` + `copilotId = agentIds[0]`; multi → room path |

### 3.3 Selected UI consistency (Image #2)

- **1 agent:** Keep current: selected chip + global X + prompt text.  
- **2–3 agents:** Row of selected chips (same `selected` styles), each optional mini-X, one “Clear all”.  
- Do **not** switch to a totally different card layout for multi.  
- Picker remains available while selected (search to add more) — avoid exclusive “selected OR picker” unless 0 agents and search collapsed.

### 3.4 System message / persona inject

| Count | `session.messages` |
|-------|---------------------|
| 0 | `initEmptyChatSession().messages` |
| 1 | System message = that agent’s prompt (today) |
| 2+ | **No** bulk multi-prompt system dump. Empty chat system **or** optional short “Team room with A, B, C” note. Per-agent prompts already applied in `generation.ts` for room turns after create. |

Update the `useEffect` that keys only on `selectedCopilot` to key on `agentIds` / resolved list.

---

## 4. Architecture

```text
index.tsx (blank)
  session.agentIds[]  (draft, id='new')
  session.copilotId = agentIds[0]
       │
       ├─ NewChatAgentBar (new component)
       │    search combobox + selected chips + optional suggested
       │
       └─ InputBox
            needs draft agentIds for TeamModeSelect on blank
            → pass prop: draftAgentIds / draftRoomMode
            OR sync draft into uiStore.newSessionState
```

### 4.1 Recommended data path

**Prefer explicit props** on `InputBox` for blank only:

```ts
// InputBox props (optional)
draftAgentIds?: string[]
draftRoomMode?: 'discuss' | 'work'
onDraftRoomModeChange?: (mode) => void
```

When `sessionId === 'new'`, prefer `draftAgentIds` over `useSession('new')` for room strip / Team mode visibility.

On `handleSubmit`, already maps `agentIds` into `createSessionStore` — extend to pass `roomMode` if stored on draft session.

### 4.2 Components

| Component | Role |
|-----------|------|
| **`NewChatAgentBar`** (new) | Search + multi select + selected chips + prompt when 1 |
| **`CopilotItem`** | Keep / rename later to `AgentChip`; selected styles |
| **Remove / gut** | `CopilotPicker` horizontal ScrollArea as primary |
| **`InputBox`** | Accept draft agent ids for Team mode on blank |
| **index.tsx** | Wire multi state; simplify tags |

Reuse `filterAgents` from `AgentPicker.tsx` (extract to `@/packages/agents` if needed to avoid UI import cycles).

### 4.3 Key files

| File | Change |
|------|--------|
| `src/renderer/routes/index.tsx` | Multi state, NewChatAgentBar, tags, submit/roomMode |
| `src/renderer/components/new-chat/NewChatAgentBar.tsx` | **New** primary UI |
| `src/renderer/components/InputBox/InputBox.tsx` | Draft agentIds for Team mode |
| `src/renderer/components/InputBox/AgentPicker.tsx` | Optional export shared filter only |
| `src/shared/types.ts` | Already has `MAX_ROOM_AGENTS` |
| `docs/agents-multi-agent-rooms.md` | Blank multi-select note |
| `en/translation.json` | Search / clear / team of N / cap toast |

---

## 5. Phases

### Phase 0 — Spec freeze (0.25d)

- Confirm tags: **remove** vs **≤2 brand** (default in this plan: **remove** manifesto tags strip).  
- Confirm no skills combobox in this ship.  

### Phase 1 — Multi-select + consistent selected UI (1–2d)

**Goal:** Pick 0–3 agents; Image #2 for 1; chips for multi; submit creates room.

1. State: `session.agentIds` primary; dual-write `copilotId = agentIds[0]`.  
2. Replace exclusive `session.copilotId ? selected : CopilotPicker` with unified bar.  
3. Toggle add/remove; cap 3.  
4. Prompt preview only if `agentIds.length === 1`.  
5. Fix system message effect for 0 / 1 / 2+.  
6. `handleSubmit` already passes `agentIds` — verify multi first message hits `shouldRunMultiAgentRoom`.  
7. Deep link `?copilotId=` still seeds one agent.  

**Acceptance**

- [ ] Select 2 agents on blank → send → session has 2 `agentIds`, discuss runs  
- [ ] Select 1 → same as old prompt inject + single persona  
- [ ] Clear all → empty agents  
- [ ] Cannot select 4th  
- [ ] Selected chips match Image #2 selected style  

### Phase 2 — Agent search combobox (1–2d)

**Goal:** Search-first discovery; kill noisy default scroller.

1. Implement search field + dropdown (Mantine Combobox/Menu/Popover + list).  
2. Fuzzy filter via existing `filterAgents` / `fuzzyScoreAgent`.  
3. Exclude already selected; show checkmarks for selected in list.  
4. “View all agents” → `/settings/agents` (or copilots redirect).  
5. Optional: empty-query **Suggested** row (first 5 my agents) — not full 10-wide scroller.  
6. Remove chevron page ScrollArea as primary UX.  

**Acceptance**

- [ ] Type query filters agents  
- [ ] Keyboard: arrows + enter to pick (parity with @ picker if cheap)  
- [ ] Works with 0 local agents + remote list  
- [ ] Mobile: dropdown usable (full width)  

### Phase 3 — Blank Team mode + tags cleanup (0.5–1d)

1. Pass `draftAgentIds` into `InputBox` so Team mode appears when ≥2 before create.  
2. Persist `roomMode` on draft session → `createSessionStore`.  
3. Tags: remove `blank-tags` strip **or** leave ≤2 if product insists.  
4. i18n + docs.  

**Acceptance**

- [ ] With 2 agents on blank, Team mode dropdown visible next to model  
- [ ] First message respects Discuss vs Work  
- [ ] Tags no longer read as fake skills  

### Phase 4 — Polish + QA (0.5d)

- Focus management after pick  
- Cap feedback (`Max 3 agents`)  
- Accessibility: listbox roles, aria-multiselectable  
- Manual: cold start, deep link, OpenClaw system-message filter still OK  
- Focused tests: pure helpers for toggle/cap if extracted  

**Total:** ~3–5 focused days.

---

## 6. Implementation notes

### Toggle helper (pure, unit-testable)

```ts
function toggleAgentSelection(
  current: string[],
  id: string,
  max = MAX_ROOM_AGENTS
): { next: string[]; rejected?: 'at_cap' } {
  if (current.includes(id)) return { next: current.filter((x) => x !== id) }
  if (current.length >= max) return { next: current, rejected: 'at_cap' }
  return { next: [...current, id] }
}
```

### Submit path check

After create, `submitNewUserMessage` must see `mentionedAgentIds` **or** session `agentIds` ≥2. Today room membership uses message mentions + `applyRoomMembership`. Ensure blank multi without re-@ still runs multi:

- Either copy `agentIds` into first user message as `mentionedAgentIds` on blank submit, **or**  
- Rely on session `agentIds` after create + `shouldRunMultiAgentRoom(undefined, roomAgentIds)`.

**Prefer:** create session with `agentIds` first; `shouldRunMultiAgentRoom` already falls back to room members when mentions empty — verify `messages.ts` uses session after membership apply. (Already: `applyRoomMembership` + `resolveSpeakers(room, mentioned)`.)

### Name / avatar for multi session

- Name: first agent name + “+N” or “Team” / keep first agent name (YAGNI: first agent name).  
- picUrl: first agent.  

---

## 7. Risks

| Risk | Mitigation |
|------|------------|
| System prompt only lead confuses multi | No multi system dump; room protocols own personas |
| InputBox blank no Team mode | Explicit draft props |
| Search lag with large remote list | Cap dropdown 8–12; same as @ picker |
| Users miss multi | Hint under search: “Select up to 3 for a team” |
| Tags removal product pushback | Feature-flag or leave 2 chips |

---

## 8. Test / QA matrix

| # | Scenario | Pass |
|---|----------|------|
| N1 | 0 agents send | Normal chat |
| N2 | 1 agent send | Persona + system prompt |
| N3 | 2 agents Discuss send | Multi discuss, no auto Final |
| N4 | 2 agents Work send | Work pipeline |
| N5 | Cap 3 | 4th blocked |
| N6 | Search filter | Correct subset |
| N7 | `?copilotId=` | Pre-selected one |
| N8 | Clear | Empty selection |
| N9 | showCopilotsInNewSession false | Bar hidden (settings) |
| N10 | Selected UI | Matches Image #2 for 1; chips for multi |

---

## 9. Docs / i18n

- Update `docs/agents-multi-agent-rooms.md`: blank multi-select + search.  
- Strings: `Search agents…`, `Clear agents`, `Up to 3 agents`, `Team of {{n}}`, `View all agents`.  
- Rename user-facing “View All Copilots” → **View all agents** in this surface.

---

## 10. Out of scope / backlog

- Skills search combobox on blank  
- Suggested skill starters  
- Multi-prompt preview accordion  
- Persist last blank agent selection across app restarts  
- LLM-suggested team composition  

---

## 11. Cook order

```text
Phase 1 (multi + selected UI)
  → Phase 2 (search combobox)
  → Phase 3 (Team mode on blank + tags)
  → Phase 4 (QA)
```

Phase 1 alone unblocks first-message multi-agent rooms; Phase 2 fixes discovery clutter.

---

## Unresolved (defaults applied if no override)

1. **Tags:** default **remove** entire manifesto strip.  
2. **Suggested row** when search empty: default **yes**, max 5.  
3. **Skills combobox:** deferred.  
