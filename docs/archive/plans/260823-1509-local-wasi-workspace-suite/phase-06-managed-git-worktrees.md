---
phase: 6
title: "Managed Git Worktrees"
status: pending
priority: P2
dependencies: [3, 4]
effort: "10-15 days including security spike"
---

# Phase 6: Managed Git Worktrees

## Context Links

- [Plan](./plan.md)
- [Phase 3](./phase-03-read-only-source-control.md)
- [Phase 4](./phase-04-stage-review-and-apply.md)

## Overview

Add optional app-owned Git worktrees for isolated parallel sessions/runs. Worktrees live only under Chaeboxi app data, receive independent checkout capabilities, and never authorize or delete picker-owned roots. This phase is conditional on a hostile-repository checkout spike.

## Requirements

- Stable native `repositoryId` and `checkoutId`; portable Projects remain path-free.
- App generates destination below one private worktree root; renderer supplies no path.
- Maximum 3 worktrees/repository, 8 process-wide; configurable disk quota and TTL.
- One writable checkout owner at a time.
- Repository-mutating operations serialized by repository identity.
- Dirty/untracked worktrees retained and surfaced; never auto-deleted.
- Startup reconciles registry, filesystem, and `git worktree list --porcelain`.
- No remote Git, credentials, branch force, user-supplied refs/Git args, or picker-root deletion.
- Promotion path: selected worktree changes are reviewed and applied to the picker-owned checkout through Phase 4, or exported; worktrees never silently merge.

## Security Feasibility Gate

Compare and select one checkout mechanism:

1. `git worktree add --no-checkout` plus safe library checkout.
2. Selected `gix` checkout primitives.
3. `git2` with verified filters/hooks disabled.
4. OS-sandboxed fixed Git checkout.

Must prove the complete create/register/checkout/status/promote/remove/prune lifecycle cannot execute repository-controlled hooks, clean/smudge/process filters, credential helpers, external commands, unsafe protocols, submodule actions, alternates escapes, or tracked symlink escapes. A plain `git worktree add` implementation is NO-GO until this gate passes.

## Architecture

```text
NativeRepositoryRecord
  ├─ repositoryId + common-dir identity
  ├─ picker checkout (never app-deleted)
  └─ NativeCheckoutRecord[]
       ├─ checkoutId
       ├─ app-managed root identity + generation
       ├─ owner session/run
       ├─ branch/commit state
       └─ clean/dirty/orphaned/recovery status
```

Switching checkout revokes the prior session capability, clears context drafts/reviews, and issues a capability for the selected checkout.

## File Inventory

| Action | File | Change | Test impact |
|---|---|---|---|
| Create | `src/shared/types/worktrees.ts` | Checkout/lifecycle/result schemas | Schema tests |
| Create | `src-tauri/src/workspace/worktree_registry.rs` | Versioned native records/persistence | Recovery tests |
| Create | `src-tauri/src/workspace/managed_worktrees.rs` | Create/list/assign/remove/prune | Security tests |
| Create | `src-tauri/src/workspace/worktree_tests.rs` | Hostile repo/crash/quota fixtures | Cargo test |
| Create | `src/renderer/hooks/useManagedCheckouts.ts` | Checkout lifecycle/cancel | Hook tests |
| Create | `src/renderer/components/project/CheckoutSwitcher.tsx` | Switch/create/recover UI | Component tests |
| Create | `src/renderer/components/project/CheckoutSwitcher.test.tsx` | Dirty/error/a11y states | Vitest |
| Modify | `src-tauri/src/workspace/authority.rs` | Repository/checkout capability binding | Rust tests |
| Modify | `src-tauri/src/workspace/source_control.rs` | Checkout-scoped status | SCM tests |
| Modify | `src-tauri/src/workspace/mod.rs` | Worktree channels | IPC tests |
| Modify | `src-tauri/src/lib.rs` | Startup reconciliation and cleanup | Integration |
| Modify | `src-tauri/Cargo.toml` | Add chosen checkout dependency only after gate | Build matrix |
| Modify | `src-tauri/Cargo.lock` | Lock chosen library | Reproducibility |
| Modify | `src/renderer/platform/interfaces.ts` | Managed checkout methods | Platform tests |
| Modify | `src/renderer/platform/desktop_platform.ts` | Native adapter | Platform tests |
| Modify | `src/renderer/components/project/ProjectContextPanel.tsx` | Checkout switcher placement | UI tests |
| Modify | `src/renderer/stores/session/generation.ts` | Active checkout context | Generation tests |
| Modify | `docs/project-workspaces.md` | Worktree ownership and recovery | Docs |

## Interface Checklist

- [ ] `listManagedCheckouts(capabilityId)`.
- [ ] `listCheckoutSources(capabilityId)` returns opaque native branch/commit IDs.
- [ ] `prepareManagedCheckout(capabilityId, sourceId)` accepts only broker-issued opaque identity.
- [ ] `createManagedCheckout(planId, oneUseCreationTicket)`.
- [ ] `assignManagedCheckout(checkoutId, sessionId)`.
- [ ] `inspectManagedCheckout(checkoutId)` returns dirty/size/owner state.
- [ ] `prepareCheckoutPromotion(checkoutId, selectedChangeIds)` produces a Phase 4 change set for the picker checkout.
- [ ] `removeManagedCheckout(checkoutId, oneUseRemovalTicket)` refuses dirty/picker-owned.
- [ ] `recoverManagedCheckouts()` runs on startup and quarantines discrepancies.

## Implementation Steps

1. Complete hostile-repository full-lifecycle spike and record selected mechanism, symlink/submodule/alternates policy, or NO-GO.
2. Version existing native binding registry to model repositories and checkouts without changing portable Project metadata.
3. Create app-private worktree root with restrictive permissions and quota accounting.
4. Enumerate source refs natively and issue opaque source IDs; implement prepare/create with one-use effect-bound tickets.
5. Mint independent root generation/capability for each managed checkout.
6. Add checkout switcher; invalidate drafts, source-control requests, approvals, and change sets on switch.
7. Add repository-level operation lock and crash-safe registry transitions.
8. Reconcile registry/filesystem/Git metadata on startup; quarantine rather than delete unknown state.
9. Implement reviewed promotion: compare worktree to picker checkout, map opaque changes to Phase 4, preflight picker revisions, then Apply or Export.
10. Implement remove only for clean, app-owned, unassigned checkouts; require explicit critical confirmation.
11. Add TTL cleanup for clean idle worktrees and user recovery for dirty/orphaned entries.

## Test Scenario Matrix

| Priority | Scenario | Expected |
|---|---|---|
| Critical | Hostile hook/filter/config | No external code executes |
| Critical | Destination traversal/symlink | Cannot leave app-managed root |
| Critical | Remove picker-owned checkout | Rejected |
| Critical | Remove dirty/untracked checkout | Rejected and recovery shown |
| High | Crash during create/remove | Startup reconciles/quarantines |
| High | Two sessions assign same writable checkout | One owner; second rejected |
| High | Shared repository mutation race | Serialized by repository ID |
| High | Worktree `.git` points to common dir | Native handles internally; renderer cannot read it |
| Critical | Malicious ref syntax/leading dash | Renderer only uses opaque source ID |
| Critical | Promote changed worktree to main | Phase 4 review/conflict checks; no silent merge |
| High | Submodule/alternates/tracked symlink fixture | Rejected or safely contained per recorded policy |
| Medium | Quota/TTL reached | Clear user action; no silent data loss |

## Dependency Map

- Depends on Phase 3 repository/checkout identity.
- Depends on Phase 4 recovery and reviewed mutation semantics.
- Independent of Phase 5 runtime; future runs may opt into a managed checkout.
- Blocks final production rollout in Phase 7 only when feature flag is enabled.

## Success Criteria

- [ ] Security feasibility gate passes or feature remains disabled with documented NO-GO.
- [ ] Every managed worktree has independent identity, owner, generation, and capability.
- [ ] No renderer path chooses a worktree destination.
- [ ] Dirty or picker-owned data cannot be automatically deleted.
- [ ] Crash recovery leaves users with recoverable state.
- [ ] Source Control correctly scopes status to active checkout.
- [ ] User can create → edit → review/promote or export → safely remove.

## Risk Assessment

- **Repository-controlled execution:** primary gate; no workaround.
- **Disk growth:** strict quotas, TTL, size UI, no automatic dependency caches.
- **Shared Git metadata corruption:** repository lock and conservative recovery.
- **User confusion:** clearly label Main folder versus Isolated checkout.

## Security Considerations

Git worktrees share repository metadata and history. Authorization of one checkout does not authorize arbitrary sibling roots; only native repository internals may follow linked metadata.
