---
phase: 1
title: "Secure Native Workspace Boundary"
status: pending
priority: P1
dependencies: []
effort: "6-9 engineering days"
---

# Phase 1: Secure Native Workspace Boundary

## Overview

Build the trusted desktop boundary before directory Projects become user-visible. Folder authorization originates from a native picker, persists in a renderer-inaccessible native binding registry, and produces window/project/root-generation-bound runtime capabilities. Remove unrestricted renderer filesystem and shell bypasses. Project mutation remains dark until Phase 5.

## Requirements

### Functional

- Native picker authorizes and records one directory binding for a Project ID.
- Restore/relink works only from the native trusted binding record, never renderer storage alone.
- Runtime capability binds project ID, root identity/generation, and owner window.
- Capability-relative native APIs return structured errors and support revocation/cancellation.
- Replace broad renderer `fs:*` and `execute_command` callers with narrow native operations.

### Non-Functional

- Prevent traversal, symlink/junction/reparse escape and check/use races.
- Capability IDs are cryptographically random, runtime-only, and revoked on close/relink/disable.
- Main window owns privileged workspace capabilities in MVP; Quick cannot mutate/read project files.
- Web/mobile fail closed.
- No enabled feature combination exposes unconditional overwrite/delete or generic shell.

## Architecture

```text
Native folder picker(projectId, main-window)
  -> private native ProjectBinding record
  -> root directory handle + identity + generation
  -> opaque runtime capability
  -> handle-relative read/metadata operations
```

### Authority Model

1. Renderer may request `pickAndBindProject(projectId)` but cannot submit a root path as authority.
2. Native private storage records the picker-authorized root identity and category trust; renderer cannot edit it through generic filesystem IPC.
3. Restart uses `restoreProjectBinding(projectId)`, which reopens and verifies that native record.
4. Capability state holds a validated root handle, project ID, owner window, generation, cancellation token, and revocation flag.
5. Operations traverse relative to validated handles. Canonicalize-then-use path checks alone are insufficient.
6. Unix implementation uses proven descriptor-relative/no-follow primitives; Windows uses handles, reparse-point rejection, and final volume/file identity checks. Research `cap-std`/`rustix`/Windows APIs before locking dependency. Unsupported secure primitives fail closed or read-only.
7. Mutations use the final Phase 5 revision-bearing contract but remain feature-disabled until Phase 5.
8. Generic terminal is not a workspace sandbox. Disable project shell in this MVP; future sandboxed/OS-native-approved command execution is separate scope.

### Native Contracts

```ts
pickAndBindProject(projectId: string): Promise<WorkspaceDescriptor | null>
restoreProjectBinding(projectId: string): Promise<WorkspaceDescriptor>
revokeProjectBinding(projectId: string): Promise<void>
relinkProject(projectId: string): Promise<WorkspaceDescriptor | null>
readWorkspaceFile(capabilityId: string, relativePath: string): Promise<WorkspaceReadResult>
```

Final mutation shapes are declared now but cannot be enabled before Phase 5:

```ts
createWorkspaceFile(capabilityId, path, { content, mode: 'create' | 'overwrite', expectedRevision? })
editWorkspaceFile(capabilityId, path, { oldString, newString, expectedRevision })
deleteWorkspaceFile(capabilityId, path, { expectedRevision })
```

### Broad IPC Replacement

| Existing broad surface | Known callers | Replacement |
|---|---|---|
| `fs:read-file` | Workspace tools, Codex auth settings | Capability read; narrow `codex:read-auth-config` broker |
| `fs:write-file` / `fs:delete-file` | Workspace tools | Capability mutations, disabled until Phase 5 |
| `execute_command` | Terminal tool, yt-dlp install | Disable project terminal; narrow native video installer operation |
| `skills:scan`, `commands:scan` | Global/project scanners | Native-known global roots or capability-relative project scan |
| `hooks:read-configs`, `hooks:run-shell` | Project automation | Capability-relative config read; project shell hooks remain disabled in this MVP |

Directory Project flags must remain off until unrestricted renderer channels are removed/rejected and all known callers are brokered.

## File Inventory

| Action | File | Purpose | Test impact |
|---|---|---|---|
| Create | `src-tauri/src/workspace.rs` | Binding registry, handles, capabilities, revocation, secure reads, Rust tests | New security suite |
| Modify | `src-tauri/src/lib.rs` | Register state; narrow channels; reject/remove broad channels | IPC regression |
| Modify | `src-tauri/Cargo.toml` | Add handle-relative crate only after spike | Cargo build |
| Modify | `src/renderer/platform/interfaces.ts` | Picker/binding/capability contracts and narrow brokers | All platform classes |
| Modify | `src/renderer/platform/desktop_platform.ts` | Implement narrow IPC | Platform tests |
| Modify | `src/renderer/platform/web_platform.ts` | Explicit unsupported behavior | Regression |
| Modify | `src/renderer/platform/test_platform.ts` | Deterministic binding fixtures | Unit |
| Modify | `src/renderer/packages/model-calls/toolsets/file.ts` | Disable mutation until Phase 5; capability reads only | Tool tests |
| Modify | `src/renderer/packages/model-calls/toolsets/terminal.ts` | Disable Project terminal and remove sandbox claim | Tool tests |
| Modify | `src/renderer/packages/model-calls/stream-text.ts` | Fail closed when secure capabilities/mutation gate unavailable | Model-call tests |
| Modify | `src/renderer/packages/tools/workspace-path.ts` | UX-only helper documentation | Existing tests |
| Modify | `src/renderer/packages/tools/workspace-path.test.ts` | Retain lexical UI tests, not security proof | Unit |
| Modify | `src/renderer/packages/model-calls/agent-coding-tools.test.ts` | Capability/read-only gates | Unit |
| Modify | `src/renderer/components/settings/OpenAICodexAuthSection.tsx` | Use narrow Codex auth broker | Settings tests |
| Modify | `src/renderer/packages/video-url/desktop/yt-dlp-install.ts` | Use narrow installer operation | Video tests |
| Modify | `src/renderer/packages/skills/discover-agent-skills.ts` | Capability-relative Project scan | Scan tests |
| Modify | `src/renderer/packages/commands/discover-agent-commands.ts` | Capability-relative Project scan | Scan tests |
| Modify | `src/renderer/packages/hooks/discover-agent-hooks.ts` | Capability-relative config read | Hook tests |
| Modify | `src/renderer/packages/hooks/executor.ts` | Block project shell hooks pending trust/approval | Hook tests |
| Modify | `src/renderer/packages/hooks/shell-runner.ts` | Remove generic shell route/fail closed | Hook tests |

## Function and Interface Checklist

- [ ] Native private `ProjectBinding` registry inaccessible through renderer file APIs.
- [ ] `WorkspaceCapabilityId` random and bound to project/window/root generation.
- [ ] Root handle and filesystem identity retained in capability state.
- [ ] Operation lease, cancellation token, revocation flag, and per-root mutation lock defined now.
- [ ] Revocation waits/cancels in-flight side effects and cannot deadlock.
- [ ] Descriptor-relative/no-follow traversal chosen per OS with fail-closed fallback.
- [ ] Stable errors: `UNAUTHORIZED_ROOT`, `OUTSIDE_ROOT`, `SYMLINK_ESCAPE`, `STALE_CAPABILITY`, `WRONG_WINDOW`, `REVOKED`, `PERMISSION_DENIED`, `UNSUPPORTED_PLATFORM`.
- [ ] Broad filesystem/shell channels removed or unavailable to renderer.
- [ ] Project shell and shell hooks disabled under directory Project flags.

## Test Scenario Matrix

| Priority | Scenario | Expected result |
|---|---|---|
| Critical | Direct request to authorize `/`, home, UNC, arbitrary path | Rejected without native picker/trust record |
| Critical | Tamper renderer `MyProjects` path then restart | Cannot mint capability |
| Critical | Capability used by Quick/other Project/window | `WRONG_WINDOW` |
| Critical | Ancestor/final target swapped with symlink/junction during operation | No outside-root access |
| Critical | Broad `fs:*` or `execute_command` from renderer | Unavailable/rejected |
| Critical | Revoke paused operation before side effect | No commit/read result accepted |
| High | Root replaced/relinked after issue | Old generation becomes stale |
| High | Real process restart | Old capabilities absent; binding reverified |
| High | Unsupported secure OS primitive | Read-only/fail closed, no path fallback |
| Medium | Valid nested read/metadata | Allowed |
| Medium | Web/mobile/Quick privileged request | Unsupported |

## Dependency Map

- Uses existing `rfd`, Platform abstraction, IPC, scanners, settings and video installer callers.
- Blocks all directory Project exposure in Phases 2-6.
- Phase 5 fills final mutation implementation; Phase 1 supplies lock/revocation/security primitives.
- Does not depend on Project renderer persistence or explorer UI.

## Implementation Steps

1. Write threat-model tests and a short OS primitive spike; select handle-relative approach.
2. Create native private binding registry and picker-owned authorization flow.
3. Add capability state bound to project/window/root generation with revocation leases.
4. Implement secure relative read/metadata primitives and race tests.
5. Define final revision-bearing mutation IPC but hard-disable it.
6. Inventory every broad filesystem/shell/scanner caller; replace with narrow broker or capability API.
7. Remove/reject unrestricted renderer channels before feature enablement.
8. Disable project terminal and project shell hooks; correct all UX promises.
9. Add platform contracts and fail-closed Web/Test implementations.
10. Run Rust security tests, focused Vitest, type-check, and renderer build.

## Success Criteria

- [ ] Root authorization can originate only from native picker or native trusted binding restore.
- [ ] Renderer storage tampering cannot mint access.
- [ ] Handle-relative race tests pass or platform fails closed.
- [ ] Capabilities are project/window/generation-bound and revocable in flight.
- [ ] No renderer-accessible unrestricted file or shell bypass remains before directory flags enable.
- [ ] No mutation or project shell is enabled before later gates.
- [ ] Attachment tools and narrow app-internal operations still work.
- [ ] `pnpm check`, focused tests, renderer build, and `cargo test` pass against branch baseline.

## Risk Assessment

- **Critical:** OS-specific secure traversal. Spike first; fail closed where proof is unavailable.
- **Critical:** hidden broad callers. Contract inventory is a production gate.
- **High:** private binding storage migration/corruption. Version, checksum, recover via relink.
- **High:** existing terminal regression. Product scope prioritizes truthful safety; document deferred command execution.

## Security Considerations

Capability IDs are bearer secrets but not sufficient alone: backend verifies owner window, project, generation and live binding. Never log token/root/content. Native approval/trust cannot be inferred from renderer state.

## Rollback Strategy

Keep directory Projects disabled and use chat-only Projects. Read-only legacy sessions remain available, but agent filesystem mutation and generic shell must not fall back to broad IPC.
