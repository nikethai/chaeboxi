---
phase: 4
title: "Stage Review and Apply"
status: pending
priority: P1
dependencies: [1]
effort: "7-10 days"
---

# Phase 4: Stage Review and Apply

## Context Links

- [Plan](./plan.md)
- [`file.ts`](../../src/renderer/packages/model-calls/toolsets/file.ts)
- [`wrap-tools-approval.ts`](../../src/renderer/packages/model-calls/wrap-tools-approval.ts)
- [`workspace-edit.test.ts`](../../src/renderer/packages/model-calls/toolsets/workspace-edit.test.ts)

## Overview

Replace direct model-driven project mutation with native staged change sets. “Run” may inspect and propose; only explicit Change Review “Apply selected” mutates Project Files. This phase becomes the common write path for ordinary agent edits, WASI output, and future worktrees.

## Requirements

- Create/edit/delete tools stage changes, never directly apply during model execution.
- Native lifecycle is explicit: begin → append → seal → review → preflight → apply/discard.
- Change set stores base/virtual revisions, normalized final operations, dependencies, digest, generation, expiry, quotas, and session/window ownership.
- Review shows create/modify/delete, compact diff, binary/large summaries, conflicts, and selected operations.
- Apply performs complete preflight, serializes per root, rechecks capability, then applies selected operations.
- Use app-private fsynced apply journal for crash recovery; report partial apply honestly and do not claim cross-file atomicity.
- Capabilities, full source/diffs, native paths, and pending payloads never enter synced/exported session data.
- Delete/overwrite cannot receive session-wide approval.

## Architecture

```text
Agent turn → changes:begin
  → changes:append(changeSetId, operation) against virtual overlay
  → changes:seal(changeSetId) → digest + dependency graph
  → Change Review → changes:preflight
  → renderer user confirmation (model-safety boundary)
  → native scoped one-use apply ticket
  → changes:apply(ticket, selected operation IDs)
  → fsynced journal → applied / conflict / partial / recovery-required
```

Native tickets prevent tamper/replay and bind effect scope; they do not prove a trustworthy UI against a compromised renderer. Chaeboxi’s current threat model remains single-user desktop.

## File Inventory

| Action | File | Change | Test impact |
|---|---|---|---|
| Create | `src/shared/types/workspace-changes.ts` | Change-set schemas | Schema tests |
| Create | `src-tauri/src/workspace/change_set.rs` | Begin/append/seal/overlay/preflight/apply | Rust tests |
| Create | `src-tauri/src/workspace/apply_journal.rs` | Fsynced state transitions and startup recovery | Crash tests |
| Create | `src-tauri/src/workspace/change_set_tests.rs` | Conflict/idempotency/race fixtures | Cargo test |
| Create | `src/renderer/stores/projectChangeSetStore.ts` | Ephemeral review state | Store tests |
| Create | `src/renderer/stores/projectChangeSetStore.test.ts` | Lifecycle/privacy tests | Vitest |
| Create | `src/renderer/components/project/ProjectChangeReview.tsx` | Review/apply UI | Component tests |
| Create | `src/renderer/components/project/ProjectChangeDiff.tsx` | Accessible bounded diff | Component tests |
| Create | `src/renderer/components/project/ProjectChangeReview.test.tsx` | Selection/conflict/a11y | Vitest |
| Modify | `src-tauri/src/workspace/mod.rs` | Stage/review/preflight/apply channels | IPC tests |
| Modify | `src-tauri/src/workspace/authority.rs` | Apply lease and capability recheck | Rust tests |
| Modify | `src/renderer/platform/interfaces.ts` | Change-set APIs | Platform tests |
| Modify | `src/renderer/platform/desktop_platform.ts` | Native adapters | Platform tests |
| Modify | `src/renderer/packages/model-calls/toolsets/file.ts` | Direct writes → staging | Tool tests |
| Modify | `src/renderer/packages/model-calls/stream-text.ts` | Register proposal tools | Integration |
| Modify | `src/renderer/packages/model-calls/wrap-tools-approval.ts` | Separate run/propose vs apply policy | Approval tests |
| Modify | `src/renderer/packages/tools/risk-engine.ts` | Stage lower risk; Apply high/critical | Risk tests |
| Modify | `src/renderer/stores/session/generation.ts` | Remove terminal/write promises; invalidate stale reviews | Generation tests |
| Modify | `src/renderer/components/PlanApproval/PlanApproval.tsx` | “Run plan,” not “Approve & Execute” | UI tests |
| Modify | `src/renderer/components/chat/Message.tsx` | Render safe review summary | Message tests |
| Modify | `src/shared/types/session.ts` | Persist safe summary parts only | Migration/privacy tests |
| Modify | `src/renderer/lib/format-chat.tsx` | Sanitize tool payloads in exports | Export privacy tests |
| Modify | `src/renderer/packages/model-calls/toolsets/index.ts` | Exclude sensitive tools from shell lifecycle hooks | Hook tests |
| Modify | `src/shared/room-pack.ts` | Exclude native review payloads | Privacy tests |

## Interface Checklist

- [ ] `beginWorkspaceChangeSet(capabilityId, sessionId, turnId)`.
- [ ] `appendWorkspaceChange(changeSetId, operation)` updates a bounded virtual overlay.
- [ ] `sealWorkspaceChangeSet(changeSetId)` normalizes one final effect/path and dependency closure.
- [ ] `getWorkspaceChangeSet(changeSetId)` returns bounded metadata/review DTO.
- [ ] `preflightWorkspaceChangeSet(changeSetId, digest, selectedIds)`.
- [ ] `prepareWorkspaceApply(changeSetId, digest, selectedIds)` returns a one-use scoped apply ticket.
- [ ] `applyWorkspaceChangeSet(oneUseApplyTicket)`.
- [ ] `discardWorkspaceChangeSet(changeSetId)`.
- [ ] Apply ticket is native, single-use, scoped, expiring, digest/selection/effect-specific.
- [ ] App-private journal records prepare/applying/per-operation/applied/recovery states.
- [ ] Apply result lists exact applied/unapplied/conflicted operations.

## Implementation Steps

1. Add tests proving existing model tools can currently write, then invert expectation to stage-only.
2. Define begin/append/seal ownership, quotas, directory policy, and virtual overlay semantics for multiple operations on one path.
3. Normalize create→edit, edit→edit, edit→delete, duplicate paths, and selection dependency closure into deterministic final effects.
4. Persist sealed sets and apply journal in permission-restricted app-private storage; add expiry, fsync, cleanup, and startup reconciliation.
5. Compute deterministic digest over project/generation/normalized effects/dependencies/revisions.
6. Add bounded native diff summaries and binary/large-file handling.
7. Build Change Review with dependency-valid selection, conflict refresh, and accessible diff semantics.
8. Add prepare-apply ticket, full preflight, per-root serialized commit, and journal transition before every side effect.
9. Reconcile incomplete journals on startup and expose recover/inspect UX; no force overwrite.
10. Exclude staging/apply from shell lifecycle hooks and send metadata-only lifecycle events.
11. Remove stale generation copy claiming approved plans gain terminal access.
12. Add sentinel privacy tests for session JSON, Markdown/TXT/HTML exports, approvals, hooks, retries, compaction, logs, and audits.

## Test Scenario Matrix

| Priority | Scenario | Expected |
|---|---|---|
| Critical | Agent proposes edit | Original file unchanged before Apply |
| Critical | External edit after stage | Conflict; Apply disabled |
| Critical | Digest/selection tampered | Native rejection |
| Critical | Apply clicked twice | Idempotent; no duplicate change |
| Critical | Multiple edits/create→edit/edit→delete same path | Deterministic normalized overlay |
| Critical | Crash/ENOSPC/permission loss after each commit boundary | Journal recovery with exact state |
| High | Mixed create/edit/delete partial I/O failure | Exact applied/unapplied/recovery report |
| High | Relink/project switch/restart | Review invalid/expired |
| High | Secret in staged content | No content in audit/log/session export |
| Medium | Exclude one file | Only selected operations apply |
| Medium | Keyboard/screen reader review | Clear states and focus recovery |

## Dependency Map

- Depends on Phase 1 leases/error model.
- Provides reviewed output path for Phase 5.
- Provides recovery/ownership semantics for Phase 6.

## Success Criteria

- [ ] No model tool directly mutates Project Files.
- [ ] User sees exact proposed effects before Apply.
- [ ] Native Apply requires a valid scoped single-use apply ticket.
- [ ] Conflicts never overwrite external edits.
- [ ] Partial results survive restart and remain recoverable/truthfully reported.
- [ ] Sensitive bytes never persist in sessions, exports, approvals, hooks, retries, or logs.
- [ ] Sensitive change payloads stay out of portable data and logs.

## Risk Assessment

- **Large behavior change:** feature flag and regression tests; stage-only rollout before Apply.
- **User friction:** group safe edits in one review while preserving file selection.
- **False atomicity:** document preflight + sequential commit semantics explicitly.

## Security Considerations

Renderer approval alone is insufficient. Native apply validates approval scope, capability, generation, digest, revisions, and selected operation IDs immediately before side effects.
