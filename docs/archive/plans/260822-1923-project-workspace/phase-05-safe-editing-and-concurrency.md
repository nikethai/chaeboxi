---
phase: 5
title: "Safe Editing and Concurrency"
status: pending
priority: P1
dependencies: [4]
effort: "5-7 engineering days"
---

# Phase 5: Safe Editing and Concurrency

## Overview

Implement the final revision-bearing mutation contracts declared in Phase 1. Prevent silent overwrite when users, IDEs or another chat change a file. Mutations run relative to the same validated parent handle, serialize per root, and use same-directory temporary replacement where supported.

## Requirements

### Functional

- Reads return authoritative revision token.
- Edit/delete require expected revision.
- Create distinguishes `create` from explicit `overwrite`.
- Native replacement validates exactly one `oldString` match.
- Conflict results are structured and recoverable.
- Mutation UI shows concrete path, effect and compact diff/size before approval.

### Non-Functional

- Failed write preserves original target and cleans temp file.
- Revision comparison and replacement occur under same root lock/validated parent handle.
- Capability revocation cancels/waits before commit.
- No session-wide approval for delete/overwrite or future shell.

## Architecture

```text
Read -> {content, revision}
Mutation intent -> native dry-run summary
  -> concrete approval fingerprint
  -> acquire root operation lease
  -> validated parent handle
  -> compare revision
  -> temp write + flush + atomic replace
  -> new revision
```

```ts
type WorkspaceMutationResult =
  | { ok: true; revision: string }
  | { ok: false; code: 'CONFLICT' | 'NOT_FOUND' | 'ALREADY_EXISTS' | 'AMBIGUOUS_EDIT' | 'REVOKED' }
```

Concurrency scope is operation-level serialization plus optimistic revisions. Worktrees, background agents and long-lived writer leases are deferred.

## File Inventory

| Action | File | Purpose | Test impact |
|---|---|---|---|
| Modify | `src-tauri/src/workspace.rs` | Native create/edit/delete, revision, atomic replace | Rust security/concurrency |
| Modify | `src-tauri/src/lib.rs` | Enable final mutation channels behind flag | IPC/manual |
| Modify | `src/renderer/platform/interfaces.ts` | Final mutation/dry-run contracts | Type-check |
| Modify | `src/renderer/platform/desktop_platform.ts` | Mutation adapter | Unit |
| Modify | `src/renderer/platform/test_platform.ts` | Conflict/revocation fixtures | Tool tests |
| Modify | `src/renderer/packages/model-calls/toolsets/file.ts` | Revision schemas and conflict recovery | Tool tests |
| Create | `src/renderer/packages/model-calls/toolsets/workspace-edit.test.ts` | Mutation behavior matrix | Unit |
| Modify | `src/renderer/packages/model-calls/agent-coding-tools.test.ts` | Mutations register only after gate | Regression |
| Modify | `src/renderer/packages/tools/risk-engine.ts` | Classify concrete operation effect | Risk tests |
| Modify | `src/renderer/packages/tools/risk-engine.test.ts` | Delete/overwrite escalation | Unit |
| Modify | `src/renderer/packages/model-calls/stream-text.ts` | Approval fingerprint/project generation/expiry | Approval tests |
| Modify | `src/renderer/packages/model-calls/wrap-tools-approval.test.ts` | No destructive session-auto approval | Unit |
| Modify | `src/renderer/stores/toolApprovalStore.ts` | Expiry/invalidation/redaction | Store tests |

## Function and Interface Checklist

- [ ] Content revision strategy documented and size-capped.
- [ ] Native dry-run returns operation summary without mutation.
- [ ] Create mode rejects overwrite unless explicit.
- [ ] Edit runs replacement natively and rejects zero/multiple matches.
- [ ] Delete requires expected revision.
- [ ] Root lock, operation lease and revocation flag cover compare through commit.
- [ ] Temp file same directory; flush/replace/cleanup platform behavior tested.
- [ ] Approval fingerprint includes normalized operation, project/root generation, relative path, effect, revision and expiry.
- [ ] Project switch/relink/restart invalidates approval.
- [ ] Conflict instructs reread; no blind automatic retry.

## Test Scenario Matrix

| Priority | Scenario | Expected result |
|---|---|---|
| Critical | External edit after read | `CONFLICT`, external content retained |
| Critical | Target/ancestor swapped before commit | Rejected; no outside-root effect |
| Critical | Revoke while paused before commit | No commit |
| Critical | Approval args/effect changes | Fresh approval required |
| Critical | Atomic replace failure | Original intact, temp cleaned |
| High | Duplicate `oldString` | `AMBIGUOUS_EDIT` |
| High | Concurrent create | One succeeds, one conflict |
| High | Delete stale revision | Conflict; file retained |
| High | Restart/relink | Old approvals and revisions invalid |
| Medium | Valid edit | New revision returned and cache invalidated |

## Dependency Map

- Requires Phase 4 revision reads and Phase 1 handle/lease/revocation primitives.
- Blocks production mutation enablement in Phase 6.
- Does not add terminal, Git, worktree, PTY or background execution.

## Implementation Steps

1. Write failing native tests for stale, ambiguous, swap-race, revocation and atomic failure cases.
2. Implement revision and dry-run summary under native authority.
3. Implement native create/edit/delete using validated handles and root lock.
4. Add same-directory temp/flush/atomic replacement per OS; fail read-only if safe replacement unavailable.
5. Wire final platform/tool schemas and conflict recovery.
6. Add concrete approval fingerprint, expiry, redacted audit and invalidation.
7. Remove destructive session-wide approvals.
8. Enable mutation flag only after native, tool, risk and approval matrices pass.
9. Run cross-platform mutation verification.

## Success Criteria

- [ ] No enabled path performs unconditional renderer read-modify-write.
- [ ] Stale edits/deletes never silently overwrite user changes.
- [ ] Failed mutation leaves original intact.
- [ ] Boundary and revocation checks cover compare through commit.
- [ ] Concrete effect changes receive fresh approval.
- [ ] Valid mutation returns revision and invalidates explorer cache.
- [ ] Mutation feature remains independently disableable.

## Risk Assessment

- **High:** Windows replacement semantics. Platform implementation and read-only fallback.
- **High:** hashing expense. Hash only selected/mutated capped text files.
- **High:** approval fatigue. Concise diff/effect without blanket destructive approval.

## Security Considerations

Native authority, optimistic concurrency and approval address different threats. One does not substitute for another. Shell remains disabled/deferred in this plan.

## Rollback Strategy

Disable mutation flag and retain read-only context. Never fall back to broad `fs:*`, unconditional write or renderer replacement.
