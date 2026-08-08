# Research Report: Agents Identity, Config Quality & Settings UX

**Date:** 2026-08-08  
**Scope:** Why Chaeboxi agents feel default; unique self-owned avatars; agents settings management UX redesign  
**Sources:** Chaeboxi codebase, design-guidelines.md, prior multi-agent research, industry persona/agent UX (2025–2026)

---

## Executive Summary

Chaeboxi agents (ex-copilots) are **functionally rich** (prompt, model overrides, tools, hooks, maxSteps, multi-agent rooms) but **identity-poor**: built-in personas are generic role labels with emoji avatars; remote “Featured” agents often collapse to **letter avatars on purple gradients**; settings UI is a **1,000+ line MUI+Mantine hybrid form** that fights the rest of the app’s dark studio redesign.

Industry consensus (2025–2026): multi-agent value comes from **clear role boundaries + distinct character signals**, not more agents. Letter avatars and “Claude Code / Review / Explore / Plan” clones read as template defaults — exactly the anti-pattern in Chaeboxi’s own design contract (“no letter avatars as brand”).

**Recommendation:** Ship a three-track upgrade without new frameworks:

1. **Persona config upgrade** — structured agent profile (role, stance, voice, tools preset) + stronger built-in prompts  
2. **Owned avatar system** — deterministic procedural SVG portraits per agent id (no network, unique, on-brand); optional LLM image gen / upload as override  
3. **Settings UX rebuild** — card gallery + progressive editor aligned to design tokens (Mantine/Tailwind only; drop MUI in this surface)

---

## Research Methodology

- Codebase: `useCopilots.ts`, `copilots.tsx`, `types.ts` CopilotDetail, `resolve-agent-meta.ts`, `AgentSpeakerHeader`, multi-agent docs  
- Design: `docs/design-guidelines.md`, UI redesign plan  
- Prior research: `plans/260807-1830-agents-multi-agent-chat/research/`  
- External: AI persona design guides 2025–2026, multi-agent specialization patterns, arxiv persona GenAI review  

**Key search themes:** multi-agent persona design, unique agent identity UX, avatar generation without stock defaults

---

## Key Findings

### 1. Current architecture (what exists)

| Layer | Reality |
|-------|---------|
| Data model | `CopilotDetail` / `AgentDetail`: id, name, emojiAvatar, picUrl, prompt, modelSettings, maxSteps, toolAccess, hooks |
| Built-ins (5) | Deep Researcher, Code Assistant, Writing Editor, Data Analyst, Task Planner — emoji only, short generic prompts |
| Storage | jotai `myCopilotsAtom` + merge built-ins; remote Featured via API |
| Settings UI | `routes/settings/agents.tsx` → `CopilotsContent` in `routes/copilots.tsx` (~1072 lines) |
| Runtime use | generation overlays persona; multi-agent rooms use `resolveAgentMeta` for name/avatar |
| Avatar fallback | emoji → picUrl → **first letter** of name (`AgentSpeakerHeader`) |

### 2. Why agents feel “default”

1. **Naming** — role nouns only (“Code Assistant”), no product-owned cast identity  
2. **Visual sameness** — emoji (platform-inconsistent) or letter-on-gradient (screenshot class); design guidelines ban letter avatars as brand  
3. **Prompt thinness** — 1 paragraph + “default style”; missing stance, output contract, anti-patterns, room collaboration rules  
4. **No differentiation for team rooms** — multi-agent docs assign Proposer/Critic/Integrator at runtime, but catalog personas don’t declare preferred stance  
5. **Featured/remote** — third-party catalog (often Claude-style agent teams) reinforces “not ours” feel  
6. **Settings chrome lag** — grey MUI boxes, hard borders, mixed component libraries vs studio redesign

### 3. Industry / research signals

- Multi-agent systems need **coordinated but non-colliding characters** (role + tone per agent)  
- Prefer **attribute-specific + role-play** prompt structure for control  
- Multi-agent only when specialization is real; otherwise single agent  
- Character libraries + persistent visual identity beat one-off stock avatars  
- Chaeboxi already chose **Slack-style room**, max 3 agents — identity must work at **20–28px** in thread chrome  

### 4. Avatar generation options (evaluation)

| Approach | Unique | Offline | Cost | Brand control | Fit |
|----------|--------|---------|------|---------------|-----|
| Emoji only | Low | Yes | 0 | Low | Current — weak |
| Letter + gradient | Low | Yes | 0 | Low | **Banned** by design contract |
| Remote URL | Medium | No | Low | Low | Brittle |
| **Procedural SVG from agent id + role seed** | High | Yes | 0 | High | **Recommended default** |
| User upload (blob storage) | High | Local | 0 | User | Keep |
| LLM / ComfyUI image gen | High | Depends | High | Medium | Optional “Generate” action |

**Recommended default:** deterministic geometric / emblem portraits (hash → palette from fixed Chaeboxi accents + role glyph). Ship as data-URI or static assets under `src/renderer/assets/agent-avatars/`. Optional “Generate with model” uses existing `generateImage` path and stores blob key.

### 5. Settings UX problems (audit)

| Issue | Evidence | Design skill conflict |
|-------|----------|----------------------|
| Dual UI kits | MUI Avatar/Box/TextField + Mantine Button/Switch | Inconsistent elevation |
| Flat list of thin rows | MiniItem height 49px, name only | Poor hierarchy / no prompt preview |
| Long vertical form | Model / Agent / Tools / Hooks stacked | No progressive disclosure |
| Avatar = text fields | Emoji + URL only | No preview, no generate, no upload |
| Hard borders / grey panels | MUI grey[50]/700 | Shadows > borders; studio tokens |
| Click card = start chat | Conflicts with manage | Separate primary vs secondary actions |
| No search/filter | Scales poorly | UX baseline |
| Remote Featured mixed | Looks third-party | Need “Chaeboxi cast” vs “Community” |

### 6. Design system alignment (locked)

From `docs/design-guidelines.md`:

- Dark-first, indigo accent `#5b63d4`, **no gradients on chrome**  
- Radius 7/9/11 (not over-round)  
- Satoshi + JetBrains Mono  
- Shadows over hard borders for surfaces  
- **No letter avatars as brand**  
- No emoji as structural icons (ui-ux-pro-max also: SVG not emoji)

**Implication:** Built-in agent avatars must not be emoji or letter circles. Prefer monochrome/indigo emblem illustrations.

---

## Comparative Analysis

| Product pattern | Chaeboxi today | Target |
|-----------------|----------------|--------|
| Custom GPT store cards | Featured remote list | Owned cast + optional community |
| Claude Code agent teams (letter avatars) | Similar fallback risk | Distinct emblems |
| CrewAI role definitions | Tools/hooks exist | Named roles + stance presets |
| Slack member list | Room strip weak identity | Avatar + name + role chip |

---

## Implementation Recommendations

### Config schema (minimal extension — YAGNI)

Keep `CopilotDetail`. Add optional fields only:

```ts
// proposed optional fields
description?: string          // one-line card blurb
role?: string                 // e.g. researcher | coder | editor | analyst | planner | custom
stance?: 'proposer' | 'critic' | 'integrator' | 'lead' | 'neutral'
voice?: string                // short style line for UI + prompt injection
avatarKey?: string            // local blob / storage key
avatarSeed?: string           // procedural seed (default = id)
tags?: string[]
```

Prompts stay in `prompt`; UI can compose preview from description + voice.

### Built-in cast (rename + deepen)

| Id | Display name | Role | Stance default | Tool preset |
|----|--------------|------|----------------|-------------|
| builtin:deep-researcher | **Scout** | research | proposer | web_search, parse_link |
| builtin:code-assistant | **Forge** | code | lead | file_*, terminal-related via agentMode |
| builtin:writing-editor | **Editor** | writing | critic | none / light |
| builtin:data-analyst | **Prism** | data | integrator | none |
| builtin:task-planner | **Atlas** | planning | integrator | task_* |

Product names are suggestions — final cast naming is a product decision. Keep i18n keys.

### Avatar pipeline

1. `agentAvatarUri(id, role?, seed?)` → deterministic SVG data URI  
2. Resolve order: `avatarKey` blob → `picUrl` → procedural → never bare letter  
3. Settings: large preview, upload, regenerate seed, optional AI generate  
4. Bundle 5 built-in SVG assets for instant first paint  

### Settings UX structure

```
Settings → Agents
├── Preferences (show on new session)
├── Search + filter chips (My / Built-in / Community)
├── Card grid (avatar, name, description, tags, star)
│     primary: Edit · secondary: Use in chat
└── Editor (drawer or full panel)
      ├── Identity (name, description, avatar studio)
      ├── Persona (prompt + voice + stance)
      ├── Model (collapsed advanced)
      ├── Tools (preset chips + advanced allowlist)
      └── Hooks (advanced, collapsed)
```

Motion: stagger card enter 30–50ms; scale press 0.96; shadows not heavy borders; 44px targets.

---

## Common Pitfalls

- Generating photoreal faces → uncanny, inconsistent at 20px  
- Infinite AI avatar regen on every open → cost + flicker  
- Renaming built-ins without migration of starred/overrides  
- Gradients on chrome (violates design contract) — use flat indigo + texture in SVG only  
- Putting plan IDs in code comments  

---

## Resources

- `docs/agents-multi-agent-rooms.md`  
- `docs/design-guidelines.md`  
- `src/renderer/hooks/useCopilots.ts`  
- `src/renderer/routes/copilots.tsx`  
- Prior: `plans/260807-1830-agents-multi-agent-chat/`  

## Unresolved questions

1. Cast naming: product-y (Scout/Forge) vs descriptive (Deep Researcher)?  
2. Ship offline procedural only first, or also wire AI image generate in v1?  
3. Keep Chatbox remote Featured catalog, rebrand section, or hide behind flag?  
4. Should OpenClaw gateway agents get same avatar resolver (hash of remote id)?  

---

**Report status:** complete for planning  
**Next:** plan.md phases  
