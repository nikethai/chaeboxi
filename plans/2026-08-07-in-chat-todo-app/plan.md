# Plan: In-Chat Todo App Surface

**Status:** Proposed (architecture + design)  
**Date:** 2026-08-07  
**Branch context:** `main` (post `feat/agent-skills`)  
**Goal:** Ship a task-list todo that appears in chat as an interactive “app widget” (ChatGPT Apps / Claude Task UI class), not only as generic tool steps + dock panel.

## TL;DR

| Layer | Today | Ship target |
|---|---|---|
| Model tools | `create_task` / `update_task` / `list_tasks` already always-on | Keep; tighten prompts + optional batch write |
| State | In-memory `taskStore` (lost on reload) | Session-scoped + persisted |
| UI | Dock `TaskProgress` + generic `ToolCallPartUI` | **Inline Todo App card** in message + refined live dock |
| UX feel | Utility checklist | Product “mini-app” with polish micro-interactions |

**Do not rebuild.** Elevate existing task system into an in-chat app surface.

## Product intent

When the model plans multi-step work (or user asks for a checklist), show a **rich interactive todo UI inside the conversation** — same mental model as:

- Claude Code Task tools / TodoWrite progress UI
- ChatGPT Apps interactive widgets in-thread
- Cursor / agent sticky plans

User should:

1. **See** the list appear as an app card in chat (not buried in tool JSON).
2. **Watch** items move `pending → in-progress → done` live while the agent works.
3. **Interact** (toggle done, collapse, copy) without leaving chat.
4. **Reopen** the session later and still see the list.

## Architecture analysis

### Current system (verified in repo)

```
Model (tool use)
  → create_task / update_task / list_tasks
      (src/renderer/packages/model-calls/toolsets/task-tracking.ts)
  → taskStore (Zustand, no persist)
      (src/renderer/stores/taskStore.ts)
  → TaskProgress dock above composer
      (src/renderer/components/TaskProgress/TaskProgress.tsx)
  → tool-call parts still render as quiet timeline steps
      (ToolCallPartUI — no special-case for task tools)
```

Also related:

- `MessagePlanPart` + `PlanApproval` — human-in-the-loop plan gate (different concern: approve/reject plan text).
- Design contract: dark-first, tight radii (7/9/11), quiet tools UI (`docs/design-guidelines.md`).

### Gaps vs “app in chat”

1. **No dedicated in-message app card** — task tools look like any other tool.
2. **No persistence** — reload clears todos.
3. **No user write-back** — list is agent-only.
4. **No coalescing** — N `create_task` calls = N tool steps; noisy for a list of 8.
5. **Dock is weak product surface** — functional, not “mini app”.
6. **No prompt policy** — model not strongly steered when to open/update list.

### Boundaries (Systems Designer)

| Component | Owns | Does not own |
|---|---|---|
| `task-tracking` tools | Mutations + list for model | Rendering |
| `taskStore` | Live session task state | Message history text |
| `TodoAppCard` (new) | In-chat interactive UI + micro-interactions | Tool execution |
| `TaskProgress` (upgrade) | Sticky live strip when scroll leaves card | Full history of past lists |
| `Message` / `ToolCallPartUI` | Routing task tools → app surface vs quiet step | Business rules |
| Session storage | Persist tasks per `sessionId` | Cross-session project todos (v2) |

### Data flow (target)

```
┌─────────────┐   tool call    ┌──────────────┐   set/patch   ┌────────────┐
│ Model       │ ─────────────► │ task tools   │ ────────────► │ taskStore  │
└─────────────┘                └──────────────┘               └─────┬──────┘
                                                                      │
                         subscribe + render                           │
        ┌──────────────────────────┬──────────────────────────────────┤
        ▼                          ▼                                  ▼
┌───────────────┐         ┌────────────────┐                 ┌────────────────┐
│ TodoAppCard   │         │ TaskProgress   │                 │ Session persist│
│ (inline msg)  │         │ (sticky dock)  │                 │ (reload-safe)  │
└───────┬───────┘         └───────┬────────┘                 └────────────────┘
        │ user toggle             │
        └──────────► taskStore.updateTask ──► (optional) status event for next turn
```

### Decision: dual surface (recommended)

| Surface | Role | When visible |
|---|---|---|
| **A. Inline Todo App card** | “App appeared in chat” moment; primary product beat | First create / major rewrite; stays in message history as living or snapshot |
| **B. Sticky dock strip** | Always-current progress while generating / scrolled away | `tasks.length > 0` for session |

Avoid third surface (sidebar todo page) for v1 — YAGNI.

### Alternatives considered

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| Only upgrade `TaskProgress` dock | Smallest diff | Not “in chat like an app” | Insufficient |
| New `MessageTodoPart` content type | Clean schema | Migration + dual path with tool-calls | Phase 2 if needed |
| Special-case task tool results in `ToolCallPartUI` | Reuses parts; no schema change | Need coalesce logic | **v1 default** |
| Full ChatGPT-style apps platform | Future-proof | Overkill for one widget | Out of scope |

**v1:** Coalesce task tool-calls into one `TodoAppCard` renderer driven by `taskStore` (live), with optional snapshot of ids in tool result for historical messages.

## Design recommendations

### Product design contract (locked)

Respect `docs/design-guidelines.md` over generic “agency landing” aesthetics:

- Dark-first: void / rail / panel / lift
- Accent solid indigo `#5b63d4` — **no purple gradient chrome**
- Radius **7 / 9 / 11** (not 2rem pills on chat chrome)
- Tools: quiet; attention only for fail / running
- Content width: `--chatbox-col`

High-end polish is applied **inside** that system (haptics, nested surfaces, motion), not by replacing tokens.

### Vibe + layout (for the card only)

- **Vibe:** Soft Structuralism on Chaeboxi panels (quiet lift, no neon)
- **Layout:** Compact vertical checklist (not bento / not marketing hero)
- **Archetype name:** “Studio Checklist App”

### Visual system (Todo App card)

```
┌─ outer shell (p-1, ring hairline, radius 11) ─────────────┐
│ ┌─ inner core (bg panel/lift, radius 9, inset highlight) ┐ │
│ │  eyebrow: TASKS · 3/8 · mono meta                      │ │
│ │  ─────────────────────────────────────────────────     │ │
│ │  ○  Research existing taskStore          pending       │ │
│ │  ◐  Build TodoAppCard                    in progress   │ │
│ │  ●  Wire ToolCallPartUI                  done (strike) │ │
│ │  ─ progress hairline (tabular-nums 37%) ─              │ │
│ └────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

**make-interfaces-feel-better checklist (apply on implement):**

| Principle | Spec |
|---|---|
| Concentric radius | Outer 11 + pad 4 → inner ~9 |
| Shadows over hard borders | Layered soft shadow; hairline ring only |
| Tabular nums | `3/8`, `%` progress |
| Scale on press | Checkbox / row hit `active:scale-[0.96]` |
| Icon animation | Check: opacity 0→1, scale 0.25→1, blur 4→0; spring bounce 0 |
| Stagger enter | Rows delay ~80–100ms |
| Exit subtle | Done row: soft dim + line-through, not layout collapse jump |
| Hit area | ≥40×40 on checkbox |
| No `transition: all` | Only `transform, opacity, color, background-color` |
| Skip load thrash | `initial={false}` if using AnimatePresence for rehydrate |

**Motion (GPU-safe):** only `transform` + `opacity`. Custom ease `cubic-bezier(0.2, 0, 0, 1)` or project `--chatbox-ease`. No blur on scrolling thread content.

### Interaction model

1. **Agent-driven (primary):** model creates/updates via tools → card updates live.
2. **User toggle (v1 optional but recommended):** click checkbox → `updateTask` → store; next model turn sees updated `list_tasks` / store snapshot in tools.
3. **Collapse:** header collapses body; dock still shows count.
4. **Dedup noise:** when `TodoAppCard` shown, hide raw `create_task`/`update_task` steps or collapse them into one “Updated tasks” quiet chip.

### States

| State | UI |
|---|---|
| Empty | Card not mounted |
| Creating first item | Card mounts with stagger; 1 row skeleton optional |
| Streaming multi-step | Active row spinner; progress animates |
| All done | Soft success tint on meta (not loud confetti) |
| Failed item | Error tint + optional retry affordance later |
| Historical message | Live store if same session ids still exist; else frozen snapshot from tool result |

## Technology guidance

| Choice | Rationale |
|---|---|
| Keep AI SDK `tool()` task set | Already wired in `stream-text.ts` for all tool-capable models |
| Zustand `taskStore` + immer | Exists; add persist layer only |
| Persist | Session storage key e.g. `session:{id}:tasks` via existing `StoreStorage` / session metadata — **prefer attach to session record** if cheap |
| UI | React + existing CSS tokens in `globals.css` (`.agent-panel*` family) + Tailwind; avoid new MUI `sx` sprawl |
| Special render path | `ToolCallPartUI` branch OR small `message-parts/TodoAppCard.tsx` |
| i18n | Extend keys for Tasks / status labels |
| Tests | Expand `taskStore.test.ts`; unit card status map; tool execute tests |

**Prompt policy (KISS):** strengthen toolset description:

- Use tasks for ≥3 step work or explicit checklist requests
- Keep ≤1 item `in-progress` at a time
- Mark done immediately when finished (no batch-at-end)
- Prefer `update_task` over recreate

Optional later: single `write_todos` full-rewrite tool (TodoWrite-style) for weak models that struggle with multi-call create.

## Implementation strategy (phased)

### Phase 0 — Align & spike (0.5–1d)

- Confirm product: dual surface A+B vs dock-only.
- Spike: special-case `create_task`/`update_task` in message render → one card bound to store.
- Manual QA: tool-capable model, multi-step prompt.

**Exit:** screenshot of inline card updating live.

### Phase 1 — Data correctness (1d)

- Persist tasks per session; hydrate on session open; clear on session delete.
- Harden tools: missing id, empty title, concurrent updates, sessionId injection (already partial).
- Ensure `list_tasks` always reflects store (model recovery after compaction).

**Exit:** reload keeps list; unit tests green.

### Phase 2 — Inline Todo App card (1.5–2d)

- New `TodoAppCard` component (design system above).
- Coalesce consecutive task tool parts in a message into one app surface.
- Quiet/hide redundant tool steps when card present.
- Wire live store subscription + snapshot fallback.
- a11y: list role, checkbox labels, keyboard toggle.

**Exit:** feels like an in-chat mini-app; design-guidelines compliant.

### Phase 3 — Dock polish (0.5–1d)

- Restyle `TaskProgress` to match card DNA (same tokens, denser).
- Collapse to chip `Tasks 3/8` when thread scrolled / generating.
- Click chip → expand / scroll to latest card.

**Exit:** sticky progress never loses context.

### Phase 4 — User interaction + prompt (0.5–1d)

- User can toggle complete / reopen pending.
- Optional: “Add item” on card (writes store; model discovers via `list_tasks` next turn).
- Tighten system instructions in `task-tracking.ts`.
- i18n + empty/error copy.

**Exit:** user steers list without typing “mark X done”.

### Phase 5 — Hardening & ship (0.5–1d)

- Mobile hit targets, reduced-motion, Android tree-shake (`isAgentEnabled` pattern already).
- Tests: store persist, tool schema, card render states.
- Docs: short user note in `docs/` or skills-adjacent help.
- Feature flag if risk-averse (`utils/feature-flags.ts`).

**Acceptance criteria**

- [ ] Multi-step agent turn creates visible in-chat todo app (not only dock).
- [ ] Status transitions animate without layout thrash.
- [ ] Reload session restores tasks.
- [ ] Generic tool noise reduced for task tools.
- [ ] Matches dark studio chrome next to `mock-dark-shell.html`.
- [ ] No Android bundle regression from agent panels pattern.
- [ ] Focused tests pass (`pnpm test -- taskStore` + related).

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Model spams create/update | Cap list size (e.g. 20); coalesce UI; prompt “≤1 in-progress” |
| Double UI (card + every tool step) | Explicit hide/coalesce rule in `Message.tsx` / ToolCallPartUI |
| Ephemeral loss (already a bug) | Phase 1 persist mandatory before polish |
| Design drift to “AI SaaS glassmorphism” | Enforce design-guidelines tokens in review |
| Conflicts with PlanApproval | Plan = approve plan text; Todo = execute checklist. Keep separate. |
| Context cost of list_tasks | Only inject tools when model supports tool use (already); store not in every prompt |

## Out of scope (v1)

- Cross-session / project-level todo board
- Dependencies (`blockedBy`), owners, multi-agent shared lists
- Full “Apps SDK” platform for arbitrary widgets
- Calendar / due dates / notifications
- Drag-reorder (nice; phase 2+)

## File map (expected touch)

| Path | Change |
|---|---|
| `packages/model-calls/toolsets/task-tracking.ts` | Prompt policy; maybe batch tool |
| `stores/taskStore.ts` | Persist / hydrate / delete |
| `components/message-parts/TodoAppCard.tsx` | **New** |
| `components/message-parts/ToolCallPartUI.tsx` | Route task tools → app / quiet |
| `components/chat/Message.tsx` | Coalesce / mount card |
| `components/TaskProgress/*` | Visual + chip collapse |
| `static/globals.css` | `.todo-app*` tokens under agent/panel family |
| `packages/tools/index.ts` | Names already present |
| `stores/taskStore.test.ts` + new tests | Coverage |
| `docs/` short note | Optional user/dev note |

## Effort estimate

**~4–6 focused eng days** for polished v1 (phases 0–5).  
Spike-only MVP (inline card, no persist): **~1–1.5d** — not shippable.

## Next actions

1. **Decide:** dual surface A+B (recommended) vs dock-only polish.
2. **Decide:** user toggle in v1? (recommended yes).
3. **Decide:** persist on session record vs standalone storage key.
4. Approve plan → implement via `/cook` starting Phase 0–1.
5. Optional: design mock HTML in `plans/2026-08-07-in-chat-todo-app/mock-todo-app.html` before React.

## Unresolved questions

1. Should historical messages freeze the list at that moment, or always show **live** session state in every past card?
2. Should todos clear when starting a **new thread** inside the same session?
3. Agent mode only vs **all tool-capable chats** (tools already always-on today)?
4. Want batch `write_todos` tool for weaker models in v1 or later?

## Research references

- Claude Agent SDK todo / Task tools: create/update/list lifecycle, migrate from TodoWrite full-rewrite to granular TaskCreate/TaskUpdate.  
  https://code.claude.com/docs/en/agent-sdk/todo-tracking
- ChatGPT Apps: interactive widgets **inside** conversation (not redirect).  
  Industry pattern for “app in chat”.
- Repo existing pieces: `task-tracking.ts`, `taskStore.ts`, `TaskProgress.tsx`, `PlanApproval.tsx`, `docs/design-guidelines.md`.
