---
phase: 1
title: "Spec Threat Model and Spike"
status: completed
priority: P1
dependencies: []
effort: "2-4 days"
---

# Phase 1: Spec Threat Model and Spike

## Overview

Lock product copy, threat model, and defaults. Run a **Playwright MCP spike** against Chaeboxi's existing MCP client to prove agent browser loops and surface approval/UX gaps before building a first-party sidecar.

## Requirements

### Functional
- Written product spec: user stories, settings defaults, room policy, kill behavior
- Threat model: injection, credentials, payments, multi-agent, data exfil
- Spike: agent completes ≥2 public-web tasks via MCP browser tools
- Go/no-go memo: first-party controller vs MCP-only power feature

### Non-functional
- No production code path depends on MCP remaining forever
- Spike artifacts under `plans/260811-1011-use-browser-use-computer/reports/`
- Defaults documented for open questions if product owner silent

## Architecture

```text
Human installs Playwright MCP (or npx)
  → Chaeboxi MCP settings → start server
  → Agent tool loop uses MCP tools
  → Observer notes: snapshot size, approval friction, crashes, login walls
  → Report → Phase 2 decision
```

Parallel doc track (no runtime dependency):

```text
docs/ draft: browser-agent.md (spec only)
threat-model.md in reports/
```

## Related Code Files

- Read: `src/renderer/packages/mcp/controller.ts` — MCP start/list/call
- Read: `src/renderer/packages/model-calls/stream-text.ts` — tool assembly + approval wrap
- Read: `docs/system-architecture.md`, `docs/integrations.md`
- Create: `plans/.../reports/phase-01-spike-findings.md`
- Create: `plans/.../reports/phase-01-threat-model.md`
- Create (draft): `docs/browser-agent.md` (or hold until Phase 4)

## Implementation Steps

1. **Product lock sheet** — Validation Session 1 locked D11–D16; record in threat-model report:
   - Chromium: system Chrome/Edge CDP; download fallback (D11)
   - Headful default true (D12)
   - CU separate train after M2 (D13)
   - Discuss rooms: browser off; single-agent + Work lead only (D10)
   - Downloads: workspace folder; no workspace → block (D14)
   - Allowlist off by default (D15)
<!-- Updated: Validation Session 1 - product defaults locked -->
2. **Threat model** — STRIDE-lite for browser + future CU; map mitigations to phases.
3. **Acceptance scenarios (M1)** — write 3 scripts:
   - Navigate docs site + extract heading via snapshot
   - Multi-step form on public fixture
   - User deny mid-click; no side effect
4. **Spike setup** — configure Playwright MCP desktop; document exact MCP JSON for Chaeboxi settings.
5. **Run scenarios** — capture tokens/step, failures, approval UX pain, whether built-in tools bypass wrap.
6. **Go/no-go**:
   - **Go first-party** if spike works but UX/approval/product control insufficient (expected).
   - **Hold** only if Playwright cannot run on target desktop OS at all.
7. **File findings report** with screenshots/logs redacted. **Hard gate:** no Phase 2 controller/sidecar code until go/no-go written (D9).
<!-- Updated: Validation Session 1 - spike required gate -->

## Todo List

- [x] Product lock defaults written
- [x] Threat model report
- [x] M1 scenarios listed
- [x] MCP spike run
- [x] Go/no-go recorded

## Success Criteria

- [x] `reports/phase-01-threat-model.md` exists with top 10 threats + phase mapping
- [x] `reports/phase-01-spike-findings.md` includes go/no-go and evidence
- [x] D1–D10 from plan.md unchanged or explicitly amended with rationale
- [x] No production feature flag shipped yet (spike only)

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Spike becomes permanent architecture | Hard stop: M1 requires Phase 2 controller |
| MCP install fails on contributor machines | Document OS prereqs; allow fixture-only later |
| Scope creep into CU in phase 1 | CU only threat-model text, no CU spike |

## Security Considerations

- Spike may use real network — no banking/prod accounts
- Do not commit cookies, storage state, or secrets from spike profile
- Redact URLs with tokens from reports

## Next Steps

Phase 2 starts only on **go first-party** (or hybrid: MCP optional power + first-party default).
