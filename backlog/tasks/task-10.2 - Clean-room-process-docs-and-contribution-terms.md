---
id: TASK-10.2
title: Clean-room process docs and contribution terms
status: Proposed
assignee: []
created_date: '2026-10-17 07:24'
labels:
  - licensing
dependencies:
  - TASK-10.1
documentation:
  - docs/specs/2026-10-17-clean-room-relicense.md
parent_task_id: TASK-10
type: chore
ordinal: 13000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Rebuilt code only counts as clean if the people or agents writing it never saw the upstream files. That rule, who plays which role, and contributor sign-off must be written down before any work package starts. Both maintainers have read upstream code, so the documented approach relies on fresh agents implementing from specs (plan Task 2).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 docs/clean-room.md states the rules, the spec writer, implementer and reviewer roles, and the limitation that both maintainers have read upstream code
- [ ] #2 docs/specs/clean-room/_template.md exists with Purpose, Behaviours, Compatibility boundary, Test cases, Out of scope and Upstream files covered
- [ ] #3 CONTRIBUTING.md requires DCO Signed-off-by, and the PR template asks for the WP and a passing provenance scan
- [ ] #4 The .github templates are written fresh and scan clean
<!-- AC:END -->
