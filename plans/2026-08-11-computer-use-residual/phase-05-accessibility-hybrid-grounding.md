---
phase: 5
title: "Accessibility hybrid grounding"
status: implemented
priority: P2
effort: "3–5d"
dependencies: [3]
---

# Phase 5: Accessibility hybrid grounding

## Overview

Add **macOS Accessibility** assist to focus known roles (e.g. search field) when vision playbooks fail. Hybrid: AX first for focus, vision for everything else.

**Cook only if:** Phase 1 class E **and** Phase 3 playbooks/deep links still insufficient.  
**Do not cook if:** Calculator (class D) still fails.

## Requirements

- Functional: focus in-app search (or equivalent) in target app without pixel click ≥4/5 when AX available.
- Non-functional: graceful fallback to vision when AX tree empty (Electron WhatsApp often weak).
- Privacy: uses existing Accessibility permission; no new silent TCC.

## Architecture

```
computer_focus_search / internal pre-step
  → NSWorkspace frontmost == target?
  → AXUIElement tree walk: role search field / AXDescription heuristics
  → AX press/focus → type via existing computer_type
  → auto screenshot verify
  → if AX miss: return { ok:false, fallback:"vision" }
```

Systems boundary: Rust backend owns AX; renderer tool is thin IPC.

## Related Code Files

- Modify: `src-tauri/src/computer_manager.rs` (or new `ax_assist.rs` module)
- Modify: platform IPC + `interfaces.ts` / `desktop_platform.ts`
- Modify: `toolsets/computer.ts` — `computer_focus_search` or harness pre-type
- Docs: Accessibility usage section
- Tests: limited (mock or integration macOS-only)

## Implementation Steps

1. Spike: can AX see WhatsApp Desktop search field on target machine? Document yes/no.
2. If no for WhatsApp Electron: narrow scope to apps with good AX (Calculator, native Messages) OR abandon Phase 5 for WhatsApp and push browser fallback.
3. Implement `frontmost_app_name` query (more reliable than last open meta).
4. Implement find+focus search field heuristics.
5. Tool + approval tier (HIGH/CRITICAL — focusing can steal input).
6. Integrate with target app lock (refuse focus outside target).
7. Manual matrix: Messages / Safari / WhatsApp.

## Success Criteria

- [ ] Spike result documented in plan reports/
- [ ] If spike OK: focus tool works ≥4/5 on at least one messaging app
- [ ] Vision fallback path unchanged when AX fails
- [ ] No requirement for AX on non-macOS (stub unsupported)

## Risk Assessment

- High engineering cost for low WhatsApp AX yield — spike first, kill switch.
- Focus stealing from user mid-type — only when computer armed + act allowed.
- App Store sandbox / entitlement checks — verify entitlement already present for Accessibility.

## Test / validation gate

- Spike report required before full implementation
- Manual demos; optional `#[cfg(target_os = "macos")]` tests
