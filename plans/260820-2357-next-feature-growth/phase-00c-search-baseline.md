---
title: Phase 0C — Search baseline and launch envelope
status: ready
created: 2026-08-21
---

# Phase 0C — Search baseline

## Context

Existing search is a bounded linear scan. ADR 003 forbids choosing an index engine until this baseline exists.

Code:

- `src/renderer/packages/history-search/linear-scan.ts`
- `src/renderer/stores/sessionHelpers.ts` → `searchSessions`
- UI: `src/renderer/pages/SearchDialog.tsx`

Report: [discovery/search-baseline.md](./discovery/search-baseline.md). ADR: [adrs/003-search-owner-lifecycle.md](./adrs/003-search-owner-lifecycle.md).

## Measured behavior (current)

- Case-insensitive substring (regex metacharacters escaped)
- Sequential `storage.getItem` per session
- Stop after 50 matching **messages**
- Scans current messages + `threads`, not `messageForksHash`
- `getMessageText` ignores tool-call parts
- SearchDialog does not await `searchSessions` (loading flag is racy)

## Candidate launch envelope (unproven until a real corpus)

| Dimension | Candidate ceiling |
| --- | --- |
| Compressed archive | 200 MB |
| Expanded staging | 2 GB |
| Conversations | 20,000 |
| Messages | 500,000 |
| Max single text message | 1 MB |
| Disk headroom | 2× expanded + 1 GB |

In-memory 10k-message match stays under the 200 ms warm-search candidate. Desktop I/O of `session:*` keys is the likely bottleneck, not regex.

## Files

- Create `src/renderer/packages/history-search/`
- Update `sessionHelpers.ts` to call the extracted matcher
- Tests in `linear-scan.test.ts`

## Validation

Do not add FTS/SQLite history index in this phase.
