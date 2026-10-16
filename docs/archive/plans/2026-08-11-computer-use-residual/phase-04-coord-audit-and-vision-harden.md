---
phase: 4
title: "Coord audit and vision harden"
status: pending
priority: P1
effort: "0.5–1d"
dependencies: [1]
---

# Phase 4: Coord audit and vision harden

## Overview

Fix **systematic** click misses (class **D**). Align image dimensions the model sees with coordinate mapping and act space. Optional zoom only if dense UI still fails after contract audit.

**Cook only if:** Phase 1 class D (Calculator keypad misses, consistent offset).

## Requirements

- Functional: clicks land on intended large targets (Calculator digits) ≥3/3.
- Non-functional: no change to tool API unless adding optional zoom; keep JPEG max width ~1280.

## Architecture

```
Capture (native) → resize → JPEG bytes + (w,h)
  → model sees (w,h)
  → click (x,y) in that space
  → map_coords: x_act = x * actW/w
  → inject click in points (macOS CGDisplayBounds)
```

Audit every hop; log once in debug.

Industry note (Anthropic): silent provider downscale without host knowing breaks clicks — ensure we never send dimensions ≠ actual image; pre-downscale already at ~1280.

## Related Code Files

- Modify: `src-tauri/src/computer_manager.rs` (capture, map_coords, meta)
- Modify: `src/renderer/packages/model-calls/toolsets/computer.ts` (return dims)
- Modify: `src/renderer/packages/computer/coords.ts` if client-side map exists
- Tests: `coords.test.ts`, Rust unit tests for map
- Optional: zoom crop helper later

## Implementation Steps

1. **Contract assert** (debug or test): after capture, decoded JPEG width/height === reported width/height.
2. **Trace one click**: log model (x,y), screenshot (w,h), act (W,H), mapped (mx,my).
3. **Fix** any mismatch (double Retina scale, wrong act size, aspect-destroying resize).
4. **Preserve aspect** on resize (verify current `resize_exact` vs aspect-safe — fix if distortion).
5. **Optional YAGNI gate:** if large targets work but tiny targets fail, add `computer_zoom` region later (separate PR); do not block ship.
6. Re-run Calculator 3/3.

## Success Criteria

- [ ] Documented coordinate pipeline in `docs/computer-use.md` matches code
- [ ] Calculator click accuracy 3/3 on measured machine
- [ ] Unit tests cover map identity + retina scale cases
- [ ] No silent double-scale

## Risk Assessment

- Changing resize algorithm shifts all models’ muscle memory slightly — re-test WhatsApp after.
- Debug logs in production → gate behind debug flag.

## Test / validation gate

- Rust: `cargo test` computer_manager map tests
- Frontend: coords tests
- Manual Calculator
