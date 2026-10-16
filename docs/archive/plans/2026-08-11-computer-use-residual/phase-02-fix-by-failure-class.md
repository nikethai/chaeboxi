---
phase: 2
title: "Fix by failure class"
status: pending
priority: P0
effort: "0.5–2d"
dependencies: [1]
---

# Phase 2: Fix by failure class

## Overview

Targeted fixes for classes **A/B/C** (and trivial regressions) from Phase 1. Skip this phase if class is D/E/F (go Phase 4 / 3 / 6).

## Requirements

- Functional: demos progress past the measured blocker without redesigning the whole harness.
- Non-functional: keep YAGNI — no AX, no deep links here unless a one-line guard.

## Architecture

Branch on class:

```
A → permissions / signing / messaging (product UX may land in Phase 6)
B → loop: prepareStep, maxSteps, approval, nextAction embedding
C → routing: strengthen lock / blocked apps / tool strip
```

## Related Code Files

- Modify: `src/renderer/packages/model-calls/stream-text.ts`
- Modify: `src/renderer/packages/model-calls/toolsets/computer.ts`
- Modify: `src/renderer/packages/model-calls/toolsets/computer-ui-lock.ts`
- Modify: `src/renderer/packages/model-calls/toolsets/computer-harness.ts`
- Modify: `src/renderer/stores/session/generation.ts` (maxSteps only if needed)
- Modify: `src/renderer/packages/model-calls/wrap-tools-approval.ts` / risk if approval blocks observe
- Docs: `docs/computer-use.md`

## Implementation Steps

### Class A — Permissions (minimal code)

1. Confirm capture path uses in-process CG (already documented).
2. If Recheck green but capture fails: log exact error string from tool card into measure report; fix only if code path maps wrong error.
3. Prefer Phase 6 UX (binary identity) over deep TCC engineering.
4. Re-run Demo A after fix.

### Class B — Loop stop

1. Verify `session.computerArmed` → `COMPUTER_USE_MIN_STEPS` (16) applied.
2. Verify auto-screenshot embed after `computer_open_app` (toModelOutput image-data).
3. Verify `prepareStep` forces `computer_screenshot` when last act had no embed.
4. Check approvals: act tools waiting ≠ model stop — document for user.
5. If model still stops: strengthen system line “goal incomplete until verification shows result”; optional raise floor 16→20 only with evidence.
6. Re-run Calculator.

### Class C — Routing

1. Confirm `search_file_content` stripped when computer tools active.
2. Confirm Finder open returns `BLOCKED_APP`.
3. Confirm `cmd+space` blocked with target app set.
4. If model still opens Spotlight via other chord: extend `isSpotlightLikeKey`.
5. If browser tools steal goal: demote browser when computer armed and no URL in user message (small filter — only if measured).
6. Re-run WhatsApp find prompt.

### Shared

1. Add/adjust unit tests only for pure helpers changed.
2. Update measure report with “post-fix class”.

## Success Criteria

- [ ] Only code for measured class(es) changed
- [ ] Re-demo shows progression (new class or F)
- [ ] No AX / deep link scope creep
- [ ] Unit tests green if helpers touched

## Risk Assessment

- Fixing B by infinite steps → cost explosion. Cap still required.
- Over-blocking apps (C) breaks file tasks. Keep block list messaging-oriented.

## Test / validation gate

- `pnpm test -- src/renderer/packages/model-calls/toolsets/computer-harness.test.ts`
- Manual re-demo of failing scenario
