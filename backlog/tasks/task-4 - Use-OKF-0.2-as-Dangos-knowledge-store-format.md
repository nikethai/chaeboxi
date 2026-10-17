---
id: TASK-4
title: Use OKF 0.2 as Dango's knowledge store format
status: Done
assignee:
  - '@codex'
created_date: '2026-10-15 04:30'
updated_date: '2026-10-17 15:23'
labels:
  - knowledge
dependencies: []
references:
  - >-
    https://github.com/GoogleCloudPlatform/open-knowledge-format/blob/main/SPEC.md
documentation:
  - 'http://127.0.0.1:6421/adr/0014-okf-knowledge-document-format.md'
type: spike
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Format-selection spike: review OKF 0.2 for Dango curated knowledge documents and propose an ADR before any build. Repository docs already use OKF-style metadata. Review found that status stable and human verification claims do not establish Dango approval; approval must bind to an exact revision under app-controlled scope/privacy rules. Runtime storage, parser and migration implementation are outside this spike.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Review the upstream OKF 0.2 specification against accepted approval, scope, source-access and freshness requirements.
2. Propose a Dango format profile and adoption boundaries in a draft ADR; do not implement storage or migration.
3. Record findings and leave acceptance to the maintainer.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-17: Reviewed the complete upstream OKF 0.2 SPEC.md, pinned at 0b87c52c6ef999286c745e19998fdfcd03d5dbee, against ADRs 0001, 0002, 0003, 0008 and 0013 and the accepted sections of the personal-assistant design. Recommendation: adopt OKF for curated knowledge documents/import-export, not as a replacement storage engine or authority mechanism. Draft ADR 0014 records the fit, unsafe direct mappings, scope/privacy/revision controls, alternatives and future validation scenarios. Review complete; awaiting maintainer acceptance or an alternative decision. No runtime changes, migration or follow-up tasks created; not marked Done.

Verification: draft ADR YAML parsed successfully with no verified/acceptance metadata; all 4 local ADR links resolve; docs index and log link the proposal; pinned upstream SPEC.md matches the reviewed main content byte-for-byte; git diff --check passed. Documentation-only review, no runtime test results claimed. Remaining completion requirement: maintainer decision on ADR 0014.

Browser access fix: disabled checkActiveBranches to prevent historical Chaeboxi/Dango filenames from making TASK-4 ambiguous. The canonical draft ADR remains in docs/adr and is linked under Documentation through the read-only local viewer. Run pnpm backlog:browser to start the board plus the viewer; no ADR copy or task renumbering required.

Browser fix verified: fresh-server TASK-4 API returns HTTP 200 (restart alone still returned 409 until branch scanning was disabled); backlog doctor reports no duplicate IDs. Opened TASK-4 from its board card and followed its Documentation URL in a real browser: ADR 0014 renders with draft metadata, tables and footnotes. Viewer checks passed on Node 20 for live reads, read-only methods, loopback host validation, traversal/symlink blocking and safe Markdown rendering. ADR remains a draft awaiting maintainer acceptance.

Accepted 2026-10-17: use OKF 0.2 document format with SQLite-backed storage for curated knowledge. ADR 0014 marked stable with maintainer verification. Format-selection spike complete; implementation unscheduled.
<!-- SECTION:NOTES:END -->
