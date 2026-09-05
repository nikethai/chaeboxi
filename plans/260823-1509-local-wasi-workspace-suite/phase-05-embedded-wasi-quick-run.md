---
phase: 5
title: "Embedded WASI Quick Run"
status: pending
priority: P1
dependencies: [1, 2, 4]
effort: "10-15 days including feasibility gate"
---

# Phase 5: Embedded WASI Quick Run

## Context Links

- [Plan](./plan.md)
- [WASI runtime decision](./research/wasi-runtime-decision.md)
- [`src-tauri/Cargo.toml`](../../src-tauri/Cargo.toml)
- [`stream-text.ts`](../../src/renderer/packages/model-calls/stream-text.ts)

## Overview

Add zero-install local Quick Run using embedded Wasmtime. Non-technical users run a bounded JavaScript profile backed by a pinned WASI-compatible QuickJS runtime. It is not Node.js, a shell, or a full project builder.

Phase begins with a hard feasibility gate. If the JavaScript runtime cannot meet compatibility, security, licensing, bundle-size, or startup targets, ship status/UX as unavailable and do not substitute host execution.

## Requirements

### Supported MVP

- JavaScript source and optional stdin.
- Up to 20 explicitly selected Project files, 512 KiB total, copied into app-private snapshot.
- Writable app-private scratch only.
- Captured stdout/stderr and declared output artifacts.
- Clock/random are denied by default; any enabled deterministic host function is explicit in the execution profile.
- Result may produce a Phase 4 change set only through a declared output manifest mapping scratch artifacts to explicit project-relative targets.
- Result artifacts register natively with Phase 2’s app-private artifact export registry for Save As.
- Desktop macOS/Windows/Linux only.

### Explicitly unsupported

- Node APIs, npm, Python, shell, subprocesses, sockets, native addons, package installs.
- Filesystem outside explicit app-private snapshot/scratch preopens.
- Ambient host/application secrets, environment, home, credentials, keychain, devices, clipboard, and browser data. Selected source/stdin/files may contain user-authorized sensitive data and must follow Phase 1 redaction rules.
- Network access.
- Unsandboxed fallback.

### Initial hard limits

| Resource | Limit |
|---|---:|
| JavaScript source | 256 KiB |
| Input snapshot | 20 files / 512 KiB |
| stdin | 256 KiB |
| stdout/stderr | 256 KiB each |
| Scratch output | 10 MiB / 100 files |
| Linear memory | 64 MiB |
| Wall time | 5 seconds |
| Concurrent runs | 1/window, 2/process |
| Prepared grant lifetime | 120 seconds |

## Architecture

```text
run_local_code(language=javascript, source, contextPaths)
  → wasi:prepare
     - authorize project/generation
     - copy eligible context into app-private snapshot
     - hash source/runtime/snapshot
     - validate limits
  → explicit Allow once
  → wasi:run(one-use ticket)
     - embedded Wasmtime
     - pinned QuickJS WASI runtime
     - no network/env/process
     - snapshot + scratch preopens only
  → bounded logs + declared output manifest
     [{ scratchPath, targetPath, intent: create|replace }]
  → validate targets + snapshot base revisions
  → optional Phase 4 change set
  → cleanup/discard
```

## Feasibility Gate

Before production integration, prove:

- Select and record concrete QuickJS artifact/version, build recipe, digest, license, source provenance, invocation ABI, and WASI Preview version.
- Select matching Wasmtime/Wasmtime-WASI crates/features supporting Rust 1.88 and all desktop targets.
- Release bundle growth target: ≤50 MiB compressed.
- Cold startup target: ≤500 ms on baseline desktop.
- Infinite loop, memory growth, blocked-output backpressure, path escape, clock/random/env/network probes terminate safely.
- Epoch interruption has an active ticker and measured cancellation latency.
- JavaScript profile can run hello-world, JSON transform, and selected-file transform.

Failure means **NO-GO for Quick Run**, not a switch to host execution.

## File Inventory

| Action | File | Change | Test impact |
|---|---|---|---|
| Create | `src/shared/types/local-execution.ts` | Status/prepare/result/error schemas | Schema tests |
| Create | `src-tauri/src/local_wasi/mod.rs` | Native dispatch and runtime state | Cargo tests |
| Create | `src-tauri/src/local_wasi/runtime.rs` | Wasmtime engine/tickets/cancel | Runtime tests |
| Create | `src-tauri/src/local_wasi/limits.rs` | Resource limiter/fuel/epoch | Limit tests |
| Create | `src-tauri/src/local_wasi/profile_javascript.rs` | Pinned JS profile adapter | Compatibility tests |
| Create | `src-tauri/src/local_wasi/tests.rs` | WAT/JS adversarial fixtures | Cargo test |
| Create | `src/renderer/packages/model-calls/toolsets/local-execution.ts` | `run_local_code` tool | Tool tests |
| Create | `src/renderer/packages/model-calls/toolsets/local-execution.test.ts` | Availability/approval/result | Vitest |
| Create | `src/renderer/components/project/QuickRunPanel.tsx` | User run/status/log/artifact UX | Component tests |
| Create | `src/renderer/components/project/QuickRunPanel.test.tsx` | Limits/cancel/a11y | Vitest |
| Modify | `src-tauri/Cargo.toml` | Desktop-only pinned Wasmtime dependencies | Cargo build |
| Modify | `src-tauri/Cargo.lock` | Lock runtime graph | Reproducibility |
| Modify | `src-tauri/src/lib.rs` | Runtime state and async channels | Integration |
| Modify | `src-tauri/tauri.conf.json` | Bundle pinned runtime resource if external artifact | Packaging |
| Modify | `src/renderer/platform/interfaces.ts` | Execution provider API | Platform tests |
| Modify | `src/renderer/platform/desktop_platform.ts` | Native adapter | Platform tests |
| Modify | `src/renderer/platform/web_platform.ts` | Explicit unsupported execution adapter | Platform tests |
| Modify | `src/renderer/platform/test_platform.ts` | Fail-closed execution fixtures | Platform tests |
| Modify | `src/renderer/platform/capabilities.ts` | Desktop-only Quick Run flag | Capability tests |
| Modify | `src/renderer/packages/model-calls/wrap-tools-approval.ts` | Native prepare + one-use approval policy | Approval tests |
| Modify | `src/renderer/packages/tools/risk-engine.ts` | Quick Run always high risk | Risk tests |
| Modify | `src/renderer/packages/model-calls/stream-text.ts` | Conditional tool registration | Generation tests |
| Modify | `src/renderer/stores/session/generation.ts` | Accurate capability prompt | Generation tests |

## Interface Checklist

- [ ] `getLocalExecutionStatus()` reports available/unavailable reason.
- [ ] `prepareLocalExecution(request)` returns normalized immutable plan and one-use run ID.
- [ ] `runLocalExecution(runId, oneUseRunTicket, requestId)`.
- [ ] Output manifest allows only declared scratch paths and create/replace targets; rename/delete deferred.
- [ ] `cancelLocalExecution(requestId)` kills the active store via epoch interruption.
- [ ] `discardPreparedLocalExecution(runId)` cleans snapshot/ticket.
- [ ] Provider interface leaves room for future remote/Docker providers without implementing them.
- [ ] Product tool is named `run_local_code`; Wasmtime remains implementation detail.

## Implementation Steps

1. Run feasibility spike and record runtime artifact, digest, license, build recipe, Preview ABI, Wasmtime versions/features, epoch ticker, clock/random policy, memory baseline, size, and startup results.
2. Add Wasmtime dependencies desktop-only; verify they are not compiled or linked for Android/iOS (lockfile changes are expected).
3. Implement runtime with fuel, epoch interruption, memory/table/instance limits, bounded streams, and concurrency semaphore.
4. Build pinned JavaScript profile; expose no ambient environment or network imports.
5. Copy only explicitly selected eligible files into a fresh app-private run directory.
6. Bind prepared ticket to project/window/generation/source hash/runtime hash/snapshot revisions/limits/expiry.
7. Exclude Quick Run from shell lifecycle hooks; emit metadata-only events.
8. Extend approval wrapper so Quick Run always requires Allow once and audit redacts source/stdin.
9. Execute on bounded blocking worker with active epoch ticker and non-blocking bounded stdout/stderr drains; cancellation/revoke/window-close interrupts and cleans.
10. Require guest output manifest; validate each scratch artifact and target through workspace policy and snapshot revision before Phase 4 append/seal.
11. Add Quick Run UI with capability explanation and unsupported-task guidance.
12. Package and smoke-test signed release builds on all desktop targets; verify runtime digest at startup.

## Test Scenario Matrix

| Priority | Scenario | Expected |
|---|---|---|
| Critical | JS probes outside preopens/env/network/process | Access denied/trapped; run remains bounded |
| Critical | Infinite loop/memory/output flood | Bounded termination and cleanup |
| Critical | Relink/revoke/window close during run | Interrupted; no stale result/apply |
| Critical | Approval denied/expired/reused | Never executes |
| High | Snapshot path traversal/symlink/secret | Rejected before copy |
| High | Source/stdin contains secret | Content absent from audit/log metadata |
| High | Undeclared scratch file or invalid target mapping | Ignored/rejected; no change set |
| High | Scratch manifest create/replace | Reviewable normalized change set; original unchanged |
| High | Clock/random/argv/env/socket probes | Only documented capability available |
| High | Web/mobile/Test invocation | Unsupported, fail closed |
| Medium | Unsupported Node/npm request | Clear limitation, no fallback |
| Medium | Release packaging | Runtime present and hash verified |

## Dependency Map

- Depends on Phase 1 authority, Phase 2 app-artifact export registry, and Phase 4 change sets/reviewed apply.
- Worktrees are optional; Quick Run uses app-private snapshots without them.

## Success Criteria

- [ ] Feasibility gate passes and decision recorded.
- [ ] Non-technical user can run supported JavaScript with one explicit action.
- [ ] No filesystem outside snapshot/scratch and no ambient host/application capability is available to guest code.
- [ ] Resource abuse terminates within bounded grace.
- [ ] Generated file changes always use declared target manifests and enter Change Review.
- [ ] No Docker, external server, or user runtime installation required.
- [ ] Unsupported full-build tasks are explained honestly.

## Risk Assessment

- **Wasmtime weight:** gate compressed bundle growth and feature selection.
- **JavaScript compatibility:** market as Quick Run, not Node.
- **Runtime artifact supply chain:** pin version/digest/license; reproduce and verify during build.
- **JIT platform restrictions:** detect availability and fail closed.
- **Unresolved runtime ABI:** feasibility record is a blocking artifact, not assumed resolved.

## Security Considerations

WASI is capability-based only when host capabilities are deliberately withheld. The app-private snapshot/scratch is the sole filesystem surface. Approval does not replace native limits or authority checks.
