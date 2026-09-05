# Scout Summary

## Scope

Deep read-only scan across workspace Rust authority, renderer platform/tool approval paths, Project Explorer, export behavior, Git absence, Cargo dependencies, and test inventory.

## Main Findings

- Workspace foundation exists and should be reused.
- Security/performance hardening is prerequisite to Git and execution.
- Source control should begin as a narrow read-only Git CLI broker.
- Direct model file mutation should become native staged change sets.
- Wasmtime alone does not help non-technical users; bundle a gated JavaScript WASI profile.
- Managed worktrees require an explicit hostile-repository checkout gate.
- Existing desktop `zip` and `rfd` dependencies support native safe export.
- Current test inventory is thin for new privilege boundaries; each phase includes Rust, Vitest, integration, platform, and manual matrices.

## Existing Relevant Tests

- `src-tauri/src/workspace/tests.rs`
- `src/renderer/packages/model-calls/toolsets/workspace-edit.test.ts`
- `src/renderer/packages/model-calls/wrap-tools-approval.test.ts`
- `src/renderer/platform/workspace-platform.test.ts`
- `src/renderer/projects/project-context*.test.ts`
- `test/integration/project-workspace/project-workspace.test.ts`

## Plan Decision

Seven phases with independent flags. Phase 2 and Phase 3 may run in parallel after authority hardening. Quick Run and worktrees each contain a NO-GO feasibility gate. Remote execution, Docker, terminal, package installs, and remote Git remain outside scope.

## Unresolved Questions

None.
