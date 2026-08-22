---
title: "Project Workspace Experience"
description: "Evolve Chaeboxi Projects into secure directory-backed chat workspaces with native folder selection, explicit file context, and conflict-safe agent editing."
status: complete
priority: P1
branch: "feature/develop-workspace-tool"
tags: [feature, frontend, backend, security, desktop]
blockedBy: []
blocks: []
created: "2026-08-22"
createdBy: "ck:plan"
source: skill
mode: deep
scope: hold
risk: medium-with-p0-security-blockers
---

# Project Workspace Experience

## Overview

Turn current chat-grouping Projects into a first-class desktop project context. A Project stays portable/chat-only metadata while a private native device registry may bind it to one user-authorized directory. Replace pasted paths and per-session authority with picker-owned native trust, handle-relative Rust capability enforcement, explicit context browsing, and revision-safe edits.

This is an idiomatic port of proven Cursor/Claude/Codex workspace ideas, not a transplant and not a full IDE.

## Scope Challenge

- **Existing code:** Projects rail, `FolderSchema`, `Session.folderId`, `Session.workspaceRoot`, coding tools, tool approvals, platform abstraction, Rust IPC, `rfd`, and local Rust KB.
- **Minimum committed change:** native authority, Project migration, folder UX, bounded explorer, safe editing, rollout.
- **Complexity:** six dependent phases across shared schema, renderer, platform adapters, Rust, tests, and docs. Fewer phases would mix security gates with product rollout.
- **Selected scope:** HOLD. Bulletproof the approved core. Defer semantic indexing, Git UI, PTY, worktrees, and background agents.

## Goals

1. One Project groups chats and optionally owns one local directory.
2. Users choose folders natively; normal flow never asks for an absolute path.
3. Rust authorizes every Project file read and mutation; generic Project shell is unavailable.
4. Users explicitly browse/search/select repository context.
5. Agent edits detect stale files and commit atomically.
6. Existing chat-only Projects and legacy sessions migrate without data loss.

## Non-Goals

- Full code editor or Cursor clone.
- Semantic repository indexing or automatic whole-repo embedding.
- Git staging/commit UI, generic/project terminal, PTY, background agents, automatic worktrees, multi-root projects.
- Desktop filesystem parity on web/mobile.
- Automatic execution of project-local instructions, commands, skills, or hooks without category-specific trust.

## Current Architecture and Problem

```text
ComposerToolsMenu pasted path
  -> Session.workspaceRoot
  -> generation / skills / commands / hooks / browser downloads
  -> renderer lexical path checks
  -> broad Rust fs + shell IPC
```

Key evidence:

- `src/shared/types/session.ts`: user-facing Projects are `FolderSchema`; sessions separately own `folderId` and `workspaceRoot`.
- `src/renderer/components/InputBox/ComposerToolsMenu.tsx`: manual full-path modal.
- `src/renderer/packages/tools/workspace-path.ts`: lexical confinement; no authoritative filesystem canonicalization.
- `src-tauri/src/lib.rs`: broad `fs:*` and `execute_command` channels trust renderer-supplied paths/cwd.
- `src/renderer/components/workspace/WorkspacePanel.tsx`: “Workspace” already names artifact preview, causing domain collision.

## Target Architecture

```text
Project UI / Context picker
  -> portable Project repository + effective context resolver
  -> Platform workspace API
  -> Rust workspace authority
       - native picker-owned authorization
       - private device-local binding/trust registry
       - root handle + opaque window/project/generation capability
       - handle-relative list/read/search
       - revision checks + atomic mutation
```

### Core Contracts

```ts
Project {
  id: string
  name: string
  emoji?: string
  defaultAgentId?: string
  order: number
}

Session {
  projectId?: string
  folderId?: string          // deprecated compatibility dual-read/write
  workspaceRoot?: string     // legacy reconnect hint only; never authority
}

WorkspaceDescriptor {
  projectId: string
  capabilityId: string       // runtime-only; never exported/synced
  rootGeneration: string
  displayPath: string
  status: 'ready' | 'missing' | 'permission-denied' | 'relink-required'
}
```

Portable Project metadata contains no root. Native private `ProjectBinding` records picker-authorized root identity and category trust. Explicit `projectId` suppresses all legacy root fallback. An unmigrated session root only triggers a reconnect prompt; the user must select the folder natively.

## Xia Evidence

### Source Manifest

| Source | Relevant behavior | Chaeboxi adaptation |
|---|---|---|
| [Cursor ignore files](https://cursor.com/docs/reference/ignore-file) | Folder-rooted context with exclusions | One directory root; hard safety exclusions plus ignore-aware bounded search |
| [Cursor rules](https://cursor.com/docs/rules) | Project-local instructions | Discover visibly under repository trust; do not silently execute |
| [Cursor Agent](https://cursor.com/help/ai-features/agent) | Search, edit, and terminal workflow | Keep chat-first UI; native capability and approvals remain independent |
| [Cursor worktrees](https://cursor.com/docs/configuration/worktrees) | Isolated parallel tasks | Deferred; use revision conflicts first |
| [Claude Projects](https://support.anthropic.com/en/articles/9517075-what-are-projects) | Chats and reusable context grouped by Project | Evolve current Projects; preserve chat-only mode |
| [Codex approvals](https://developers.openai.com/codex/agent-approvals-security) | Consequential actions require explicit policy | Classify concrete invocation arguments; native enforcement cannot be approved away |
| [Codex worktrees](https://developers.openai.com/codex/app/worktrees) | Parallel chats avoid collision through isolation | Deferred until safe single-root editing is measured |

Source content is design evidence only. No source code is copied or executed.

### Source Anatomy

1. **Identity:** durable project groups related chats.
2. **Root:** optional local directory establishes context and capability boundary.
3. **Discovery:** tree/search/instructions expose available context.
4. **Selection:** user chooses what enters a turn; whole repository is not injected.
5. **Action:** read/write/delete require native authorization; mutations additionally require concrete approval.
6. **Consistency:** revision checks prevent silent overwrite.
7. **Isolation:** worktrees/background execution remain a later concern.

### Dependency Matrix

| Capability | Local state | Decision |
|---|---|---|
| Project/chat grouping | EXISTS: `FolderSchema`, rail, `folderId` | Evolve, preserve IDs |
| Native folder picker | EXISTS: Rust `rfd` dependency and picker precedent | Reuse |
| Project registry | PARTIAL: `MyFolders` storage | Migrate portable metadata with one-release dual-write |
| Native Project binding | NEW | Private picker-authorized device registry; never renderer root authority |
| Runtime root authority | CONFLICT: renderer lexical validation | Handle-relative Rust capability bound to project/window/generation |
| File tools | EXISTS: create/edit/delete | Route through capability; move mutation logic native |
| Terminal | CONFLICT: buffered machine shell cannot be workspace-confined | Disable/defer in this MVP; remove generic renderer command IPC |
| File explorer/search | NEW | Lazy, paged, bounded, ignore-aware native APIs |
| Project instructions | PARTIAL: skill/command/hook scanners | Add visible trust-governed discovery |
| Semantic code index | PARTIAL: local KB primitives | Explicitly deferred |
| Parallel worktrees | NEW | Explicitly deferred |

### Decision Matrix

| Decision | Source pattern | Current Chaeboxi | Recommendation |
|---|---|---|---|
| Navigation | Repository/project first | Projects plus separate per-chat path | Evolve current Project; no second Workspace rail |
| Project type | Usually directory-backed | Chat-only folders | Portable Project plus optional native device binding |
| Root ownership | Project/editor window | Session | Native binding owns root; Project ID links chats |
| Selection | Native folder flow | Pasted absolute path | Picker is the only authorization path |
| File authority | Host/editor boundary | Renderer checks | Handle-relative Rust capability bound to window/project/generation |
| Context | Search/index plus explicit refs | Tool-driven | Explicit tree/search first |
| Mutation | Diffs/checkpoints | Blind read-replace-write | Revision + atomic replacement |
| Index | Automatic | KB is document-oriented | Defer; do not expose project as KB |

### Challenge Results

| Challenge | Source answer | Local answer | Risk if wrong |
|---|---|---|---|
| Need a new Workspace entity? | Editors often do | Projects already own chat hierarchy | Two competing navigation models |
| Must every Project bind a folder? | Cursor assumes folder/editor | Existing Projects are useful chat groups | Breaking migration and product regression |
| Does cwd sandbox terminal? | Real confinement needs sandbox/broker | Current shell can reach machine paths | False security promise |
| Should repository indexing ship now? | Cursor makes it core | Explicit file context delivers MVP value | Privacy, disk, and schedule blow-up |
| Can renderer enforce or authorize the root? | Trusted host must enforce | Renderer is compromiseable | Arbitrary capability minting and path escape |
| Can cwd confine shell? | Requires OS sandbox/broker | Current command runner is machine-wide | False safety; shell deferred |
| Need worktrees for concurrency? | Valuable for parallel agents | Current target is project context | Premature scope expansion |

### Risk Score

Xia challenge framework: **3 critical assumptions => Medium architectural risk; resolve before feature exposure.** Security severity remains P0.

| Risk | Score (1-16) | Primary mitigation |
|---|---:|---|
| Symlink/TOCTOU escape | 16 | Handle-relative/no-follow operations and operation leases |
| Broad legacy IPC bypass | 12 | Remove/reject broad renderer channels before enablement |
| Wrong root migration | 12 | No auto-root migration; explicit picker reconnect only |
| Stale destructive edit | 12 | Expected revision and atomic replace |
| Sensitive context exposure | 12 | Hard exclusions, trust, explicit selection |
| Cross-platform filesystem variance | 12 | Rust tests and read-only fallback |
| Large repository latency | 9 | Lazy paging, strict limits, cancellation |

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Secure Native Workspace Boundary](./phase-01-secure-native-workspace-boundary.md) | Pending |
| 2 | [Project Domain and Migration](./phase-02-project-domain-and-migration.md) | Pending |
| 3 | [Desktop Project Experience](./phase-03-desktop-project-experience.md) | Pending |
| 4 | [Project Context Explorer](./phase-04-project-context-explorer.md) | Pending |
| 5 | [Safe Editing and Concurrency](./phase-05-safe-editing-and-concurrency.md) | Pending |
| 6 | [Integration Rollout and Documentation](./phase-06-integration-rollout-and-documentation.md) | Pending |

## Dependencies

```text
Phase 1 -> Phase 2 -> Phase 3 -> Phase 4 -> Phase 5 -> Phase 6
    \__________________________________^          ^
         native authority reused by all privileged work
```

Related, non-blocking plans:

- `plans/2026-08-06-rail-projects-recents/plan.md` — implemented Projects/Recents IA; preserve it.
- `plans/2026-08-08-diagram-workspace/plan.md` — artifact side pane; rename terminology without changing behavior.
- `plans/260808-hooks-and-commands/plan.md` — project-root scanners; integrate with repository trust.
- `plans/260820-2357-next-feature-growth/plan.md` — explicitly defers workspace files; no dependency.

## Global Rollback Strategy

- Dual-write portable `MyProjects`/`MyFolders` and `projectId`/`folderId` for one compatibility release.
- Treat `workspaceRoot` only as a reconnect hint; tombstone it on move/unbind/reconnect.
- Gate native binding, explorer, and mutation separately from Phase 1 onward.
- Revoke/cancel capabilities whenever a feature is disabled, a root changes, or the owner window closes.
- On failure, fall back to chat-only Projects and read-only/no-project context.
- Never roll back to broad renderer filesystem/shell access.
- Removing a Project never deletes its directory.

## Validation Gates

- `pnpm check`
- `pnpm lint`
- `pnpm test`
- `pnpm test:integration`
- `pnpm build:renderer`
- `cargo test --manifest-path src-tauri/Cargo.toml`
- Desktop manual matrix: macOS, Windows, Linux picker; migration; missing/relinked root; symlink escape; conflict; restart; export privacy; web/mobile regression.

## Red Team Review

Accepted blockers and plan changes:

- Native picker/private binding registry replaces renderer-supplied root registration.
- Handle-relative OS operations replace canonicalize-then-use claims.
- Broad renderer filesystem/shell channels are a Phase 1 production blocker.
- Generic Project terminal and shell hooks are disabled/deferred.
- Legacy roots never auto-migrate or become authority; reconnect is explicit.
- Portable Project metadata is separate from native device binding/trust.
- Final revision mutation contracts exist from Phase 1 but remain disabled until Phase 5.
- Selected context, trust categories, cancellation and cross-window behavior are explicitly defined.

## Validation Log

- **Tier:** Full (6 phases)
- **Verified:** current Project/Folder schema, session root, manual path UI, broad native channels, platform implementations, `rfd`, scanners, artifact callers, build/test commands.
- **Corrected:** nonexistent browser download file, missing callers, migration input contradiction, cross-window storage, downgrade promise, picker ownership, mutation contract, shell/trust timing.
- **Runtime commands:** not executed; plan-only review.

### Whole-Plan Consistency Sweep

- Files reread: `plan.md` and all six phase files.
- Decision deltas checked: native authorization, binding separation, no legacy fallback, no generic shell, final mutation gate, one-send context.
- Unresolved contradictions: 0 after final sweep.

## Open Questions

None. Locked safety choice: legacy roots require explicit native reconnect; Project terminal and shell hooks are deferred.
