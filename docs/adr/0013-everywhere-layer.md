---
type: decision
status: stable
description: "Two layers of knowledge: each scope, plus a built-in Everywhere scope that every scope reads; scope wins on a clash"
generated: { by: claude/opus-5.5, at: 2026-10-17T11:05:00+07:00 }
verified: { by: human:nikethai, at: 2026-10-17T11:19:00+07:00 }
---
# ADR 0013: Scope plus Everywhere

Status: accepted by the maintainer, 2026-10-17. Builds on ADR 0001 and 0002 (authoritative knowledge per scope) and ADR 0011 (shared core grouped by scope).

## Context

The redesign groups knowledge by scope. Some things are true in every scope: how the user likes answers, who they are, reference files such as research papers. The redesign had a place for global preferences (Settings › Memory and privacy) but none for global facts or global documents, and every source belonged to exactly one scope.

The code has a third grouping: memory banks are either `global` or per agent (persona), not per scope. The knowledge base is a separate setting that is not tied to scopes.

A PM pilot scope holds client work. Personal files must not leak into a client draft.

## Decision

1. **Two layers.** Each scope has its own knowledge and sources. A built-in scope, **Everywhere**, holds preferences, facts and Documents sources that every scope reads on top of its own. Everywhere sits at the top of the sidebar's scope list, cannot be renamed or deleted, and holds no chats.
2. **Scope wins.** When a scope's knowledge and Everywhere disagree, the scope's applies inside that scope, without a prompt. A clash inside one layer is still a Conflict item (flow 12).
3. **Client scopes don't read Everywhere documents by default.** Preferences always apply. Facts apply unless turned off. Documents are opt-in for client scopes and on for project scopes. Each scope's Settings tab shows the three switches.
4. **Moving between layers.** "Apply to all scopes" on a fact moves it to Everywhere; "Move to scope" moves it back. Personal preferences approved anywhere land in Everywhere.
5. **No per-agent memory.** An agent's standing instructions live in its prompt (Settings › Agents). Existing per-agent memory banks are migrated into the agent's prompt or into Everywhere, the user choosing per item during the migration.

## Consequences

- Retrieval reads two places per turn: the scope and Everywhere, filtered by the scope's switches.
- Settings › Memory and privacy keeps learning and privacy controls (Don't suggest again, Trust, export) and links to Everywhere for content.
- The memory schema changes: `MemoryScope` becomes scope IDs plus the reserved `everywhere`, and the `agent` scope goes away after migration. This needs a storage migration with tests.
- Wireframes: EV1 (Everywhere), EV2 (a client scope's switches), KN1–KN3 (Knowledge tab, editing, Memory and privacy).

## Alternatives considered

- **Global preferences only, documents per scope.** Simpler, but the same research papers would be connected once per scope.
- **Inherit everything everywhere.** Simplest mentally, but leaks personal files into client work.
- **Keep per-agent memory.** A third layer that users must reason about; the agent prompt already does the job.
