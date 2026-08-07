# Skills

Agent Skills give Chaeboxi modular, on-demand procedures (like Claude/Cursor skills) without bloating every system prompt.

## User guide

### Tag skills with `$`

In the composer, type `$` then a skill name:

```text
Review this PR $code-review
```

- Pick from the skill list (↑/↓, Enter/Tab)
- Select **multiple** skills (chips appear above the input)
- Chips stick for the session until you remove them
- Currency like `$100` is ignored (not treated as a skill)

### Auto-select

When session auto-skills is on (default), the app may activate up to **2** relevant skills from the catalog based on your message text—even without `$` tags.

### Manage skills

**Settings → Skills**

- Enable/disable builtins (`code-review`, `writing-editor`, `deep-research`)
- Create custom skills
- Import / export `SKILL.md` files (agentskills.io compatible)
- **Desktop:** rescan shared agent folders (Claude / Codex / Cursor / …)

### Shared agent folders (desktop)

Chaeboxi loads the same skill trees other coding agents use. Project roots win over user-global when names collide.

| Origin | Paths |
|--------|--------|
| Project | `./.claude/skills`, `./.codex/skills`, `./.agents/skills`, `./.cursor/skills`, `./.grok/skills`, `./skills` |
| Claude | `~/.claude/skills` |
| Codex | `~/.codex/skills` |
| Agents | `~/.agents/skills` |
| Cursor | `~/.cursor/skills` |
| Grok | `~/.grok/skills` |
| Gemini | `~/.gemini/skills` |
| OpenCode | `~/.config/opencode/skills` |

Each skill is a folder containing `SKILL.md`. Ecosystem names like `ckm:write` are normalized to `$ckm-write` for tagging.

**Context safety:** only a capped catalog (≈24) is injected every turn; full bodies load only for activated skills.

### vs Copilots

| | Copilot | Skill |
|--|---------|--------|
| Scope | Whole session persona | On-demand procedure |
| Activation | One per session | Many per turn |
| Model overrides | Yes | No (v1) |

## SKILL.md format

```markdown
---
name: my-skill
description: What it does and when to use it. Include trigger keywords.
---

# Instructions

Step-by-step guidance for the model…
```

Rules:

- `name`: lowercase kebab-case, max 64 chars
- `description`: max 1024 chars; used for auto matching
- Body: loaded only when the skill is activated (progressive disclosure)

## Developer notes

### Pipeline

1. User message stores `skillIds[]` from `$` chips / tokens
2. `generation.ts` resolves activations: explicit → session pins → auto top-k
3. Injects system block: **Available skills** (catalog) + **Active skills** (bodies)
4. Assistant message may store `skillActivations[]` for UI

### Key paths

- Types: `src/shared/types/skills.ts`
- Package: `src/renderer/packages/skills/`
- Store: `src/renderer/stores/skillsStore.ts`
- Composer: `InputBox` + `SkillPicker` (`$` trigger)
- Inject: `stores/session/generation.ts`
- Settings: `routes/settings/skills.tsx`

### Caps

- Explicit + session pins: max 5
- Auto: max 2

### Non-goals (v1)

- Skill marketplace
- Skill script execution
- `load_skill` mid-turn tool (optional later)
