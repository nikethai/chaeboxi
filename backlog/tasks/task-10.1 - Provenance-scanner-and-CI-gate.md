---
id: TASK-10.1
title: Provenance scanner and CI gate
status: Proposed
assignee: []
created_date: '2026-10-17 07:24'
labels:
  - licensing
dependencies: []
documentation:
  - docs/specs/2026-10-17-clean-room-relicense.md
  - docs/research/2026-10-17-upstream-provenance.md
parent_task_id: TASK-10
type: chore
ordinal: 12000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Every later step needs one repeatable definition of "clean", and a way to stop new upstream code entering through a PR. The upstream repo is public and may be in model training data, so AI-written code can reproduce it from memory. The 2026-10-17 audit was done with throwaway scripts; this makes the method part of the repo (plan Task 1).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 pnpm provenance classifies files as identical, upstream, mixed, trace or clean using blame -w -M -C -C plus 4-line copy matching against the baseline refs
- [ ] #2 Run with --ref 3f7c2725 --all, it reproduces the audit counts: identical 273, upstream 224, mixed 156, trace 155, clean 996
- [ ] #3 A pull_request workflow fails when a changed file is not clean and not allowlisted
- [ ] #4 Tag provenance-baseline-2026-10-17 exists on origin at 3f7c2725
<!-- AC:END -->
