---
id: TASK-3
title: '''What changed'' digest script'
status: Done
assignee: []
created_date: '2026-10-15 04:30'
updated_date: '2026-10-17 15:38'
labels:
  - tooling
dependencies: []
type: chore
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
pnpm whats-changed: since a timestamp, list new/changed ADRs and specs (docs/log.md), commits by agent, uncommitted files, new branches and board moves. Bootstrap for the shared-core repo source.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented 2026-10-17: pnpm whats-changed script reports docs/log.md changes, commits grouped by author/branch, uncommitted files, new/deleted branches and board moves since a timestamp (defaults 7 days ago). Tested with 1-day window; bootstrap for repo-source feature in ADR 0011 and TASK-1.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added pnpm whats-changed command using tsx. Reports docs/log.md changes, commits by author/branch, uncommitted files, branch changes, and board moves since a --since timestamp. Verified with a 1-day window against the current repo.
<!-- SECTION:FINAL_SUMMARY:END -->
