# Commands and Hooks

Chaeboxi extensibility beyond Skills. Clear separation of triggers and behavior.

## Product matrix

| Feature | Trigger | Taggable in dock? | Auto? | Scope |
|---------|---------|-------------------|-------|-------|
| **Skills** | `$name` | Yes | Yes (match + pins) | On-demand procedures |
| **Commands** | `/name` | Yes | **No** | User-invoked prompt packages |
| **Hooks** | Lifecycle events | **No** | **Always** (when enabled) | Global automation |

**Locked rules:**

- `$` = skills only; `/` = commands only (forever)
- Hooks never appear in composer pickers or chips
- Hooks are global always-on (not per-agent); user can disable individuals in Settings
- Shell hooks: desktop only, master switch default **off**

## Commands

### User guide

Type `/` in the composer, pick a command, send. Multi-select chips (max 5). Bodies inject as system context for that turn only. No auto-match from free text.

### Manage

**Settings → Commands**

- Enable/disable
- Create custom commands
- Import/export markdown
- Desktop: rescan agent command folders

### Agent folders (desktop, hybrid scan)

| Origin | Paths |
|--------|--------|
| Project | `{workspace}/.claude/commands`, `{workspace}/.cursor/commands`, `{workspace}/.agents/commands`, `{workspace}/.codex/commands`, `{workspace}/.grok/commands`, `{workspace}/commands` |
| User | `~/.claude/commands`, `~/.cursor/commands`, `~/.agents/commands`, `~/.codex/commands`, `~/.grok/commands` |

`workspace` = session **workspace root** when set; otherwise process CWD (same hybrid policy as skills).

### Format

Markdown file (`review.md` or folder body) with optional frontmatter:

```markdown
---
name: review
description: Review the current changes
---

Review the diff and suggest improvements…
```

Names normalize like skills (`ck:plan` → `/ck-plan`).

### vs Skills

| | Skill | Command |
|--|-------|---------|
| Trigger | `$` | `/` |
| Auto | Yes | No |
| Body when | activated | tagged only |

## Hooks

### User guide

Hooks **do not** tag in chat. They run automatically on lifecycle events when enabled. Import from Claude/Cursor setups on desktop rescan.

### Manage

**Settings → Hooks**

- List imported + builtin hooks
- Enable/disable per hook
- **Enable shell hooks** master switch (default off)
- Audit log of recent runs

### Events (v1)

| Event | When |
|-------|------|
| `SessionStart` | Once per session id + workspace (first generation) |
| `PreTurn` | Before model stream |
| `PostTurn` | After generation |
| `PreToolUse` | Before every tool `execute` (exit 2 / block = block; model sees error) |
| `PostToolUse` | After every tool `execute` (success or throw) |

Tool hooks wrap the final tool set in `stream-text` (MCP, files, terminal, web, tasks, etc.) after approval gates.

### Import sources

| Origin | Config |
|--------|--------|
| Claude | `~/.claude/settings.json`, `{workspace}/.claude/settings.json` → `hooks` |
| Cursor | `~/.cursor/hooks.json`, `{workspace}/.cursor/hooks.json` |

### Shell security

- Desktop only
- Master switch default off
- Timeout 10s (max 30s)
- CWD = workspace root or home
- Exit `2` blocks PreToolUse; other failures fail soft
- Stdout inject truncated (~8KB)
- Never shown as `$`/`/` chips

### vs Copilot (agent) hooks

| | Global hooks | Agent/copilot hooks |
|--|--------------|---------------------|
| Scope | Always-on (workspace-aware) | Bound to selected agent |
| Source | Agent settings import + app | Copilot editor |
| Order | Global first, then agent | After global |

## Hybrid scan policy

```text
Always scan user-global agent trees (~/.claude, ~/.cursor, …)

If session.workspaceRoot set:
  resolve project-local roots under workspaceRoot
Else:
  resolve project-local roots against process CWD
```

Web/mobile: no FS scan; user-created commands in app storage only.

## Developer notes

### Key paths

| Area | Path |
|------|------|
| Types | `src/shared/types/commands.ts`, `hooks.ts` |
| Commands package | `src/renderer/packages/commands/` |
| Hooks package | `src/renderer/packages/hooks/` |
| Scan roots helper | `src/renderer/packages/agent-scan/` |
| Composer | `InputBox` + `CommandPicker` (`/`) |
| Inject / events | `stores/session/generation.ts` |
| Settings | `routes/settings/commands.tsx`, `hooks.tsx` |

### Generation order

1. SessionStart (once per session+workspace)
2. Global PreTurn → inject
3. Agent PreTurn → inject
4. Plan / tool instructions
5. Skills catalog + active skill bodies
6. Active command bodies
7. streamText (+ Pre/PostToolUse around tools)
8. Global PostTurn + agent PostTurn

### Caps

- Commands explicit: max 5
- Hook inject stdout: ~8KB
- Shell timeout: 10s default

### Non-goals (v1)

- OpenClaw slash integration
- Per-agent global hook attachment UI
- Full Claude 30-event matrix
- Auto-matching commands
- Skill dual-trigger under `/`
