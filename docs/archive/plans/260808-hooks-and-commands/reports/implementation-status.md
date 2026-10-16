# Implementation status — Commands + Hooks

**Date:** 2026-08-08

## Done

### Phase 0 — Scan foundation
- `packages/agent-scan/` hybrid workspace-aware roots
- Skills scan accepts `workspaceRoot`
- Docs: `docs/hooks-and-commands.md`, skills.md updated

### Phase 1–2 — Commands
- Types: `shared/types/commands.ts`
- Package: parse, discover, slash tokens, activation, inject
- Store: `commandsStore.ts`
- Tauri: `commands:scan` (flat `.md` + folders)
- Composer: `CommandPicker`, `/` chips (presets no longer own `/`)
- Settings: `/settings/commands`
- Generation injects active command bodies

### Phase 3–4 — Hooks
- Types: `shared/types/hooks.ts`
- Parse Claude settings + Cursor hooks.json
- Discover via Tauri `hooks:read-configs`
- Shell via Tauri `hooks:run-shell` (timeout, cwd, stdin)
- Global PreTurn / PostTurn in `generation.ts` (before agent hooks)
- Settings: `/settings/hooks` (enable, shell master switch, audit)
- Shell default **off**

## Remaining polish
- Manual E2E: tag `/cmd`, rescan agent folders, enable shell hook, block tool via PreToolUse
- i18n keys may fall back to English source strings

## Tool hooks wiring (done)
- `wrapToolsWithLifecycleHooks` applied in `stream-text.ts` after approval + access filters
- SessionStart once per session+workspace in `generation.ts`
- PreTurn / PostTurn global + agent hooks
- Unit tests for wrap-tools block/allow paths

## Tests
- Unit tests green for agent-scan, commands tokens/parse, hooks parse
- `tsc --noEmit` clean after hooks store async fix
