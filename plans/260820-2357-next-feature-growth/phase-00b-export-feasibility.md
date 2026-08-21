---
title: Phase 0B — Export feasibility
status: ready
created: 2026-08-21
---

# Phase 0B — Export feasibility

## Context

v1 allows **one** verified provider adapter. Report: [discovery/export-feasibility.md](./discovery/export-feasibility.md).

## Decision

**v1 importer: ChatGPT account export ZIP (`conversations.json`).**  
Claude conversation export now exists officially, but schema is still unofficial and branching. Keep Claude as Phase 2 until consented real samples exist.

## Requirements

- Detect ChatGPT ZIP by `conversations.json` presence, not filename alone.
- Catalogue account/date variants only from consented samples.
- Golden fixtures only after a real export is verified and sanitized.
- Do not commit real user exports.
- Native Chaeboxi JSONL is a library (`src/renderer/packages/session-export/`) and is **not** the vendor-archive importer. UI export is Markdown/TXT/HTML viewing copies. Restorable backup is history-transfer JSON.

## Files

- `discovery/export-feasibility.md`
- Later (Phase 1, gated): desktop archive inspector, ChatGPT adapter

## Validation

Discovered records = imported + skipped + failed. No partial source marked complete.

## Risks

OpenAI has changed `conversations.json` and attachment IDs without a public schema. Pin a format version per verified sample set.
