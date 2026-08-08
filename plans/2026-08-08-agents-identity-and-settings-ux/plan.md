# Plan: Agents Identity, Config Quality, Avatars & Settings UX

**Status:** Implemented (phases 1–5)  
**Date:** 2026-08-08  
**Research:** `plans/2026-08-08-agents-identity-and-settings-ux/research/agents-identity-config-and-settings-ux.md`  
**Related:** `docs/agents-multi-agent-rooms.md`, `docs/design-guidelines.md`, multi-agent rooms already shipped

---

## 1. Goal

Make Chaeboxi agents feel like an **owned product cast**, not generic defaults:

1. **Producty built-in cast** with strong personas, tool presets, and room stances  
2. **Unique avatars** — procedural default + **AI avatar generate** in v1 + upload  
3. **Studio-quality Settings → Agents** gallery + progressive editor  
4. **Same identity resolver** for built-in, custom, community, and OpenClaw agents  

**Success feel:** Settings shows distinct emblems and names; thread speaker headers look intentional; AI-generated avatars feel on-brand when requested.

---

## 2. Locked product decisions

| Decision | Choice |
|----------|--------|
| Cast naming | **Producty** — Scout, Forge, Quill, Prism, Atlas (ids stay stable) |
| Avatar default | Deterministic **procedural SVG** from `id` + `avatarSeed` + role glyph |
| AI avatar generate | **Yes, v1** — user-initiated only; store as `avatarKey` blob |
| Upload | Keep (PNG/JPEG → blob) |
| Letter fallback | **Banned** for any agent with a stable id (use procedural instead) |
| Featured remote | Relabel **Community agents**, secondary section below My Agents + Chaeboxi cast |
| OpenClaw agents | **Same** `resolveAgentAvatar()` — hash remote id → procedural; optional local override map later |
| Schema | Extend `CopilotDetail` with optional fields only |
| UI stack | Mantine + Tailwind + design tokens only on this surface (remove MUI from agents settings) |
| Frameworks | None — no new multi-agent runtime |
| Chrome style | Dark studio per design-guidelines — no purple wash gradients on UI chrome |

### Built-in cast map

| Stable id | Display name | Role | Stance default | Tool preset (summary) |
|-----------|--------------|------|----------------|------------------------|
| `builtin:deep-researcher` | **Scout** | research | proposer | web_search, parse_link |
| `builtin:code-assistant` | **Forge** | code | lead | file_read, file_write (+ agentMode tools) |
| `builtin:writing-editor` | **Quill** | writing | critic | light / denylist heavy tools |
| `builtin:data-analyst` | **Prism** | data | integrator | none default |
| `builtin:task-planner` | **Atlas** | planning | integrator | task_create/update/list/get |

Ids unchanged so storage/starred/overrides keep working. i18n keys for new display names. Description line: e.g. "Deep Researcher · evidence-first research".

---

## 3. Non-goals

- CrewAI / AutoGen / LangGraph  
- Photoreal human faces as **default** (AI gen may produce illustrative style; prompt for emblem/illustration not selfie)  
- Server CDN dependency for built-in avatars  
- AgentOps (evals, versioning, marketplace publish)  
- OpenClaw gateway agent CRUD rewrite  
- Changing multi-agent room orchestrator caps/protocol (unless avatar-only touch)  

---

## 4. Architecture

```text
                    ┌─────────────────────────────┐
                    │   AgentDetail / CopilotDetail│
                    │  id, name, role, stance,     │
                    │  voice, description, prompt,  │
                    │  avatarSeed, avatarKey,      │
                    │  picUrl, emojiAvatar (legacy)│
                    └─────────────┬───────────────┘
                                  │
                    resolveAgentAvatar(id | detail)
                                  │
          ┌───────────────────────┼───────────────────────┐
          ▼                       ▼                       ▼
   avatarKey blob           picUrl (legacy)      procedural SVG
   (upload / AI gen)                             (id+seed+role)
                                  │
                                  ▼
        Settings cards · Speaker header · Room strip · Pickers · OpenClaw list
```

### AI avatar flow

```text
User taps "Generate avatar"
  → require paint-capable model (settings / session default)
  → build prompt: agent name + role + voice + "flat studio emblem, no text, indigo-friendly palette"
  → generateImage(...)
  → persist blob via platform storage / picture key
  → set avatarKey; clear emoji priority for display
  → loading + error + retry UI
```

If no paint model: disable button with helper text linking to provider settings.

### OpenClaw

- Gateway agents have id/name/description/capabilities only.  
- Display avatar: `resolveAgentAvatar({ id: openclaw:${agentId} })` procedural.  
- Optional later: `openclawAvatarOverrides[agentId]` in local store (out of scope unless cheap).

---

## 5. Data model changes

Extend `CopilotDetail` in `src/shared/types.ts` (all optional):

```ts
description?: string
role?: 'research' | 'code' | 'writing' | 'data' | 'planning' | 'custom' | string
stance?: 'proposer' | 'critic' | 'integrator' | 'lead' | 'neutral'
voice?: string
avatarSeed?: string
avatarKey?: string   // local blob / StorageKeyGenerator.picture
tags?: string[]
```

**Resolve order for display image:**  
`avatarKey` → `picUrl` → procedural(id, avatarSeed ?? id, role) → legacy emoji only if no procedural path → **never** single-letter for known ids.

**Prompt composition (generation):**  
system = base persona prompt + optional voice/stance room line (existing room protocol stays).

Migration: `mergeBuiltInCopilots` continues; user overrides win; new fields default from built-in when missing.

---

## 6. Files to create / modify

| Action | Path |
|--------|------|
| Extend types | `src/shared/types.ts` |
| Built-in cast + prompts + presets | `src/renderer/hooks/useCopilots.ts` |
| Procedural avatar + resolve | `src/renderer/packages/agents/agent-avatar.ts` (+ `.test.ts`) |
| Meta + avatar | `src/renderer/packages/agents/resolve-agent-meta.ts`, `index.ts` |
| Speaker chrome | `src/renderer/components/chat/AgentSpeakerHeader.tsx` |
| Room / pickers / new chat | `AgentRoomStrip`, `AgentPicker`, `NewChatAgentBar` as needed |
| OpenClaw list | `src/renderer/openclaw/components/AgentSelector.tsx` |
| Settings page | `src/renderer/routes/settings/agents.tsx` |
| New UI modules | `src/renderer/components/settings/agents/` — `AgentsSettingsPage`, `AgentCard`, `AgentEditor`, `AgentAvatarStudio`, `AgentCommunitySection` |
| Retire monolith | `src/renderer/routes/copilots.tsx` → thin redirect/re-export then delete dead form |
| AI gen wiring | reuse `packages/model-calls/generate-image.ts` + blob storage patterns from session avatar |
| Docs | `docs/agents-multi-agent-rooms.md` identity section |
| Plan mirror | `plans/2026-08-08-agents-identity-and-settings-ux/plan.md` keep in sync |

---

## 7. Phases

### Phase 0 — Prep (no product ambiguity left)

- [x] Cast names producty  
- [x] AI gen in v1  
- [x] Community demotion  
- [x] OpenClaw same resolver  
- Sync repo plan file with these locks  
- Optional: quick HTML mock of gallery (nice-to-have, not blocking)

### Phase 1 — Avatar system + resolver

**Goal:** Every agent with an id gets a unique non-letter avatar offline.

1. Implement `proceduralAgentAvatar(id, { seed?, role? })` → SVG data-URI  
   - Hash → hue from fixed studio-safe palette (indigo-adjacent, not purple wash)  
   - Role glyph set: research / code / writing / data / planning / custom / openclaw  
   - 1px outline for light/dark  
2. `resolveAgentAvatar(detail | id)` with full order  
3. Wire: `AgentSpeakerHeader`, room strip, agent pickers, settings (when present)  
4. OpenClaw `AgentSelector` uses resolver  
5. Unit tests: determinism, uniqueness across ids, role glyph changes  

**Acceptance:** Built-ins and OpenClaw agents never show bare letter circles; 20px + 48px readable.

### Phase 2 — Config quality (cast + schema)

**Goal:** Catalog feels specialized for single chat and team rooms.

1. Add optional fields to `CopilotDetail`  
2. Rewrite 5 built-in prompts (role contract, process, output, anti-patterns, room collab)  
3. Set description, role, stance, voice, tags, toolAccess presets, avatarSeed  
4. Display names: Scout / Forge / Quill / Prism / Atlas (+ i18n)  
5. Subtitle keeps former role for discoverability ("Deep research")  

**Acceptance:** Card shows name + one-line description; multi-agent discuss feels different per speaker without code changes to orchestrator.

### Phase 3 — Settings gallery + editor UX

**Goal:** Manage agents without form fatigue; match studio redesign.

1. Split into components under `components/settings/agents/`  
2. **Gallery:** search, star filter, built-in badge, avatar, name, description, Edit / Use  
3. **Editor sections:** Identity | Persona | Model (collapsed) | Tools (presets + advanced) | Hooks (advanced)  
4. Preferences: Show Agents in New Session  
5. **My Agents** (built-in + custom) primary; **Community** secondary (remote)  
6. Design: design-guidelines tokens, shadows over hard borders, radius 9/11, scale 0.96 press, ≥44px targets, no MUI  
7. A11y: labels, focus, keyboard, aria on icon buttons  

**Acceptance:** Create/edit/star/delete/use; no MUI on agents settings path; dark mode contrast OK.

### Phase 4 — Avatar studio (upload + AI generate)

**Goal:** Users own unique images in v1.

1. Large live preview in editor  
2. Upload → blob → `avatarKey`  
3. Shuffle → new `avatarSeed` (procedural)  
4. **Generate with AI** → paint model → blob → `avatarKey`  
5. Clear / revert to procedural  
6. Loading, error, disabled-without-model states  
7. Illustration-style prompt template (flat emblem / character mark, not photo)  

**Acceptance:** Generated and uploaded avatars survive restart; show in thread header; revert works.

### Phase 5 — Polish, docs, verify

1. i18n for new strings  
2. Update agents multi-agent docs (identity + glossary cast names)  
3. Focused unit tests + manual checklist  
4. `pnpm check` / lint on touched files  
5. Visual pass: gallery, editor, speaker header, OpenClaw menu  

---

## 8. Design direction (skills applied)

| Source | Apply |
|--------|--------|
| design-guidelines | Dark-first, indigo `#5b63d4`, no chrome gradients, tight radius, Satoshi |
| make-interfaces-feel-better | Concentric radius, layered shadows, 0.96 press, hit targets, stagger cards lightly |
| ui-ux-pro-max | SVG not emoji icons, progressive disclosure, one primary CTA, empty/error states |
| high-end-visual-design | Premium hierarchy only — **not** landing double-bezel / py-24 inside Settings |

**Anti-patterns to kill:** letter avatars, emoji as catalog icons, MUI grey form panels, click-row-only-to-start-chat without edit affordance.

---

## 9. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Rename confusion (Deep Researcher → Scout) | Description/subtitle + stable ids; i18n old key aliases if needed |
| AI gen cost / bad art | User-initiated; illustration prompt; retry; fallback procedural |
| No paint model | Disable with clear CTA to configure image model |
| Procedural looks toy-like | Tight palette; review 20/32/48px; built-in seeds hand-tuned |
| Community still ugly | Procedural seed from remote id; secondary section |
| Scope creep | Orchestrator untouched; OpenClaw CRUD out |

---

## 10. Validation

- Unit: avatar determinism, merge built-ins, resolve order, OpenClaw id seed  
- Manual: Settings gallery/editor; generate/upload/shuffle/revert; multi-agent room headers; OpenClaw menu; new chat agent bar  
- A11y: keyboard edit flow, contrast  
- Regression: custom agents, starred, `copilotId` dual-write, remote community list  

---

## 11. Effort

| Phase | Estimate |
|-------|----------|
| 1 Avatar system | 1–1.5d |
| 2 Config quality | 1d |
| 3 Settings UX | 2–2.5d |
| 4 Avatar studio + AI gen | 1–1.5d |
| 5 Polish | 0.5d |
| **Total** | **~6–7 focused days** |

---

## 12. Implementation order after approval

1. Phase 1 (avatar foundation — unblocks all surfaces)  
2. Phase 2 (cast + schema)  
3. Phase 3 (settings UX)  
4. Phase 4 (AI gen + upload studio)  
5. Phase 5 (docs/tests)  

Mirror this plan into `plans/2026-08-08-agents-identity-and-settings-ux/plan.md` on implement start.

---

## 13. Acceptance criteria (release)

- [ ] Built-ins named Scout, Forge, Quill, Prism, Atlas with strong prompts and tool presets  
- [ ] No letter-only avatars for built-in, custom, community, or OpenClaw agents  
- [ ] Procedural avatars unique per id; optional AI generate + upload work and persist  
- [ ] Settings → Agents is gallery + progressive editor, Mantine/Tailwind, on design tokens  
- [ ] Community section secondary; My Agents primary  
- [ ] Thread speaker headers and OpenClaw selector use shared avatar resolver  
- [ ] Tests for avatar + merge; typecheck clean on touched code  

---

## Unresolved questions

None blocking. Optional polish later: per-OpenClaw avatar overrides store; hand-crafted static SVG pack for 5 built-ins instead of pure procedural.
