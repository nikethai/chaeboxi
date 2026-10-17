---
id: TASK-10.15
title: WP12 and trace sweep
status: Proposed
assignee: []
created_date: '2026-10-17 07:24'
labels:
  - licensing
dependencies:
  - TASK-10.3
  - TASK-10.4
  - TASK-10.5
  - TASK-10.6
  - TASK-10.7
  - TASK-10.8
  - TASK-10.9
  - TASK-10.10
  - TASK-10.11
  - TASK-10.12
  - TASK-10.13
  - TASK-10.14
documentation:
  - docs/research/2026-10-17-upstream-provenance/files.csv
  - docs/specs/2026-10-17-clean-room-relicense.md
parent_task_id: TASK-10
type: chore
ordinal: 26000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Most upstream tests (69 files, about 13k lines) disappear with their modules in the earlier packages. What is left, including the integration test harness, needs rebuilding or deleting. The 153 trace files (about 1k lines, mostly boilerplate blame credits to upstream) are reviewed one by one: each flagged line is rewritten, or allowlisted with a reason (plan Task 15).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 No WP12 file remains non-clean
- [ ] #2 Each trace file is rewritten or allowlisted with a reason the reviewer signed off
- [ ] #3 pnpm provenance --fail exits 0 across the repo, apart from the documented exceptions
<!-- AC:END -->
