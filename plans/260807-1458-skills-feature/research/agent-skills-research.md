# Research Report: Agent Skills for Chaeboxi

**Date:** 2026-08-07  
**Scope:** How to ship Skills (like Claude/Cursor ecosystem) in Chaeboxi — auto-select by AI + multi-skill user tagging  
**Principles:** YAGNI, KISS, DRY

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Research Methodology](#research-methodology)
3. [Key Findings](#key-findings)
4. [Comparative Analysis](#comparative-analysis)
5. [Chaeboxi Fit Analysis](#chaeboxi-fit-analysis)
6. [Implementation Recommendations](#implementation-recommendations)
7. [Resources & References](#resources--references)
8. [Unresolved Questions](#unresolved-questions)

---

## Executive Summary

**Skills** are not “another prompt preset.” Industry standard (Agent Skills / `SKILL.md`, open at [agentskills.io](https://agentskills.io/specification)) is:

- A **folder** with `SKILL.md` (YAML frontmatter + markdown body)
- Optional `scripts/`, `references/`, `assets/`
- **Progressive disclosure**: always inject only `name` + `description` (~50–100 tokens each); load full body only when activated

Two activation modes users want (and competitors ship):

1. **Auto-select (model-driven):** model sees skill catalog in system prompt; decides which skill(s) match the user turn
2. **User tag / multi-skill (explicit):** user mentions `@skill-name` or `/skill-name` (or chips) → force-load those skills into context for that turn / session

**Brutal truth for Chaeboxi:** You already have three half-overlapping systems — **Copilots** (session persona + model/tool hooks), **System Prompt Presets**, **Prompt Presets**. Skills should be a **new first-class layer**, not a rename of Copilot. Copilot = “who I am this chat.” Skill = “how to do this task when relevant.” MCP tools = “what I can call.”

**Recommendation:** Adopt **Agent Skills open standard** for portability + community skills. Ship in phases: (1) local skill store + progressive inject + multi-tag UI, (2) model auto-select via catalog + load tool or host-side resolve, (3) import/export + optional scripts later. Do **not** start with skill marketplaces, auto-install from web, or full bash script runners on day one.

---

## Research Methodology

- Sources consulted: ~12 web sources + Chaeboxi codebase scout
- Date range: Oct 2025 – Aug 2026 (Agent Skills launched ~Oct 2025; open standard Dec 18, 2025)
- Key search terms: Agent Skills, SKILL.md, progressive disclosure, multi-skill tagging, Claude Code skills, agentskills.io specification

---

## Key Findings

### 1. Technology Overview — What a Skill Is

| Concept | Definition |
|--------|------------|
| Skill package | Directory: `skill-name/SKILL.md` + optional supporting files |
| Required frontmatter | `name` (kebab-case, ≤64), `description` (≤1024, **what + when**) |
| Optional fields | `license`, `compatibility`, `metadata`, `allowed-tools` (experimental) |
| Progressive levels | L1 metadata always · L2 full SKILL.md on activate · L3 references/scripts on demand |
| Relation to tools | Skills teach *procedure*; MCP/tools provide *capabilities* |

Open standard location: https://agentskills.io/specification

### 2. Current State & Trends (2026)

- Anthropic published Skills as open standard; multi-tool ecosystem (Claude Code, Codex, Cursor, Gemini CLI, OpenCode, etc.)
- Progressive disclosure is the consensus architecture for scaling skill libraries without context bloat
- Custom commands often **merged into skills** (Claude Code: `/skill-name` + auto-invoke)
- Market: 1000+ community skills catalogs (e.g. awesome-agent-skills) — portability is a product advantage
- Security is real: skills can instruct model to exfiltrate data or run unsafe code; trusted-source + audit required

### 3. Best Practices

1. **Descriptions are the router.** Bad description = skill never auto-fires. Include triggers/keywords.
2. **Keep SKILL.md body lean** (<500 lines / ~5k tokens recommended); push detail to `references/`.
3. **Composability:** multiple skills can activate on one turn (user request: multi-tag).
4. **Separate ambient rules from skills.** Always-on = system prompt / project rules. On-demand = skills.
5. **Deterministic code > token generation** for pure transforms (scripts later phase).
6. **User override beats auto.** Explicit tags always win; auto is default assistance.
7. **Show activation in UI** (chips / “used skills”) so user trusts and debugs routing.

### 4. Security Considerations

| Risk | Mitigation |
|------|------------|
| Malicious skill instructions (prompt injection / data exfil) | Import only trusted sources; show full markdown before enable; no auto-run remote code v1 |
| Over-privileged tools via `allowed-tools` | Map to existing Chaeboxi tool risk-engine + approval gates |
| Skill steals context of other skills | Isolate injected blocks; clear skill boundaries in system prompt |
| Web-imported zip bombs / huge refs | Size limits; sanitize; no arbitrary script exec in v1 |

### 5. Performance Insights

- Catalog of N skills ≈ N × ~80 tokens always → 50 skills ≈ ~4k tokens (acceptable)
- Loading 3 full skills of 2k tokens each = +6k mid-turn (manage via token-estimation already in app)
- Host-side selection (embeddings / keyword score) can reduce misfires on weak models without tool-use
- Full model-as-router (native tool `load_skill`) works best on tool_use models; fallback needed for non-tool models

---

## Comparative Analysis

| Approach | How it works | Pros | Cons | Fit for Chaeboxi |
|----------|--------------|------|------|------------------|
| **A. Prompt dump all skills** | Always inject full bodies | Simple | Context death | No |
| **B. Progressive + model catalog** | L1 always; model chooses L2 | Standard, portable | Weak models skip skills | **Primary** |
| **C. Host-side router** | Keyword/embedding pick top-k | Works without tool_use | Less “smart”, tuning cost | **Fallback** |
| **D. User-only tags** | No auto | Predictable | Misses “magic” | Phase 1 baseline |
| **E. Copilot-only expand** | One persona per session | Already built | Not multi-skill, not on-demand | Keep separate |

**Industry winner:** B + D combined (Claude Code pattern: auto when relevant OR `/skill` / user invoke).

---

## Chaeboxi Fit Analysis

### Existing building blocks (reuse, don’t reinvent)

| Existing | Role today | Relation to Skills |
|----------|------------|--------------------|
| `CopilotDetail` + `session.copilotId` | Session-level persona, model overrides, hooks, tool access | **Keep.** Persona ≠ skill. Skills compose *on top* of copilot |
| `PromptPreset` / system prompt presets | Reusable full system prompts | Can **migrate/import** into skills later; not multi-activate |
| `injectModelSystemPrompt` in `message-utils.ts` | Injects model/date/personal info/tool instructions | **Extension point** for skill catalog + activated bodies |
| `stream-text.ts` toolset assembly | MCP, KB, web, file, video tools | Skills may *prefer* tools via metadata later |
| `OpenClawCommandPicker` | Fuzzy `/command` picker in input | **UX template** for skill picker / `@skill` |
| `generation.ts` | Turn pipeline, agent/plan modes | Activation resolution happens pre-stream |
| Token estimation package | Context budget | Gate how many skills auto-load |
| Tool risk-engine | Approval | Future skill scripts / allowed-tools |

### Gaps to build

1. Skill package model + storage (local first)
2. Parser for `SKILL.md` frontmatter (YAML + body)
3. Skill registry / discovery (app-managed store; optional folder import on desktop)
4. Activation resolver: explicit tags ∪ auto ∪ session-pinned
5. Input UX: multi-skill tags (`@` or chips)
6. Message/session metadata: which skills were active
7. Settings UI: manage enable/disable/edit/import
8. Progressive load (and later: reference file load)

### Platform constraints

- **Web / mobile:** no free filesystem of `~/.skills`; use app storage (IndexedDB/StoreStorage) + import zip/folder where OS allows
- **Desktop (Tauri):** can support user skills directory + drag-drop folders
- **Android agent-mode tree-shake:** keep skills core path working without agent tools; scripts optional desktop-only later
- **Community edition:** no paid Chatbox AI dependency for skills core

---

## Implementation Recommendations

### Conceptual model (ship this)

```text
User message
    │
    ├─► Parse explicit tags: @pdf @seo  → forced skills
    ├─► Session pins: skillIds on session settings
    └─► Auto (if enabled):
          • tool_use models: catalog in system + load_skill tool
          • OR host router: top-k by description match
    │
    ▼
Activated skill bodies injected as system (or high-priority) context blocks
    │
    ▼
Existing tools (MCP/KB/web) remain available — skills instruct *when/how*
```

### Skill data model (proposed)

```ts
// conceptual — not implemented
type SkillMeta = {
  id: string           // stable uuid or name
  name: string         // kebab-case
  description: string  // what + when
  enabled: boolean
  source: 'builtin' | 'user' | 'import'
  version?: string
  tags?: string[]
  // optional later: allowedTools, compatibility
}

type SkillPackage = SkillMeta & {
  instructions: string     // SKILL.md body
  references?: Record<string, string>  // path → content
  // scripts deferred
}

// Per turn / message
type SkillActivation = {
  skillId: string
  mode: 'explicit' | 'auto' | 'session' | 'pinned'
}
```

### Auto-select strategies (phased)

| Phase | Strategy | When |
|-------|----------|------|
| 1 | Explicit multi-tag only + optional session pin | Always works |
| 2a | Catalog in system prompt + instruction “use skill X when…” for all models | Cheap |
| 2b | `load_skill` tool for tool_use models | Best quality |
| 2c | Host keyword/embedding top-k for non-tool models | Parity |
| 3 | Reference progressive load tool `read_skill_ref` | Scale large skills |

### Multi-tag UX (recommended)

1. Type `@` in composer → SkillPicker (reuse OpenClawCommandPicker patterns)
2. Selected skills become **chips** above input (multi)
3. Also support slash: `/skill pdf-processing` for power users
4. Message stores `skillIds[]` so history shows what was applied
5. Toggle “Auto skills” per session (default on)

### What NOT to do (YAGNI)

- Do not merge Skills into Copilot as one blob
- Do not inject all skill bodies every turn
- Do not build marketplace / remote skill install in v1
- Do not execute arbitrary skill scripts in v1 (desktop sandbox later)
- Do not require Claude-only API; skills are client-side context engineering

### Quick Start (architecture PoC order)

1. Parse one builtin `SKILL.md` → inject description catalog + on-tag full body
2. Wire `@` multi-select in InputBox
3. Hook activation into `generation.ts` / `stream-text` via `injectModelSystemPrompt` extension
4. Measure tokens with existing estimator
5. Add auto catalog instruction; then `load_skill` for tool-capable models

---

## Resources & References

### Official / standard

- [Agent Skills Specification](https://agentskills.io/specification)
- [Anthropic engineering: Equipping agents with Agent Skills](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)
- [Claude Platform Agent Skills overview](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)
- [Claude Code Skills docs](https://code.claude.com/docs/en/skills)

### Ecosystem

- [Awesome Agent Skills (multi-tool)](https://github.com/VoltAgent/awesome-agent-skills)
- Comparison: AGENTS.md vs rules vs Skills — skills = on-demand verbs; rules = always-on adjectives

### Chaeboxi code anchors

- `src/shared/types.ts` — `CopilotDetail`, `PromptPreset`
- `src/renderer/packages/model-calls/message-utils.ts` — `injectModelSystemPrompt`
- `src/renderer/packages/model-calls/stream-text.ts` — tool instruction injection
- `src/renderer/stores/session/generation.ts` — turn pipeline
- `src/renderer/components/InputBox/OpenClawCommandPicker.tsx` — picker UX
- `src/renderer/hooks/useCopilots.ts` — persona layer

---

## Appendices

### A. Glossary

| Term | Meaning |
|------|---------|
| Progressive disclosure | Load metadata first, body on need, refs last |
| Catalog | Set of name+description for all enabled skills |
| Explicit activation | User tagged skill |
| Auto activation | Model or host chooses skill |
| Copilot | Session persona (Chaeboxi existing) |
| Skill | Modular on-demand procedure pack |

### B. Skills vs Copilot vs MCP vs Presets

```text
┌─────────────────────────────────────────────────────────┐
│ Session                                                 │
│  Copilot (optional persona + model/tool prefs)          │
│  System prompt (ambient)                                │
│  Skills: catalog always · bodies when active            │
│  MCP/Tools: callable functions                          │
│  User turn: text + @skill tags + attachments            │
└─────────────────────────────────────────────────────────┘
```

### C. Raw notes

- Open standard Dec 18, 2025 → shipping SKILL.md-compatible format is strategic (import community skills later)
- Claude Code: auto + `/skill-name`; frontmatter can control who invokes (user vs model) — consider `disable-model-invocation` later
- Progressive disclosure is the only scalable design once skill count > ~10

---

## Unresolved Questions

1. **Default skill storage location on desktop** — app data dir only vs also scan user folder (e.g. `~/Library/Application Support/Chaeboxi/skills`)?
2. **Session vs message scope for tags** — sticky until cleared vs per-message only? (recommend: chips sticky for session, clearable; message stores snapshot)
3. **Max concurrent auto skills** — hard cap 2–3 recommended; need product decision
4. **Builtin starter skills** — ship writing/code/research as skills vs leave as copilots only?
5. **Import from Claude/Cursor skill folders** — v1 or v2?
6. **Agent mode interaction** — should plan mode auto-prefer planning skill?

---

## Actionable Next Steps

1. Product: decide multi-tag UX (`@` chips) + auto default on/off
2. Architecture: approve progressive disclosure + separate from Copilot
3. Implement per plan phases in `plans/260807-1458-skills-feature/plan.md`
4. PoC: 2 builtin skills + tag inject before any marketplace work
