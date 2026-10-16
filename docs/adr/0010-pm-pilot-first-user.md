---
type: decision
status: stable
description: "Small-agency PM as first external user"
# Accepted in conversation on 2026-10-13; not yet reviewed in git. Milestone order set by ADR 0011.
---
# ADR 0010: Small-agency PM as first external user

Status: accepted product direction, 2026-10-13. Design in [the PM pilot design](../specs/2026-10-13-pm-pilot-design.md).

## Context

The personal assistant design assumed the maintainer as the only user and chose context recovery across AI tools (Cowork, Codex) as the lead workflow. The maintainer now wants Chaeboxi to be useful to non-technical project managers, starting with one PM they know, and a competitive review found that no product ships a per-client memory joining email, meetings and the work tracker.

## Decision

The first external user is one PM at a small agency on Gmail and Asana. The lead workflow becomes grounded replies to client emails, built on a per-client memory fed by Gmail and a work-tracker connector. Quick Chat remains the on-demand recall surface. The app stays one product for both users; developer features move behind an Advanced section rather than being removed.

The first external knowledge sources are Gmail and the work tracker, ahead of the Cowork/Codex connector, which remains on the roadmap. Automatic detection of local agent session stores is permitted; connecting one still requires the user's explicit action under ADR 0003.

Model access stays bring-your-own: subscription logins (Google, ChatGPT/Codex) with key entry as a required fallback. No hosted billing or default provider operated by the maintainer.

Standing automated actions are limited in v1 to labelling and drafting inside the user's own mailbox, never sending. Scoped, pre-authorised standing actions beyond that (auto-chasing tasks) are a recorded future direction under ADR 0004's pre-authorisation clause, not v1 scope.

## Consequences

Milestone order from the personal assistant design changes: Gmail and tracker sources and the inbox pipeline come before canvas and the Cowork/Codex connector. ADRs 0001–0009 are unchanged. Hosted sync (ADR 0006) stays deferred behind "useful for one PM". The pilot runs on a single-user OAuth client; CASA must be budgeted before any multi-tenant release. Demand beyond the one PM is not validated by this decision.
