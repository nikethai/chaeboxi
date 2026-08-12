# Browser / Computer Reliability

**Status:** complete (code) — live demos still manual  
**Date:** 2026-08-12  
**Goal:** Stop Browser/Computer looking "stupid" due to harness defects (not model swap).

## Phase 1 — P0 (done)

1. Wire `browserAgent.maxStepsPerTurn` into generation `maxSteps` when browser armed
2. Release browser **run lock** on every generation exit (keep process warm)
3. Atomic browser refs (single DOM pass + element marks)
4. Auto-snapshot after browser navigate/click/type/scroll; return snapshot on REF_INVALID
5. Fix approval vs execute timeout layering (120s approval must not die at 90s)
6. Raise computer screenshot budget default to align with 16-step floor

## Phase 2 — finish harness (this pass)

1. Exclusive interaction lease: Computer Use strips `browser_*` (+ collision tools)
2. Computer frameId freshness on capture → click/move
3. Unified `prepareStep` image prune for browser and/or computer; force re-observe when needed
4. Browser dead-host recovery (status/RPC failure → restart once)
5. HIGH tools honor session approval (CRITICAL still never auto)
6. Clear computer target-app state when generation ends
7. Browser screenshots as JPEG; track last browser tool for force-snapshot
8. Docs + tests

## Explicitly deferred (need device / product decision)

- Full macOS AX search-field hybrid (Phase 5 residual) — thin `computer_frontmost` remains
- Live signed-binary demos / App Store ship (human)
- Hermes/Pi runtime swap
- Single-schema Anthropic `computer` tool rewrite

## Acceptance

### Phase 1
- [x] Browser armed uses configured steps (default ≥12)
- [x] Run lock released after success
- [x] Atomic refs + auto snapshot + REF_INVALID recovery
- [x] Approval/execute timeout split
- [x] Screenshot budget default 16

### Phase 2
- [x] Computer lock strips browser tools
- [x] frameId stale rejection
- [x] prepareStep prune for browser-only turns
- [x] Dead browser host restart
- [x] HIGH session auto after user allow-session
- [x] Tests green
