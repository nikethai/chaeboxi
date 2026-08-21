---
title: Phase 0A — Demand validation
status: ready
created: 2026-08-21
---

# Phase 0A — Demand validation

## Context

Continuity pain is documented in community reports. This workstream measures whether qualified Chaeboxi-relevant users will import a real export, hand off selected excerpts, and repeat the workflow in a later week.

Protocols: [discovery/recruitment-screener.md](./discovery/recruitment-screener.md), [discovery/task-scripts.md](./discovery/task-scripts.md), [discovery/consent-custody-protocol.md](./discovery/consent-custody-protocol.md), [discovery/measurement-baseline.md](./discovery/measurement-baseline.md).

## Requirements

- Recruit 8–12 people who use ≥2 providers weekly, have a recurring multi-session project, and can legally provide a sanitized export or complete an observed task.
- Mix: current power users, abandoned multi-model users, users who keep manual notes.
- Do not treat concept endorsement as import willingness.
- Keep product telemetry off (`TELEMETRY_ENABLED = false`). Use local/exported content-free counters.

## Files

Create/update only under `plans/260820-2357-next-feature-growth/discovery/`. No product UI.

## Steps

1. Screen with the recruitment document.
2. Run session 1 tasks (observe current workflow, timed copy/paste, import willingness, selective handoff).
3. Repeat one task in a later week.
4. Record disclosure comprehension (local vs remote).
5. Do not start MVP coding from this file.

## Validation

Exit numbers live in `plan.md` (6/8–12 weekly continuity, 5 real exports, 30% median time save, 4 repeat-week users, correct disclosure).

## Risks

Recruiting and legal export sharing are outside the repo. Do not substitute synthetic users.
