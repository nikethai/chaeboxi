---
title: Phase 0 — Continuity discovery
status: in-progress
created: 2026-08-21
---

# Phase 0 — Continuity discovery

**Gate:** closed for MVP implementation until every exit criterion in `plan.md` passes.  
**Approved scope:** research protocols, export feasibility, search baseline, threat models, five ADRs, and two small in-repo spikes.  
**Not approved:** imported-source storage, archive IPC, search index, importer UI, or generation-path wiring.

## Workstreams

| ID | File | Owner |
| --- | --- | --- |
| A | [phase-00a-demand-validation.md](./phase-00a-demand-validation.md) | product |
| B | [phase-00b-export-feasibility.md](./phase-00b-export-feasibility.md) | engineering |
| C | [phase-00c-search-baseline.md](./phase-00c-search-baseline.md) | engineering |
| D | [phase-00d-security.md](./phase-00d-security.md) | security |
| E | [phase-00e-architecture-adrs.md](./phase-00e-architecture-adrs.md) | architecture |

## In-repo spikes (only)

- `src/renderer/packages/history-search/` — extract and measure the existing linear scan
- `src/renderer/packages/imported-context/` — send-time untrusted reference block (not wired into generation)

## Exit

Do not open Phase 1 until product, feasibility, security, and performance gates in `plan.md` all pass. Field recruiting and real export custody remain human work.

**Code review 2026-08-21:** in-repo artifacts/spikes accepted with 0 criticals. Gate stays closed. See [reports/code-review-2026-08-21.md](./reports/code-review-2026-08-21.md).
