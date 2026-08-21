# ADR 001 — Imported-source storage

**Status:** Accepted (discovery)  
**Date:** 2026-08-21

## Decision

Imported vendor history is a **separate immutable aggregate**, not a `Session`.

```text
ImportedSource            # one ZIP / one import job
  └─ ImportedConversation # provider conversation id
       └─ ImportedMessage # text-only; skipped attachments counted
```

Native `Session` may hold optional `continuationLineage` (ADR 004). Continue **creates** a session; it never mutates the import.

## Why

- `chatStore.createSession` / `modifyMessage` / forks / compaction assume mutable native chats
- `historyTransfer` exports every `session:*` key — putting archives there would sync and back up vendor data
- JSONL import (`session-export`) parses into `Session` and is the wrong type for read-only vendor trees

## Storage (Phase 1, not now)

Desktop: SQLite file `chaeboxi_imported.db` beside app data, **not** `chaeboxi_kb.db`, **not** the session file store.

Suggested tables: `sources`, `conversations`, `messages`, `skips` (reason codes). Append-only until source delete.

Renderer access: Platform methods (`listImportedSources`, `getImportedConversation`, `deleteImportedSource`). No direct SQL. No `StorageKeyGenerator.session`.

Web/mobile: capability `importedArchives: false`.

## Invariants

- Published source has checksum + importer id + format version + original filename (not path)
- Records are read-only after publish
- Re-import of the same provider conversation id is idempotent (replace unpublished staging; do not duplicate published without explicit re-import)
- Native session mutation APIs refuse imported ids (prefix or distinct type)

## Rejected

- Import as hidden `Session` with `archived: true` — would hit sync, search, compaction, agent tools
- Reuse KB documents — wrong lifecycle and embeddings
