---
phase: 6
title: "Computer Observe"
status: completed
priority: P2
dependencies: [5]
effort: "3-5 days"
---

# Phase 6: Computer Observe

## Overview

Add **use_computer observe-only**: agent can capture the screen (chosen display) under OS permission + settings opt-in + session arm. No mouse/keyboard yet. Reuses lessons from screenshot-to-chat but **must not** conflate region-snip UX with agent full-display capture.

**Train B** — after M2 browser GA (D13). May be planned/spiked earlier but not required for browser ship.
<!-- Updated: Validation Session 1 - D13 -->

## Requirements

### Functional
- Settings: `computerUse.enabled` default false
- Session arm separate from browser
- Tool: `computer_screenshot` → compressed image tool result for vision models
- Display picker when multi-monitor (default: display under cursor or primary)
- OS permission onboarding (macOS Screen Recording; Windows analogous)
- Non-vision models: clear error `VISION_REQUIRED`
- Web/mobile: unavailable

### Non-functional
- Image size budget (resize max width e.g. 1280–1600)
- Rate limit screenshots per turn
- Never auto-arm
- Distinct IPC from `shell:captureScreenshot` region snip (shared primitives OK)

## Architecture

```text
computer_screenshot
  → approvals (MEDIUM/HIGH — screen may show secrets)
  → ComputerController.captureDisplay(displayId)
  → Rust capture backend
  → PNG/JPEG bytes → tool result as image part for model
```

### Permission UX

```text
Arm computer → check permission
  if missing → open OS settings deep link / instructions modal
  if denied → fail closed
```

### Separation from snip-to-chat

| | Snip-to-chat | computer_screenshot |
|--|--------------|---------------------|
| Trigger | Hotkey/tray human | Agent tool |
| Region | Interactive region | Full display (or selected) |
| Destination | User message attach | Tool result to model |

## Related Code Files

- Create: `src-tauri/src/computer_manager.rs` (or `display_capture` module)
- Modify: `lib.rs` IPC `computer:*`
- Modify: `platform/interfaces.ts` — ComputerController
- Create: `toolsets/computer.ts` (observe tools only)
- Modify: `stream-text.ts` + generation gates
- Modify: settings UI + session arm control
- Modify: risk-engine
- Read: `desktop_shell.rs` capture helpers — extract shared image encode if useful
- Tests: gate logic; mock capture in unit tests

## Implementation Steps

1. Define ComputerController with `listDisplays`, `captureDisplay`, `getPermissionStatus`.
2. Implement macOS capture path first (primary desktop); Windows second; Linux best-effort or stub error.
3. Toolset + stream-text wiring; vision check.
4. Settings + arm UX + permission modal.
5. Compression/resize pipeline.
6. Manual test: arm → ask "what is on my screen?" with vision model.
7. Report `reports/phase-06-observe.md` (OS matrix).

## Todo List

- [x] Controller + IPC
- [x] computer_screenshot tool
- [x] Permission + arm UX
- [x] Vision gate
- [x] OS matrix notes

## Success Criteria

- [x] With permission + arm + vision model, agent describes screen content
- [x] Without permission or arm, tool fails closed with actionable message
- [x] Region snip-to-chat still works unchanged
- [x] No click/type APIs exposed yet

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Secret leakage via screen to model | Approval + warning copy; user education |
| Multi-monitor wrong display | Picker + default primary |
| Reusing snip API incorrectly | Separate channels; RT4 |

## Security Considerations

- Screen content is untrusted input (injection) — same as browser DOM
- Do not store raw screenshots in long-term logs by default
- Approval recommended each screenshot or first-in-session policy documented

## Next Steps

Phase 7 adds act + ship gates.
