---
phase: 1
title: "Harden Workspace Authority"
status: pending
priority: P1
dependencies: []
effort: "5-7 days"
---

# Phase 1: Harden Workspace Authority

## Context Links

- [Plan](./plan.md)
- [`docs/project-workspaces.md`](../../docs/project-workspaces.md)
- [`src-tauri/src/workspace/authority.rs`](../../src-tauri/src/workspace/authority.rs)
- [`src-tauri/src/workspace/traverse.rs`](../../src-tauri/src/workspace/traverse.rs)

## Overview

Strengthen the existing native capability boundary before adding Git or execution. Fix unbounded traversal, incomplete cancellation, renderer-controlled mutation enablement, root identity races, and capability duplication.

## Requirements

### Functional

- Preserve native-picker-only binding and existing Project migration behavior.
- Reuse one runtime capability per project/window/root generation.
- Add operation-scoped leases and request cancellation with deterministic cleanup.
- Keep read/list/search/mutate relative and hard-deny-aware.
- Return structured expected errors through an explicit IPC result envelope instead of string-only failures.
- Establish default-off native rollout policy for export, SCM, staging, apply, WASI, and worktrees; renderer flags may hide or revoke, never grant authority.
- Establish sensitive tool-payload rules before new file/execution tools: raw source, stdin, file content, and diffs must not persist in sessions, approvals, exports, hooks, retries, or logs.

### Non-functional

- List: 200 entries/page without reading full file contents.
- Read: reject or stream beyond 1 MiB before full allocation.
- Search: max 10,000 entries, 100 MiB inspected, 100 hits, depth 64, initial 2-second deadline.
- Max 2 concurrent workspace jobs/project, 4 process-wide.
- Revocation interrupts requests and prevents mutation commit.

## Architecture

```text
WorkspaceCapability
  ├─ project/window/generation/root identity
  ├─ shared revocation token
  └─ operation lease
       ├─ bounded list/read/search
       └─ serialized mutation preflight + commit
```

Native compiled rollout policy is authoritative for capability availability. App/user flags only intersect by disabling and revoking; they do not grant a capability absent from the native build policy. These flags are rollout controls, not a security boundary. `workspace:set-mutation` must not grant native permission.

Adopt an async broker envelope: `{ ok: true, value } | { ok: false, error: { code, message? } }`. Move bounded filesystem jobs to a dedicated blocking pool with RAII request registration and cancellation tokens.

## File Inventory

| Action | File | Change | Test impact |
|---|---|---|---|
| Create | `src-tauri/src/workspace/budgets.rs` | Central limits/deadlines | Rust unit tests |
| Create | `src-tauri/src/workspace/lease.rs` | Per-root leases, revocation tokens | Concurrency tests |
| Modify | `src-tauri/src/workspace/authority.rs` | Capability reuse, identity recheck, bounded operations | Workspace suite |
| Modify | `src-tauri/src/workspace/traverse.rs` | Bounded reads; stronger Windows no-follow/reparse behavior | Cross-platform Rust |
| Modify | `src-tauri/src/workspace/ignore.rs` | Correct nested rule scope and limits | Ignore tests |
| Modify | `src-tauri/src/workspace/error.rs` | Structured error codes | TS/Rust contract |
| Modify | `src-tauri/src/workspace/mod.rs` | Remove renderer authorization of mutation; request cleanup | IPC tests |
| Modify | `src-tauri/src/lib.rs` | Async broker dispatch, error envelope, native rollout policy | Desktop integration |
| Modify | `src/shared/desktop-ipc-types.ts` | Typed broker result envelope | IPC contract tests |
| Modify | `src/shared/types/workspace.ts` | Budget/error fields and fail-closed flags | Schema tests |
| Modify | `src/renderer/platform/desktop_platform.ts` | Remove mutation-flag synchronization | Platform tests |
| Modify | `src/renderer/hooks/useProjectWorkspace.ts` | Avoid capability remint on focus | Hook/UI tests |
| Modify | `src/renderer/platform/workspace-platform.test.ts` | Fail-closed and lifecycle assertions | Vitest |
| Modify | `src/shared/types/session.ts` | Sensitive tool payload persistence boundary | Migration/privacy tests |
| Modify | `src/renderer/packages/model-calls/wrap-tools-approval.ts` | Metadata-only sensitive approvals | Approval tests |
| Modify | `src/renderer/packages/model-calls/stream-text.ts` | Block sensitive tools from shell lifecycle hooks | Tool tests |
| Modify | `src/renderer/lib/format-chat.tsx` | Redact sensitive tool payloads in exports | Export tests |
| Modify | `src-tauri/src/workspace/tests.rs` | Security, race, budget coverage | Cargo test |

## Interface Checklist

- [ ] `WorkspaceRuntime::lookup_cap` revalidates binding generation and root identity.
- [ ] Capability contains shared cancellation/revocation token.
- [ ] `begin_op` enforces per-project/global concurrency.
- [ ] Request IDs are removed on completion, error, timeout, and cancel.
- [ ] Listing returns metadata only; content revision generated on read/preflight.
- [ ] Mutation lease rechecks capability immediately before commit.
- [ ] Expected workspace errors use one typed result envelope end-to-end.
- [ ] Native rollout policy defaults high-risk capabilities off and revokes them on disable.
- [ ] Sensitive tool inputs/results are metadata-only in persistence, exports, hooks, approvals, and logs.

## Implementation Steps

1. Add regression tests for current picker, wrong-window, stale generation, symlink, revision conflict, and mutation-disabled behavior.
2. Introduce `WorkspaceBudgets` constants and enforce before allocation/traversal.
3. Replace global in-flight spin wait with request-scoped cancellation and per-root leases.
4. Reuse capabilities by project/window/generation; revoke on relink, unbind, feature disable, and window close.
5. Move synchronous scans to `spawn_blocking` or an equivalent bounded worker path.
6. Stop hashing full files during list; return size and safe metadata.
7. Fix nested `.gitignore` stack push/pop behavior and enforce total traversal limits.
8. Strengthen non-Unix root/reparse identity handling; document any remaining platform limitation as read-only fallback.
9. Define compiled native rollout policy and independent capability bits; remove renderer ability to enable native mutation.
10. Convert workspace and new broker dispatch to async result envelopes with queue saturation and cancel-before-start tests.
11. Add sensitive tool-payload classifier/redaction boundary covering message persistence, exports, approvals, retries/continuations, lifecycle hooks, and logs.
12. Add sentinel-secret tests proving sensitive bytes never appear in portable or audit surfaces.

## Test Scenario Matrix

| Priority | Scenario | Expected |
|---|---|---|
| Critical | Root/symlink/junction swapped after bind | Capability stale; no access |
| Critical | Revoke between mutation preflight and commit | No commit |
| Critical | Quick window uses main capability | `WRONG_WINDOW` |
| High | Huge file read/list | Bounded memory; typed limit result |
| High | Deep/large search | Deadline/cancel honored; request removed |
| High | Concurrent edit same root | Serialized; one deterministic conflict |
| Medium | Focus repeatedly restores binding | Capability reused, no leak |
| Medium | Nested ignore negation | Correct scope; hard deny never overridden |
| Critical | Sensitive tool sentinel in source/stdin/diff | Absent from session JSON, exports, approvals, hooks, logs |

## Dependency Map

- Blocks Phases 2-6.
- No new execution or Git authority in this phase.

## Success Criteria

- [ ] Renderer cannot enable native mutation.
- [ ] All file operations enforce root identity, generation, window, and revocation.
- [ ] Search/list/read limits are measured and tested.
- [ ] Cancellation latency stays below 500 ms after a cancellation check boundary.
- [ ] Windows/macOS/Linux security fixture matrix passes or unsupported mutation fails closed.
- [ ] Existing project workspace integration tests remain green.
- [ ] Native flags, async envelope, and sensitive-payload boundary are prerequisites for later brokers.

## Risk Assessment

- **Windows handle complexity:** keep mutation disabled where root identity cannot be guaranteed.
- **Behavior drift:** protect current migration/explorer behavior with tests before refactor.
- **Throughput regression:** measure p95 list/search latency on small and large fixtures.

## Security Considerations

The renderer is not a policy boundary. Native code must authorize every operation. Hard-denied files remain unavailable even when ignored rules negate exclusions.
