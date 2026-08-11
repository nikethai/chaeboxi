---
phase: 7
title: "Trajectory debug and allowlist polish"
status: pending
priority: P3
effort: "1–2d"
dependencies: [6]
---

# Phase 7: Trajectory debug and allowlist polish

## Overview

Post-reliability polish: debug trajectories (screenshots + actions) for support, optional app allowlist like Claude Desktop, and only then consider nice-to-haves (zoom, double-click, single `computer` tool schema).

**Cook after** demos are usable (Phase 6 or stable F). Pure YAGNI until then.

## Requirements

- Functional:
  - Optional session debug export: last N verification images + tool names/args (redact secrets).
  - Optional settings: allowlist of apps computer may open/act on (default: all when armed).
- Non-functional: off by default; no perf hit when disabled.

## Architecture

```
tool execute → if debugTrajectory: append {tool, args summary, shot thumb path}
  → export zip / folder under user data
allowlist: before open_app/click, if list non-empty && target not in list → deny
```

## Related Code Files

- Create: `src/renderer/packages/computer/trajectory.ts` (or stores)
- Modify: computer tools execute wrappers
- Modify: settings schema `extension.computerUse` (debugTrajectory, appAllowlist)
- Modify: settings UI
- Docs

## Implementation Steps

1. Settings flags (default off).
2. Ring buffer of last N=10 steps with optional JPEG thumbs on disk.
3. “Export last computer trajectory” button in Computer Use settings or HUD.
4. App allowlist: empty = allow all; non-empty filters `computer_open_app` and optionally re-activate.
5. Document support workflow: export trajectory → attach to issue.
6. Explicitly **defer**: `computer_zoom`, drag, triple-click, Anthropic single-tool schema — backlog only.

## Success Criteria

- [ ] Debug off: zero behavior change
- [ ] Debug on: export contains ordered steps
- [ ] Allowlist denies Finder even if model asks (when configured)
- [ ] Tests for allowlist pure logic

## Risk Assessment

- Trajectory may capture sensitive screen data — local only, user-triggered export, warn in UI.
- Allowlist empty vs missing config bugs — treat missing as allow all.

## Test / validation gate

- Unit tests allowlist
- Manual export once
