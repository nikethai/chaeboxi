---
type: decision
status: stable
description: "Maintainer first on a shared knowledge core; PM pilot as the next source"
generated: { by: claude/opus-5.5, at: 2026-10-15T11:40:00+07:00 }
verified: { by: human:nikethai, at: 2026-10-16T21:15:00+07:00 }
---
# ADR 0011: Maintainer first on a shared knowledge core

Status: accepted by the maintainer, 2026-10-16 (proposed 2026-10-15). Sequences [ADR 0010](0010-pm-pilot-first-user.md); does not replace it.

## Context

ADR 0010 made a small-agency PM the first external user, moving the maintainer's own context recovery (the lead workflow in the [personal assistant design](../specs/2026-10-05-personal-assistant-design.md)) behind Gmail and Asana. The maintainer did not notice the change for two days, which is the problem context recovery is meant to solve.

Both directions need the same engine. The [phase-1 plan](../specs/2026-10-14-pm-pilot-phase-1-client-memory.md) already describes it: work records from connected sources, a ledger with source links, and recall in chat. Only the grouping ("client") is PM-specific.

The PM pilot has an open prerequisite: the agency has not confirmed Gmail access. The repository needs no OAuth, CASA review or third-party approval, and the maintainer uses it daily.

## Decision

Build the phase-1 core with "scope" (a client or a project) instead of "client" as the grouping.

The first source is this repository, for the maintainer: decisions and specs (via `docs/log.md`), commits, uncommitted work, branches and board changes, answering "what changed while I was away?"

Gmail and Asana are the second source. Work on them starts when the agency confirms Gmail access and the PM agrees to try the pilot within about two weeks. When that happens, the PM pilot takes priority, because outside feedback is worth more than the maintainer's own.

## Consequences

ADR 0010 stays in force as product direction; only its milestone order changes. The phase-1 plan needs a rename pass (client → scope) and a repository source added before execution. Codex thread reading (see [work source access](../research/2026-10-13-work-source-access.md)) remains a later source. Demand beyond the maintainer and one PM is still not validated.
