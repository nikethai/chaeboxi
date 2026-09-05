---
phase: 3
title: "Read-Only Source Control"
status: pending
priority: P1
dependencies: [1]
effort: "5-7 days"
---

# Phase 3: Read-Only Source Control

## Context Links

- [Plan](./plan.md)
- [`src-tauri/src/workspace/`](../../src-tauri/src/workspace)
- [`ProjectContextPanel.tsx`](../../src/renderer/components/project/ProjectContextPanel.tsx)

## Overview

Add desktop-only Git discovery, branch/status, bounded diff, and history through a native semantic broker. Keep `.git` inaccessible through ordinary Project Files. No staging, commit, network, or arbitrary Git arguments.

## Requirements

- Capability-derived repository root only; no renderer cwd/path.
- Authorized root must equal Git worktree root; reject parent repository discovery.
- Support normal, unborn, detached, conflict, rename, submodule, and linked-worktree status.
- Sanitize executable discovery, HOME/XDG/config/environment; set `GIT_OPTIONAL_LOCKS=0`; disable prompts, pagers, hooks, fsmonitor, external diff/textconv.
- Bound every process by timeout, output size, result count, and cancellation.
- Redact stderr and absolute paths.
- UI tabs: Explorer and Source Control.
- Retain raw path bytes only in native opaque change IDs; renderer receives escaped/lossy labels.

## Architecture

```text
SourceControlView
  → scm:status|diff|log(capability, typed args)
  → WorkspaceAuthority checkout lease
  → GitBroker fixed argv + sanitized environment
  → Rust parser
  → renderer-safe typed snapshot
```

MVP starts with installed Git CLI via `tokio::process::Command` because porcelain v2 gives broad repository compatibility without a new Git library. The renderer never selects an executable or subcommand. This choice is conditional on the security gate below; operations that cannot prove helper/filter suppression move to a safe library or remain disabled.

## Git Read Security Gate

Before enabling each operation (`status`, `diff`, `log`), run hostile fixtures with local config, `.gitattributes`, filters/process filters, textconv, fsmonitor, hooks, credential helpers, alternates, pager/editor, and environment overrides.

Pass criteria:

- No external process/helper/filter executes.
- Repository index/common-dir/worktree metadata does not mutate.
- Raw path bytes and stderr remain native/redacted.

Failure outcome per operation:

1. Implement that operation with a vetted non-executing library (`gix` preferred for evaluation), or
2. Keep that operation disabled.

Status-only may ship if status passes while diff/log remain unavailable. Never weaken the claim or silently invoke unrestricted Git.

## File Inventory

| Action | File | Change | Test impact |
|---|---|---|---|
| Create | `src/shared/types/source-control.ts` | Zod status/diff/log/error contracts | Schema tests |
| Create | `src-tauri/src/workspace/source_control.rs` | Broker, policy, deadlines | Rust security tests |
| Create | `src-tauri/src/workspace/git_porcelain.rs` | NUL-safe porcelain v2 parser | Parser fixtures |
| Create | `src-tauri/src/workspace/source_control_tests.rs` | Repository/security fixtures | Cargo test |
| Create | `src/renderer/hooks/useSourceControl.ts` | Fetch/cancel/generation lifecycle | Hook tests |
| Create | `src/renderer/components/project/SourceControlView.tsx` | Read-only SCM UI | Component tests |
| Create | `src/renderer/components/project/SourceControlView.test.tsx` | Status/a11y/error states | Vitest |
| Modify | `src-tauri/src/workspace/mod.rs` | `scm:*` dispatch | IPC tests |
| Modify | `src-tauri/src/workspace/authority.rs` | Checkout lease without exposing root | Rust tests |
| Modify | `src-tauri/src/workspace/error.rs` | Typed SCM errors | Contract tests |
| Modify | `src-tauri/src/lib.rs` | Async process dispatch | Integration |
| Modify | `src/renderer/platform/interfaces.ts` | SCM APIs | Platform tests |
| Modify | `src/renderer/platform/desktop_platform.ts` | Native adapter | Platform tests |
| Modify | `src/renderer/platform/web_platform.ts` | Explicit unsupported SCM adapter | Platform tests |
| Modify | `src/renderer/platform/test_platform.ts` | Fail-closed fixtures | Platform tests |
| Modify | `src/renderer/platform/capabilities.ts` | Desktop-only SCM flag | Capability tests |
| Modify | `src/renderer/components/project/ProjectContextPanel.tsx` | Explorer/SCM tabs | UI tests |
| Modify | `src/renderer/static/globals.css` | Change groups and diff states | Manual/visual |
| Modify | `docs/project-workspaces.md` | Git boundary and privacy | Docs |

## Interface Checklist

- [ ] `getSourceControlStatus(capabilityId, requestId?)`.
- [ ] `getSourceControlDiff(capabilityId, scope, changeId?, cursor?)`.
- [ ] `getSourceControlLog(capabilityId, cursor?, limit?)`.
- [ ] `cancelSourceControlRequest(requestId)`.
- [ ] Native `repositoryId` and `checkoutId` are random app-local identities.
- [ ] Source-control changes use native opaque IDs mapped to raw path bytes; labels are display-only.
- [ ] Diff/log requests accept opaque broker IDs and bounded enums, never refs/pathspec strings.

## Implementation Steps

1. Build hostile repository/process sentinel fixtures and complete the per-operation Git read security gate.
2. Write parser fixtures before broker integration.
3. Define Git executable discovery and exact environment allowlist; isolate HOME/XDG/system/global config and disable optional locks/helpers.
4. Require canonical worktree root to equal the authorized root; model linked worktree common-dir separately.
5. Implement fixed `git status --porcelain=v2 -z --branch` and parse path fields as bytes.
6. Add bounded status snapshot and typed errors for missing Git/non-repository/timeout/output limit.
7. Add bounded diff selected only by opaque native change ID, with external diff/textconv disabled and binary summary only.
8. Add paged recent log with commit ID, author display, timestamp, and subject; exclude arbitrary revision expressions.
9. Add request cancellation and kill-on-drop child management.
10. Build Source Control tab with branch state, grouped changes, refresh, diff preview, and history.
11. Keep all mutation controls absent behind a separate future capability.

## Test Scenario Matrix

| Priority | Scenario | Expected |
|---|---|---|
| Critical | Hostile `GIT_*`, pager/editor/helper config | Ignored/disabled; nothing executes |
| Critical | Repository root above authorized folder | `REPOSITORY_OUTSIDE_ROOT` |
| Critical | Arbitrary renderer Git args | Contract cannot express them |
| High | Git timeout/output flood | Child killed; bounded redacted error |
| High | Rename/conflict/non-UTF/newline/tab/leading-dash path | Native opaque ID + safe display label |
| High | Linked worktree | Authorized checkout valid; common dir not exposed |
| Medium | Git unavailable in GUI PATH | Clear install/unavailable state |
| Medium | Project switch during request | Old response discarded |

## Dependency Map

- Depends on Phase 1 authority leases and cancellation.
- Can run parallel with Phase 2.
- Provides repository/checkout identity required by Phase 6.

## Success Criteria

- [ ] Status/diff/log work on macOS, Windows, and Linux fixtures.
- [ ] Every enabled Git operation passes hostile helper/filter sentinel tests; failing operations use a safe library or remain disabled.
- [ ] Index/common-dir metadata remains unchanged across read-only calls.
- [ ] No Git mutation/network channels exist.
- [ ] Large repositories return bounded/truncated states rather than freezing UI.
- [ ] Web/mobile/Quick surfaces remain unavailable.

## Risk Assessment

- **Git CLI absent:** graceful unavailable state; do not bundle Git in this phase.
- **Hostile repository config:** explicit config overrides plus adversarial fixtures.
- **Repository data privacy:** no raw stderr, full paths, remotes, or deleted secret content in audit/telemetry.

## Security Considerations

Read-only Git can still expose history and invoke configured helpers. Every operation remains fixed, sanitized, bounded, and rooted in the native workspace capability.
