---
id: TASK-10.13
title: 'WP07, WP09, WP10: UI rebuilt inside the redesign'
status: Proposed
assignee: []
created_date: '2026-10-17 07:24'
labels:
  - licensing
dependencies:
  - TASK-10.2
documentation:
  - docs/research/2026-10-17-upstream-provenance/files.csv
  - docs/specs/2026-10-16-redesign-brief.md
  - docs/specs/2026-10-16-ux-flows.md
  - docs/specs/2026-10-17-clean-room-relicense.md
parent_task_id: TASK-10
type: chore
ordinal: 24000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Settings (46 files), chat UI and components (138) and modals (22), about 15k lines in total, are upstream-derived. The redesign (TASK-8) already rebuilds these surfaces from team-authored specs (the redesign brief and UX flows), so this task is a gate on its build PRs, not a separate rewrite. Each surface is built fresh in new files, and the old files it replaces are deleted. Restyling an old file such as InputBox.tsx keeps it upstream-derived (plan Task 13).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every redesign build PR passes pnpm provenance --changed --fail
- [ ] #2 No redesign PR edits an old upstream-derived component into the new design
- [ ] #3 After the redesign lands, pnpm provenance --summary shows WP07, WP09 and WP10 at 0 files
<!-- AC:END -->
