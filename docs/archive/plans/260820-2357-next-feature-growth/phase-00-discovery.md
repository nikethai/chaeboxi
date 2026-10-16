---
title: Phase 0 — Continuity discovery
status: artifacts-complete-field-work-open
created: 2026-08-21
---

# Phase 0 — Continuity discovery

**Status (2026-08-21):** in-repo artifacts complete; field work open. Phase 1 **not started**.  
**Gate:** closed for MVP implementation until every exit criterion in `plan.md` passes.  
**Approved scope:** research protocols, export feasibility, search baseline, threat models, five ADRs, and two small in-repo spikes.  
**Not approved:** imported-source storage, archive IPC, search index, importer UI, or generation-path wiring.

## Workstreams

| ID | File | Owner | Status |
| --- | --- | --- | --- |
| A | [phase-00a-demand-validation.md](./phase-00a-demand-validation.md) | product | artifacts complete; recruit 8–12 open |
| B | [phase-00b-export-feasibility.md](./phase-00b-export-feasibility.md) | engineering | feasibility doc complete; consented ZIP open |
| C | [phase-00c-search-baseline.md](./phase-00c-search-baseline.md) | engineering | linear-scan spike complete; desktop `session:*` I/O timing open |
| D | [phase-00d-security.md](./phase-00d-security.md) | security | threat models + spike complete; ZIP inspector red-team open |
| E | [phase-00e-architecture-adrs.md](./phase-00e-architecture-adrs.md) | architecture | completed (5 ADRs; not an implementation license) |

## In-repo spikes (only)

- `src/renderer/packages/history-search/` — extract and measure the existing linear scan
- `src/renderer/packages/imported-context/` — send-time untrusted reference block (not wired into generation)

## Exit

Do not open Phase 1 until product, feasibility, security, and performance gates in `plan.md` all pass.

**In-repo complete:** protocols, export feasibility, search baseline spike, untrusted-context spike (delimiter neutralization, prefix packing, reason codes), five ADRs, two threat models. Focused tests 16/16. Review 8/10, 0 critical.

**Field work still open (human):** recruit 8–12, consented ChatGPT ZIP, desktop `session:*` I/O timing, ZIP inspector red-team.

**Code review 2026-08-21:** in-repo artifacts/spikes accepted with 0 criticals; untrusted-block warnings fixed. Gate stays closed. See [reports/code-review-2026-08-21.md](./reports/code-review-2026-08-21.md), [reports/phase-0-status-2026-08-21.md](./reports/phase-0-status-2026-08-21.md).
