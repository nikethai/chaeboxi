---
type: researcher
date: 2026-08-21
phase: 5
---

# Phase 5: AX hybrid — implementation note

## What shipped

macOS Accessibility grounding for Computer Use, wired into the two playbooks (Calculator, WhatsApp):

- IPC: `computer:ax-query`, `computer:ax-act`
- Tools: `computer_ax_query` (LOW), `computer_focus_search` (HIGH), `computer_ax_press` (CRITICAL)
- Empty / denied / non-macOS → `{ fallback: "vision" }` so pixel playbooks stay valid
- Secure fields skipped

## Spike (honest)

No live WhatsApp Desktop AX probe on a signed binary in this change. Electron WhatsApp often exposes a thin tree — that is why fallback is first-class, not a later patch.

**Measure still required on device:** Calculator AX press 7+8=; WhatsApp `computer_focus_search` vs vision click.

## Unresolved

- WhatsApp AX yield unknown until signed-binary run
- Windows UI Automation not in scope
