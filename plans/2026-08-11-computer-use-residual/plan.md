---
title: "Computer Use Residual — Measure to Ship"
description: "Finish Chaeboxi Computer Use after Harness v2: live measure, class-based fixes, app playbooks/deep links, optional coord/AX, ship, polish."
status: in-progress
priority: P1
branch: "main"
tags: [computer-use, agent-harness, desktop, macos]
blockedBy: []
blocks: []
created: "2026-08-11T07:15:14.237Z"
createdBy: "ck:plan"
source: skill
related:
  - docs/research/2026-08-11-computer-use-industry-parity.md
  - docs/plans/2026-08-11-computer-use-parity/plan.md
  - docs/computer-use.md
  - plans/2026-08-11-use-browser-use-computer/
---

# Computer Use Residual — Measure to Ship

## Implementation progress (code)

| Phase | Code status |
|-------|-------------|
| 1 Measure | Template only — **user must run live demos** (`reports/measure-template.md`) |
| 2 Fix-by-class | **Harness hardened 2026-08-12** — exclusive browser strip, frameId, step/screenshot budgets, prepareStep prune (see `plans/2026-08-12-browser-computer-reliability/`) |
| 3 Playbooks + deep links | **Implemented** — `computer-playbooks.ts`, `computer_open_uri`, phone extract |
| 4 Coord audit | **frameId + map_coords stale reject** in `computer_manager.rs`; live verify on device still recommended |
| 5 AX hybrid | **Implemented 2026-08-21** — `computer_ax_query` / `computer_focus_search` / `computer_ax_press`; vision fallback |
| 6 Ship UX | Settings binary warning + allowlist/trajectory section; **release binary still manual** |
| 7 Trajectory + allowlist | **Implemented** — settings + `trajectory.ts` |

## Overview

Harness v2 is **in repo** (auto-screenshot after act, `computer_wait`, UI lock, Finder/Spotlight guards, step floor 16, prepareStep force-shot + image prune). Product is **not done**: no live failure class on a signed dev binary, no shipped App Store/TestFlight binary with these fixes, and WhatsApp-class reliability may still need playbooks / deep links / optional AX.

This plan covers **everything left** from measure → ship → polish. It is the cook target for residual Computer Use work.

**Principles:** YAGNI · KISS · DRY · no cloud VM · fix by measured failure class · skills before AX.

## Already done (do not re-cook)

| Area | Where |
|------|--------|
| Coord map screenshot→act | `src-tauri/src/computer_manager.rs` |
| Open + activate app | same |
| Hotkey chords | same |
| Auto verification screenshot after act | `toolsets/computer.ts` |
| `computer_wait` | same |
| prepareStep force screenshot + prune | `stream-text.ts`, `abstract-ai-sdk.ts` |
| UI space lock (strip search_file_content) | `computer-ui-lock.ts` |
| Block Finder open / Spotlight keys | `computer-harness.ts` + computer tools |
| min steps 16 / screenshot budget 16 | `generation.ts`, settings |
| Industry research | `docs/research/2026-08-11-computer-use-industry-parity.md` |

## Success criteria (product)

| Demo | Pass |
|------|------|
| Calculator | open → 7 + 8 = → correct on verification image |
| WhatsApp | open → **in-app** find contact → compose message (send optional / approval) |
| Negative | No Finder / Spotlight / `search_file_content` for “find contact” |
| Binary | User on **new** build (dev signed or TestFlight/App Store) with harness |
| Permissions | Clear which binary has TCC; recheck works |

## Non-goals

- Operator-style remote/cloud VM  
- Universal RPA for every Mac app  
- WhatsApp Business API / hosted connectors (Perplexity-style product)  
- Replacing multi-model stack with Claude-only official CU tool  
- Full single-schema Anthropic `computer` tool rewrite (P3 later if needed)

## Failure class router (from Phase 1)

| Class | Symptom | Next phase |
|-------|---------|------------|
| **A Permissions** | empty capture, PERMISSION_DENIED, wrong binary | Phase 6 (also unblock demos) |
| **B Loop** | open then text-only / no acts / step starve | Phase 2 |
| **C Routing** | Finder / Spotlight / workspace search | Phase 2 (+ existing lock audit) |
| **D Vision/coords** | clicks systematically miss | Phase 4 |
| **E UI locate** | right app, wrong control (search field) | Phase 3 → if fail Phase 5 |
| **F Pass** | demos green | Phase 6 ship; Phase 7 optional |

**Rule:** Do not start Phase 5 (AX) if Calculator fails. Do not start Phase 3 until Phase 1 class is written.

## Phases

| Phase | Name | Priority | Effort | Depends |
|-------|------|----------|--------|---------|
| 1 | [Live measure and failure class](./phase-01-live-measure-and-failure-class.md) | P0 | 0.5d | — |
| 2 | [Fix by failure class](./phase-02-fix-by-failure-class.md) | P0 | 0.5–2d | 1 |
| 3 | [App playbooks and deep links](./phase-03-app-playbooks-and-deep-links.md) | P1 | 2–3d | 1 (class E or flaky WhatsApp) |
| 4 | [Coord audit and vision harden](./phase-04-coord-audit-and-vision-harden.md) | P1 | 0.5–1d | 1 (class D) |
| 5 | [Accessibility hybrid grounding](./phase-05-accessibility-hybrid-grounding.md) | P2 | 3–5d | 3 insufficient |
| 6 | [Ship release and permissions UX](./phase-06-ship-release-and-permissions-ux.md) | P0 | 1–2d | smoke green or class A fixed |
| 7 | [Trajectory debug and allowlist polish](./phase-07-trajectory-debug-and-allowlist-polish.md) | P2–P3 | 1–2d | 6 or stable demos |

## Recommended cook order

```
Phase 1 (measure)
  → Phase 2 (only if A/B/C)
  → Phase 4 (only if D)
  → Phase 3 (WhatsApp flaky / E)
  → Phase 5 (only if 3 fails)
  → Phase 6 (ship)   // can parallel after Calculator smoke
  → Phase 7 (polish)
```

## Architecture (residual)

```
User goal
  → Computer armed + vision model
  → Harness v2 loop (done): act → auto shot → prepareStep prune/force
  → [Phase 3] App skill / deep link when phone or known app
  → [Phase 5] AX focus search field if vision cannot
  → Approvals on CRITICAL acts
  → [Phase 6] Same code in shipped binary + TCC UX
```

## Key code map

| Layer | Paths |
|-------|--------|
| Tools | `src/renderer/packages/model-calls/toolsets/computer.ts` |
| Harness pure | `.../computer-harness.ts` |
| UI lock | `.../computer-ui-lock.ts` |
| Loop | `stream-text.ts`, `abstract-ai-sdk.ts`, `generation.ts` |
| Backend | `src-tauri/src/computer_manager.rs`, `src-tauri/src/ax_assist/` |
| Platform | `src/renderer/platform/interfaces.ts`, `desktop_platform.ts` |
| Settings UI | `src/renderer/routes/settings/computer-use.tsx` |
| Docs | `docs/computer-use.md` |
| Prior plan | `docs/plans/2026-08-11-computer-use-parity/plan.md` |
| Research | `docs/research/2026-08-11-computer-use-industry-parity.md` |

## Cross-plan

- **Supersedes residual work** listed as not started in `docs/plans/2026-08-11-computer-use-parity/plan.md` (phases 3–5 there).  
- Complements earlier browser/computer train plan under `plans/2026-08-11-use-browser-use-computer/` — do not re-implement browser M2 here.

## Risks

| Risk | Mitigation |
|------|------------|
| Coding against App Store binary | Phase 1 forces dev signed binary |
| Building AX before measure | Class router forbids it |
| Deep links differ by WhatsApp version | Validate schemes on device; UI fallback |
| Auto-screenshot burns budget | Already max 10/turn; Phase 7 trajectory optional |
| Approval fatigue looks like “stuck” | Docs + measure must note approve clicks |

## Open questions

1. Prefer TestFlight vs local notarized release first?  
2. WhatsApp Desktop vs force WhatsApp Web via browser agent as supported path?  
3. Invest in AX this quarter only if Phase 3 fails — confirm product appetite.

## Cook handoff

```bash
# After Phase 1 notes exist:
/ck:cook plans/2026-08-11-computer-use-residual

# Or single phase:
/ck:cook plans/2026-08-11-computer-use-residual/phase-03-app-playbooks-and-deep-links.md
```

**Phase 5 cooked 2026-08-21** (product asked for full AX + the two playbooks). Live WhatsApp AX yield still needs a signed-binary measure.
