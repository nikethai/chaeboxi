# Docs update log

Newest first. Add a line when you create, accept, supersede or move a decision, spec or research note.

## 2026-10-17
* **Proposal**: [ADR 0013](adr/0013-everywhere-layer.md) (draft) — knowledge in two layers, each scope plus a built-in Everywhere scope; scope wins on a clash; client scopes opt in to Everywhere documents; per-agent memory folds into agent prompts.
* **Update**: [UX flows](specs/2026-10-16-ux-flows.md) — flows 17–24 (message actions, managing chats, artifacts, agents, menu bar, window sizes, dark mode, accessibility) and rules for the composer, model errors, cost, plans and empty states; 33 more screens; the product is now called Dango in the specs and on the canvas.
* **Update**: [UX flows](specs/2026-10-16-ux-flows.md) — screen-level wireframes for all 16 flows added to the canvas (Screens page); mascot and Thread colours applied to the wireframes.

## 2026-10-16
* **Proposal**: [UX flows](specs/2026-10-16-ux-flows.md) (draft) — 16 journeys: first run, Ask, Review, knowledge, chat, sources, permissions, Swarm, background work, PM email, what changed, conflicts, Trust, search, errors, undo.
* **Update**: [redesign brief](specs/2026-10-16-redesign-brief.md) — UX model added (three jobs: Ask, Review, Browse; trust level Auto/Ask; Review item types); first look exploration rejected.
* **Proposal**: [redesign brief](specs/2026-10-16-redesign-brief.md) (draft) — structure first (Quick Chat, Chat, Scopes, Search; 5 top-level settings plus Advanced), then a new look.
* **Acceptance**: [ADR 0011](adr/0011-maintainer-first-shared-core.md) accepted by the maintainer — shared knowledge core grouped by scope; this repo is the first source; Gmail + Asana follow once the PM pilot's prerequisites are met.

## 2026-10-15
* **Proposal**: [ADR 0011](adr/0011-maintainer-first-shared-core.md) (draft) — maintainer first on a shared knowledge core; PM pilot as the next source.
* **Reorganisation**: planning folders moved under `docs/` (`specs/`, `research/`, `archive/`); continuity ADRs moved to `adr/continuity/`; OKF 0.2 frontmatter added to decisions, specs and research; Backlog.md board added in `backlog/`; `AGENTS.md` now says where plans, research, decisions and ideas go.
* **Creation**: PM pilot docs committed for the first time ([ADR 0010](adr/0010-pm-pilot-first-user.md), [pilot design](specs/2026-10-13-pm-pilot-design.md), [phase-1 plan](specs/2026-10-14-pm-pilot-phase-1-client-memory.md)), written 2026-10-13/14.

## 2026-10-13
* **Creation**: ADRs 0001–0009 and the [personal assistant design](specs/2026-10-05-personal-assistant-design.md).
* **Update**: [ADR 0010](adr/0010-pm-pilot-first-user.md) accepted in conversation — PM becomes first external user (not committed until 2026-10-15).
