# Architecture Findings

## Summary

Chaeboxi already has the correct base: native-picker bindings, opaque root capabilities, main-window ownership, root generations, hard-deny policy, no-follow traversal on Unix, revision-aware mutations, and disabled generic shell. The new suite should extend this boundary, not reopen broad filesystem or command IPC.

## Existing Strengths

- `docs/project-workspaces.md`: portable Project metadata does not authorize filesystem roots.
- `src-tauri/src/workspace/authority.rs`: project/window/generation capabilities.
- `src-tauri/src/workspace/traverse.rs`: Unix `openat(O_NOFOLLOW)` traversal.
- `src-tauri/src/workspace/ignore.rs`: `.git`, environment files, keys, and credential roots hard denied.
- `src/renderer/platform/desktop_platform.ts`: generic shell and broad filesystem APIs reject.
- `src/shared/types/workspace.ts`: typed descriptors, revisions, mutations, trust categories, rollout flags.

## Gaps That Block New Privileges

- Listing reads complete files to calculate revisions.
- Search is synchronous and insufficiently budgeted; cancellation state is incomplete.
- Renderer can synchronize a global native mutation flag.
- Capability restore on focus can mint duplicates.
- Windows traversal is weaker than Unix against root/junction replacement.
- Agent file tools directly mutate after renderer approval; no staged review boundary.
- Desktop Project export has no native picker-owned capability flow.
- No local Git broker, repository identity, execution runtime, or managed worktree registry exists.
- Product copy still mentions terminal availability although generic terminal is disabled.

## Architectural Separation

Keep separate native authorities/contracts:

1. Workspace files: picker binding, list/read/search.
2. Native export: one-time save destination.
3. Source control: fixed read-only Git operations only after per-operation hostile helper/filter gates; unsafe operations use a non-executing library or remain disabled.
4. Change sets: stage/review/apply.
5. Local execution: Wasmtime run tickets and explicit app-private snapshot/scratch preopens; no ambient host/application capability.
6. Managed worktrees: app-owned checkout lifecycle.

Do not create a generic “workspace command” broker.

## Scalability Limits

- 2 concurrent jobs/project; 4 process-wide.
- Tree page 200 entries; no full-content hashing during listing.
- Search 10,000 entries / 100 MiB / 100 hits / depth 64 / 2-second initial budget.
- SCM status 5 seconds / 5,000 changes; diff 2 MiB or 10,000 lines; log 100/page.
- Quick Run 1/window / 2 process-wide / 5 seconds / 64 MiB / bounded streams.
- Worktrees 3/repository / 8 global with quota, TTL, and dirty retention.

## Product Taxonomy

- Project: chat grouping.
- Project Files / Project Explorer: authorized folder.
- Source Control: Git state.
- Change Review: proposed mutations.
- Quick Local Run: supported embedded execution.
- Isolated Checkout: app-managed worktree.
- Artifact Studio: generated preview.
- Export / Save As: explicit data movement outside Chaeboxi.

## Deferred

Remote sandbox, Docker/Podman, generic terminal, full builds, package installation, remote Git, credentials, semantic repository indexing, and web/mobile filesystem parity.

## Unresolved Questions

None. High-risk runtime and worktree choices are conditional implementation gates, not assumptions.
