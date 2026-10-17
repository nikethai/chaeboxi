---
id: TASK-10.3
title: 'WP00: delete dead upstream code and unused assets'
status: Proposed
assignee: []
created_date: '2026-10-17 07:24'
labels:
  - licensing
dependencies:
  - TASK-10.1
documentation:
  - docs/research/2026-10-17-upstream-provenance/files.csv
  - docs/specs/2026-10-17-clean-room-relicense.md
parent_task_id: TASK-10
type: chore
ordinal: 14000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The audit found 76 upstream files (about 3.4k lines) that nothing appears to import: old setting tabs, an index.ejs, unused icons, logos and fonts. Deleting them is the cheapest progress. The list came from a grep heuristic, so some files may still be used; those move to their topic WP. Whether the dev routes are kept is a maintainer decision (plan Task 3).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 All WP00 rows in files.csv are deleted, or reassigned to another WP with a reason
- [ ] #2 pnpm check, pnpm test and pnpm build:web pass
- [ ] #3 The maintainer decision on src/renderer/routes/dev is recorded in the task notes
<!-- AC:END -->
