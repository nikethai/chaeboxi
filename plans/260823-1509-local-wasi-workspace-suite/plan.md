---
title: "Local WASI Workspace Suite"
description: "Add safe local Quick Run, native export, read-only Git, reviewed changes, and managed worktrees without Docker or external servers."
status: complete
priority: P1
branch: "main"
tags: [feature, frontend, backend, security, experimental]
blockedBy: []
blocks: []
created: "2026-08-23T08:17:15.207Z"
createdBy: "ck:plan"
source: skill
mode: deep
scope: hold
risk: high
---

# Local WASI Workspace Suite

## Overview

Extend the completed picker-owned Project Workspace foundation into a non-technical-user workspace suite. Desktop users can browse authorized Project Files, export reviewed content through native Save As, inspect local Git state, review agent-proposed changes, run bounded JavaScript locally through embedded Wasmtime/WASI, and optionally isolate concurrent work in app-managed Git worktrees.

This is not a terminal or IDE clone. Security remains native and fail-closed. Wasmtime runs only a controlled Quick Run profile; full builds, npm/pip installs, native dependencies, remote Git, and cloud execution stay deferred.

## Scope Challenge

- Existing code: native picker binding, capability-bound file APIs, ignore/hard-deny policy, revision-safe mutations, explorer, tool approvals, Artifact Studio, native ZIP dependency.
- Minimum additions: authority hardening, native export, read-only SCM broker, staged change sets, one embedded WASI profile, conditional app-owned worktrees.
- Complexity: 7 phases across Rust authority/IPC, shared contracts, renderer platform/tools/UI, integration tests, docs. Separation required because each privilege needs an independent kill switch and validation gate.
- Selected scope: **HOLD — Workspace suite**.

## Locked Decisions

1. **No Docker requirement.** No external execution server in this plan.
2. **Wasmtime is the local sandbox engine, not a general terminal.** MVP profile: JavaScript via a pinned WASI-compatible QuickJS runtime, subject to Phase 5 feasibility gate.
3. **No host execution fallback.** Unsupported tasks return a clear limitation.
4. **Original Project folder is never mounted writable into WASI.** Runs use app-private snapshots/scratch.
5. **Run and Apply are separate decisions.** Model tools stage changes; user applies reviewed changes.
6. **Git starts read-only.** Worktrees are app-owned and conditional on hostile-repository tests.
7. **Native picker controls all export destinations.** Renderer never supplies absolute destination paths.
8. **Project Explorer, Source Control, Quick Run, and Artifact Studio remain separate product domains.**

## Target Architecture

```text
Project Explorer ── workspace:* ── WorkspaceAuthority
         │                              │
         ├── Source Control ── scm:* ──┤
         ├── Change Review ── changes:*│
         ├── Export ───────── export:* │
         └── Quick Run ────── wasi:* ──┘
                                      │
                     app-private snapshot + scratch
                                      │
                           embedded Wasmtime runtime
                                      │
                         result + proposed change set
```

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Harden Workspace Authority](./phase-01-harden-workspace-authority.md) | Done |
| 2 | [Explorer and Native Export](./phase-02-explorer-and-native-export.md) | Done |
| 3 | [Read-Only Source Control](./phase-03-read-only-source-control.md) | Done |
| 4 | [Stage Review and Apply](./phase-04-stage-review-and-apply.md) | Done |
| 5 | [Embedded WASI Quick Run](./phase-05-embedded-wasi-quick-run.md) | NO-GO |
| 6 | [Managed Git Worktrees](./phase-06-managed-git-worktrees.md) | NO-GO |
| 7 | [Rollout and Documentation](./phase-07-rollout-and-documentation.md) | Done |

## Dependency Graph

```text
Phase 1 ─┬→ Phase 2 ─┬→ Phase 5 (optional gate)
         ├→ Phase 3 ─┼→ Phase 6 (optional gate)
         └→ Phase 4 ─┘
Phase 2 + Phase 3 + Phase 4 → Phase 7 safe-suite rollout
Phase 5/6 passing gates → Phase 7 optional capability rollout
```

Phase 2 and Phase 3 may proceed in parallel after Phase 1. Phase 5 also requires Phase 2 export/artifact contracts and Phase 4 change sets. Phase 6 requires Phase 3 repository identity and Phase 4 journal/recovery semantics. A NO-GO in Phase 5 or 6 does not block safe Explorer, Export, read-only SCM, and reviewed Apply rollout.

## Cross-Plan Dependencies

- Reuses completed `plans/260822-1923-project-workspace/`; no blocking relationship because its native authority is already shipped.
- No overlap with unfinished Continuity workspace discovery; that plan explicitly defers workspace files.

## Non-Goals

- Docker/Podman installation or bundling.
- Remote sandbox infrastructure.
- Generic shell, PTY, subprocesses, host commands, package installation.
- Python/Rust/Node project execution in MVP.
- Git push/pull/fetch/rebase/merge, credentials, submodule mutation, arbitrary Git arguments.
- Automatic deletion of picker-owned folders or dirty worktrees.
- Desktop filesystem parity on web/mobile.

## Global Success Criteria

- `pnpm test` and targeted workspace/tool/UI suites pass.
- `cargo test --manifest-path src-tauri/Cargo.toml workspace::` plus new SCM/WASI suites pass.
- Web/mobile/Test platforms fail closed for native-only capabilities.
- No renderer-provided absolute path authorizes roots, exports, Git, worktrees, or execution.
- WASI has no filesystem access outside explicit app-private snapshot/scratch preopens, and no ambient host/application secrets, network, environment, or subprocess access.
- A run cannot mutate the original project until reviewed Apply.
- Worktree cleanup cannot delete picker-owned or dirty content.
- Independent feature flags rollback Explorer, Export, SCM, Apply, WASI, and worktrees without restoring generic shell/FS APIs.

## Research

- [Architecture findings](./research/architecture-findings.md)
- [WASI runtime decision](./research/wasi-runtime-decision.md)

## Blocking Technical Decisions

These are resolved by recorded spike artifacts before implementation crosses each gate:

- Phase 1: native rollout-policy source, async IPC error-envelope contract, retained-root handle strategy on Windows.
- Phase 4: change-set overlay normalization, native apply journal format, sensitive tool-payload persistence policy.
- Phase 5: QuickJS artifact/build recipe/hash/license, Preview 1 vs component ABI, Wasmtime crate/features, clock/random policy.
- Phase 6: safe checkout implementation, opaque ref identity, reviewed worktree-to-main promotion semantics.

## Open Questions

None requiring product input. Technical gates have explicit NO-GO outcomes and evidence requirements.
