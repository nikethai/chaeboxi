---
title: Phase 0D — Security and privacy
status: artifacts-complete-field-work-open
created: 2026-08-21
---

# Phase 0D — Security and privacy

**In-repo:** two threat models; untrusted-block spike with delimiter neutralization, prefix packing, omitted reason codes (not wired to send).  
**Open (human):** red-team of a real ZIP inspector (inspector not written).

## Context

Archive ingestion and imported-context handoff are the two new trust boundaries. Threat models:

- [discovery/threat-model-archive-ingestion.md](./discovery/threat-model-archive-ingestion.md)
- [discovery/threat-model-imported-context.md](./discovery/threat-model-imported-context.md)

Custody: [discovery/consent-custody-protocol.md](./discovery/consent-custody-protocol.md).

Spike (not wired to send): `src/renderer/packages/imported-context/untrusted-reference-block.ts`.

## Requirements

- Privileged ZIP inspection stays in Tauri, never in the renderer
- Hard size, depth, and amplification limits
- No HTML/SVG preview of imported content in v1
- Content-free diagnostics by default
- Imported system/tool records omitted from handoff
- First continuation: MCP / browser / computer / agent coding default off
- `memoryAutoSave: false` on first continuation; imported text never auto-retained
- Research exports never committed; redact before any fixture

## Files

Discovery markdown only, plus the untrusted-block unit tests.

## Validation

No unresolved path traversal, active-content execution, credential leak, or unbounded resource finding before Phase 1. Adversarial imported text must not become a system instruction or arm tools without an explicit user action.
