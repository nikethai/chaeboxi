---
phase: 7
title: "Rollout and Documentation"
status: pending
priority: P1
dependencies: [2, 3, 4]
effort: "5-7 days"
---

# Phase 7: Rollout and Documentation

## Context Links

- [Plan](./plan.md)
- [`docs/system-architecture.md`](../../docs/system-architecture.md)
- [`docs/project-workspaces.md`](../../docs/project-workspaces.md)
- [`docs/design-guidelines.md`](../../docs/design-guidelines.md)

## Overview

Integrate the suite behind independent kill switches, standardize product terminology, complete desktop/platform validation, document limitations, and define rollback/measurement gates. Worktree rollout may remain disabled if its feasibility gate fails; safer phases ship independently.

## Requirements

- Independent native rollout bits are established in Phase 1; this phase finalizes exposure and defaults for explorer, export, SCM read, staging, apply, Quick Run, and managed worktrees.
- Desktop capability discovery exposes unavailable reasons.
- Web/mobile/Quick hide privileged controls and fail closed on direct calls.
- Product terminology:
  - Project
  - Project Files / Project Explorer
  - Source Control
  - Change Review
  - Quick Local Run
  - Isolated Checkout
  - Artifact Studio
  - Export / Save As
- No promise of terminal, Node, npm, Python, full build, or cloud sandbox.
- Rollback never restores broad `fs:*` or `execute_command`.

## Architecture

```text
Capability discovery + feature flags
  → progressive exposure
  → structured local metrics/log IDs only
  → per-capability rollback
  → chat-only fallback
```

No product telemetry is required. Local diagnostic counters may track duration, counts, truncation, cancellation, and cleanup failures without paths/source/commands.

## File Inventory

| Action | File | Change | Test impact |
|---|---|---|---|
| Modify | `src/shared/types/workspace.ts` | Final independent flags/capabilities | Schema tests |
| Modify | `src/shared/types/session.ts` | Final portable-data exclusions/migration | Privacy tests |
| Modify | `src/renderer/lib/format-chat.tsx` | Final export redaction coverage | Export tests |
| Modify | `src/renderer/projects/flags.ts` | Fail-closed rollout resolution | Flag tests |
| Modify | `src/renderer/platform/capabilities.ts` | Availability/reason matrix | Capability tests |
| Modify | `src/renderer/platform/capabilities.test.ts` | Desktop/web/mobile matrix | Vitest |
| Modify | `src/renderer/platform/workspace-platform.test.ts` | Direct-call fail-closed coverage | Vitest |
| Modify | `src/renderer/components/project/ProjectContextPanel.tsx` | Final tabs/actions/taxonomy | UI tests |
| Modify | `src/renderer/components/project/WorkspaceHeaderControls.tsx` | User copy to Project Files | UI tests |
| Modify | `src/renderer/components/workspace/WorkspacePanel.tsx` | Keep Artifact Studio user copy distinct | UI tests |
| Modify | `src/renderer/i18n/locales/en/translation.json` | English source copy | Key scan |
| Modify | `src/renderer/i18n/for-key-scan.ts` | New static keys | Build |
| Modify | `test/integration/project-workspace/project-workspace.test.ts` | Full lifecycle | Integration |
| Create | `test/integration/project-workspace/project-change-review.test.ts` | Stage/apply flow | Integration |
| Create | `test/integration/project-workspace/local-wasi-run.test.ts` | Run/cancel/review | Integration |
| Create | `test/integration/project-workspace/source-control-worktrees.test.ts` | SCM/worktree gating | Integration |
| Modify | `docs/project-workspaces.md` | Complete feature contract | Docs |
| Modify | `docs/system-architecture.md` | Authorities/data flows/security | Docs |
| Modify | `docs/codebase-summary.md` | New modules and capabilities | Docs |
| Modify | `docs/project-overview-pdr.md` | Product inventory/limitations | Docs |
| Modify | `docs/design-guidelines.md` | Workspace suite IA/a11y | Docs |
| Modify | `docs/testing.md` | Fixture/security matrix | Docs |
| Modify | `README.md` | Accurate feature summary | Docs |
| Modify | `AGENTS.md` | Contributor architecture | Docs |

## Interface Checklist

- [ ] Capability response distinguishes unsupported, disabled, unavailable dependency, and ready.
- [ ] Each subsystem can be disabled/revoked independently.
- [ ] Local diagnostics redact paths, source, diffs, refs, commit messages, and stdin.
- [ ] Portable export/sync excludes capabilities, repository IDs, checkout IDs, run IDs, native paths, and pending change payloads.

## Implementation Steps

1. Add final capability/flag matrix with default-off high-risk features.
2. Standardize labels and help copy; retain internal `workspace` term only for native authority where renaming adds no value.
3. Build safe-suite lifecycle tests: bind → browse → SCM → stage → review → export/apply → revoke. Add separate conditional Quick Run and worktree lifecycle suites only when their gates pass.
4. Run adversarial native suites on macOS, Windows, and Linux.
5. Verify Wasmtime/checkout crates are not compiled or linked for Android/iOS using target-specific `cargo tree` and mobile builds; lockfile changes are expected.
6. Verify web/mobile renderer builds and direct calls fail closed.
7. Update docs and remove stale promises of terminal execution.
8. Define staged rollout and rollback gates.
9. Measure local p95 operation durations and cleanup failures during internal beta.
10. Complete whole-plan acceptance audit before default enablement.

## Rollout Gates

| Gate | Enablement |
|---|---|
| A | Phase 1 authority hardening only |
| B | Explorer + native export internal beta |
| C | Read-only SCM beta |
| D | Stage-only agent changes |
| E | Apply after conflict/recovery matrix passes |
| F (optional) | Quick Run after feasibility/security/package gates pass |
| G (optional) | Managed worktrees after hostile full-lifecycle and recovery gates pass |
| H | Default-on only after one compatibility release without P0/P1 regressions |

## Test Scenario Matrix

| Priority | Scenario | Expected |
|---|---|---|
| Critical | Disable feature during active operation | Cancel/revoke/cleanup |
| Critical | Export/session/room-pack privacy | No native identifiers/content leaks |
| High | Desktop dependency unavailable | Clear reason and safe fallback |
| High | Web/mobile direct invocation | Unsupported; no crash |
| High | Feature rollback | Chat-only Project remains usable |
| Medium | High zoom/keyboard/reduced motion | Full task completion |
| Medium | Dark/light/narrow layout | No hidden critical controls |

## Dependency Map

- Safe-suite rollout requires Phases 2-4.
- Phase 5 and Phase 6 are optional capability gates; either may remain NO-GO and disabled without blocking other rollout.
- No dependency on remote services or Docker.

## Success Criteria

- [ ] Terminology is consistent and user-facing limitations are explicit.
- [ ] Every high-risk subsystem has a native kill switch and rollback test.
- [ ] Desktop matrix passes; web/mobile regressions pass.
- [ ] Commands use `cargo test --manifest-path src-tauri/Cargo.toml ...` from repository root.
- [ ] Docs match actual source contracts.
- [ ] No stale copy promises full terminal/build support.
- [ ] Release readiness maps every plan requirement to test or manual evidence.

## Risk Assessment

- **Suite too broad:** phased flags allow partial shipment; worktrees/Quick Run can remain disabled.
- **Cross-platform drift:** capability discovery and target-specific dependency tests.
- **Documentation drift:** update core docs and AGENTS in same implementation PRs.

## Security Considerations

Default-off is mandatory for Apply, Quick Run, and worktrees until their gates pass. Rollback must revoke active capabilities and clean app-private state, not merely hide UI.
