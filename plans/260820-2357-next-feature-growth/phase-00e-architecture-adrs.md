---
title: Phase 0E — Architecture ADRs
status: ready
created: 2026-08-21
---

# Phase 0E — Architecture ADRs

All five ADRs are **accepted for discovery**. They are not an implementation license.

| ADR | File |
| --- | --- |
| Imported-source storage | [adrs/001-imported-source-storage.md](./adrs/001-imported-source-storage.md) |
| Desktop archive I/O | [adrs/002-desktop-archive-io.md](./adrs/002-desktop-archive-io.md) |
| Search owner / lifecycle | [adrs/003-search-owner-lifecycle.md](./adrs/003-search-owner-lifecycle.md) |
| Continuation lineage | [adrs/004-continuation-lineage.md](./adrs/004-continuation-lineage.md) |
| Deletion and sync | [adrs/005-deletion-and-sync.md](./adrs/005-deletion-and-sync.md) |

## Constraints

- Do not add `imported:*` storage keys, IPC commands, or Zod session fields in Phase 0.
- Reuse Platform + `ipc_invoke` if Phase 1 opens; do not call Tauri from feature packages.
- Keep `chaeboxi_kb.db` and session file-store lifecycles separate from imported history.
- History sync (`historyTransfer`) currently exports every `session:*` key — imported records must never use that namespace.
