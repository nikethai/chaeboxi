---
phase: 7
title: "Computer Act and Ship Gates"
status: completed
priority: P2
dependencies: [6]
effort: "5-10 days"
---

# Phase 7: Computer Act and Ship Gates

## Overview

Add **input actuation** (click/type/key/scroll) with forced approvals, global abort hotkey, and persistent "agent controlling computer" HUD. Close with docs, tests, OS matrix, and M4 ship gates. Linux may ship experimental.

**Train B only** — starts after browser M2 GA shipped or explicitly scheduled post-M2 (D13). Do not block Train A.
<!-- Updated: Validation Session 1 - D13 train B -->

## Requirements

### Functional
- Tools: `computer_click`, `computer_type`, `computer_key`, `computer_scroll` (coords in documented coordinate space)
- Optional: `computer_mouse_move`
- Always HIGH/CRITICAL risk; **no session auto-approve for CRITICAL** — relies on Phase 3 global wrap fix (D8); add regression test
- HUD overlay while computer run active; global hotkey abort (configurable)
- Coordinate space: logical pixels matching screenshot dimensions returned to model
- macOS: Accessibility permission required for act
- Windows: act via SendInput/UIA as chosen in impl spike within phase
- Linux: experimental or disabled with clear error

### Non-functional
- Batching: optional approve N actions — default every action or every tool call
- Abort stops further acts within 1s best-effort
- Demo path: Calculator or Settings (documented)
- Full docs: `docs/computer-use.md`
- Update PDR / architecture docs

## Architecture

```text
computer_click { x, y, button }
  → CRITICAL approval (no auto)
  → map coords (screenshot space → display space)
  → OS inject
  → optional auto-screenshot return for next model step
```

### Coordinate mapping

```text
Model sees screenshot size (Ww x Wh)
Display logical size (Dw x Dh) + scale factor
x_display = x_model * (Dw/Ww)
```

Document DPI/retina behavior per OS in docs.

### HUD + abort

```text
computer session armed + act tool running
  → show HUD window (always on top, click-through optional except Stop)
  → register abort hotkey
  → abort: cancel generation + disable act until re-arm
```

## Related Code Files

- Modify: `computer_manager` + OS-specific input modules
- Modify: `toolsets/computer.ts` — act tools
- Modify: risk-engine — CRITICAL for act
- Modify: approval wrap — never auto-approve CRITICAL
- Create: HUD component / small Tauri window
- Modify: shortcuts settings
- Create: `docs/computer-use.md`
- Modify: `docs/system-architecture.md`, PDR inventory
- Tests: mapping unit tests; approval policy tests; gates

## Implementation Steps

1. Spike OS input injection on macOS + Windows; record limitations.
2. Implement coord mapping + unit tests.
3. Add act tools with CRITICAL tier.
4. Enforce no auto-approve for CRITICAL in wrapToolsWithApproval.
5. HUD + abort hotkey.
6. Accessibility permission onboarding (macOS).
7. End-to-end demo script documented.
8. OS support matrix in docs (macOS/Windows supported; Linux experimental).
9. Final ship report `reports/phase-07-m4-ship.md`.
10. Regression: browser M1/M2 still green; snip-to-chat unchanged.

## Todo List

- [x] Input injection macOS/Windows
- [x] Coord mapping tests
- [x] CRITICAL approval policy
- [x] HUD + abort
- [x] Docs + ship matrix
- [x] Regression suite

## Success Criteria

- [x] Demo flow works on at least one primary OS with vision model
- [x] User abort prevents further injection
- [x] Denied act produces zero input events
- [x] Browser agent regression pass
- [x] Docs complete; feature flags default safe (CU off)
- [x] `pnpm test` / `pnpm check` / `pnpm lint` on touched areas pass

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Accidental destructive clicks | CRITICAL approval; HUD; abort |
| Coord mismatch retina | Mapping tests; return screenshot size metadata every capture |
| Store review / permission scary | Clear copy; opt-in defaults |
| Linux sinkhole | Mark experimental; don't block M4 on Linux |

## Security Considerations

- Screen + input = full user-equivalent control — highest product risk
- Prompt injection via on-screen text is real — keep approvals
- Never log keystrokes that look like passwords
- Disarm on app background optional future; document known gap if not implemented
- Provider-native CU adapters (if any later) **must** call this controller (RT9)

## Ship checklist (M4)

- [x] CU master default off
- [x] Permissions fail closed
- [x] HUD + abort verified
- [x] Threat model updated with residual risks
- [x] Support playbook snippet (what to tell users)

## Next Steps

Post-v1 ideas (not this plan): user Chrome profile attach; provider-native grounding adapters; AX-tree desktop observe; enterprise allowlists.
