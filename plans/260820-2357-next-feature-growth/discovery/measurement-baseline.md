# Retention and session-reuse baseline

**Date:** 2026-08-21  
**Product telemetry:** off (`TELEMETRY_ENABLED = false` in `src/shared/product.ts`)

## What we cannot claim

Chaeboxi has no shipped opt-in analytics pipeline. There is no install→provider→week-1 retention number in-repo. Do not invent percentages.

## What exists today (local, on-device)

| Signal | Where | Use in Phase 0 |
| --- | --- | --- |
| Session list + `updatedAt` | `chat-sessions-list` / `session:*` | Count sessions touched in last 7/28 days on a volunteer machine |
| History search opens | `SearchDialog` — no counter | Add a **versioned local counter only if a volunteer opts in** during discovery; do not ship telemetry |
| Native continuation | New session / thread / fork | Manual observation in Task A |
| Usage rollup | `StorageKey.UsageRollup` | Optional: days with ≥1 generation, not identity |
| History sync | `history-sync-state` | Irrelevant to imports (must stay excluded) |

## Discovery measurement (required)

Use the task sheet in `task-scripts.md`. Export a CSV per participant from the researcher laptop, not from the product.

Product success gates in `plan.md` (repeat-week use, retrieval@k, time saved) stay **unfilled** until Session 1+2 complete.

## If a later beta needs in-app counters

Design only (not implemented now):

- Key: `continuity-local-counters` (not synced, not in history transfer)
- Events: `import_started`, `import_finished`, `search_query`, `handoff_preview_shown`, `handoff_sent`, `source_deleted` — counts and durations, **no query strings, no excerpts**
- Off by default; show the counter dump in Settings so a participant can export it

Do not enable GA4/Sentry for this.
