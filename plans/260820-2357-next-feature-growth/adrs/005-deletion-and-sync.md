# ADR 005 — Deletion graph and local-only sync

**Status:** Accepted (discovery)  
**Date:** 2026-08-21

## Decision

v1 imported sources are **device-local**. They are excluded from history sync by **type isolation**, not a denylist that someone can forget.

`historyTransfer.collectSessionsFromStorage` already iterates `session:` keys plus `chat-sessions-list`. Imported SQLite is not in that set. **Never** write imported conversations into `session:{id}`.

Memory sync, usage rollup, and KB stay unaware of imports.

## Delete source (user action)

In one transaction / ordered job:

1. Mark source `deleting`
2. Drop messages, conversations, FTS rows, skip rows
3. Delete staging files for that source
4. Delete import metadata
5. Commit; lineage rows on native sessions remain with `sourceMissing`

Do **not** delete derived native continuations. Do **not** attempt to retract provider-side content.

## Re-import

Same provider conversation id + same checksum → no-op.  
Same id, different checksum → new source version; old must be deleted or replaced explicitly (UI: replace). Deterministic ids: `imported:{provider}:{providerConversationId}`.

## Crash / cancel / disk-full

Staging never searchable. Publish is atomic. Tests required before MVP: crash mid-extract, cancel, disk-full, re-import, delete-with-lineage.

## Rejected

- Syncing imports "because they are just files"
- Tombstone sync of deletions (nothing to sync)
- Cascading delete of native continuations
