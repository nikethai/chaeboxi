# ADR 003 — Search owner and index lifecycle

**Status:** Accepted (discovery)  
**Date:** 2026-08-21

## Decision

**Keep the existing linear scan for native sessions in v1.**  
Do not add a full-text index until a real desktop corpus misses the envelope (warm p95 ≤ 200 ms **including** `session:*` IPC).

Imported sources, if large, may use **FTS5 inside `chaeboxi_imported.db` only**. That index is owned by the imported-source module, not KB, not memory.

Unified search facade (Phase 1 UI):

```text
query → native linear scan (existing cap 50)
      → imported FTS or imported linear scan
      → merge by recency; never return unpublished/deleted rows
```

## Baseline (verified in code)

- `matchSessionMessages` + `LINEAR_HISTORY_SEARCH_RESULT_CAP = 50`
- Serial file-store reads
- No NFC; no forks; no tool-call text
- 10k in-memory messages ≪ 200 ms; I/O unknown

## If an index is required later

| Topic | Rule |
| --- | --- |
| Owner | `src-tauri` imported DB, not `chaeboxi_kb.db` |
| Schema | conversation_id, message_id, source_id, created_at, text |
| Commit | publish job writes rows in the same transaction as source status=published |
| Delete | source delete drops FTS rows in the same transaction |
| Version | `imported_search_schema_version`; mismatch → rebuild |
| Rebuild | background, progress UI, search falls back to linear |
| Crash | WAL; unpublished jobs not searchable |
| Unicode | NFC normalize at write |
| Ranking | bm25 + recency; exact substring boost |
| Budgets | declare after volunteer I/O measure |

## Rejected

- Reuse KB hybrid/E5 search for chat history
- Renderer-wide inverted index of all sessions (duplicates memory package; multi-window file store is source of truth)
- Semantic search in v1
