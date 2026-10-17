---
id: TASK-10.10
title: 'WP02: clean-room token estimation and context management'
status: Proposed
assignee: []
created_date: '2026-10-17 07:24'
updated_date: '2026-10-17 07:25'
labels:
  - licensing
dependencies:
  - TASK-10.9
documentation:
  - docs/research/2026-10-17-upstream-provenance/files.csv
  - docs/specs/2026-10-17-clean-room-relicense.md
parent_task_id: TASK-10
type: chore
ordinal: 21000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
There are 18 files with upstream origin (about 2.9k lines): the token-estimation queue, analyzer, persister and executor, plus context-management and model-context. The spec states the token budget rules and compaction thresholds as numbers. A simpler design is encouraged; a different structure also lowers the risk of converging on the upstream code (plan Task 10).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A WP02 spec states the budget rules and thresholds numerically, and the tests check them
- [ ] #2 The old WP02 files are deleted; pnpm check, lint and test pass; the provenance scan of changed files exits 0
<!-- AC:END -->
