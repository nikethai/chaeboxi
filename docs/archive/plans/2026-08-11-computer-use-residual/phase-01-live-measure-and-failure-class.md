---
phase: 1
title: "Live measure and failure class"
status: pending
priority: P0
effort: "0.5d"
dependencies: []
---

# Phase 1: Live measure and failure class

## Overview

Prove Harness v2 on a **signed dev binary** and write a single failure class (A–F). No feature work until this note exists. Prevents building AX/deep links for the wrong bug.

## Requirements

- Functional: run Calculator + WhatsApp demos; record tool cards, errors, step count, approvals.
- Non-functional: use vision model; Computer Use armed; Screen Recording + Accessibility for **this** binary.

## Architecture

Measure only — no new architecture. Output is a short report under this plan dir.

## Related Code Files

- Docs: `docs/computer-use.md` (dev signing notes)
- Scripts: `scripts/tauri-dev-macos.mjs`, `scripts/macos-sign-dev-binary.sh`
- Observe results: tool cards in UI (no code change required)

## Implementation Steps

1. **Binary**
   - Run `pnpm dev` (or signed debug `src-tauri/target/debug/chaeboxi`).
   - Confirm **not** App Store install.
   - If needed: `pnpm dev:sign`; fully quit; relaunch.

2. **Permissions**
   - System Settings → Privacy → Screen Recording + Accessibility → enable **this** Chaeboxi/chaeboxi entry.
   - Settings → Computer Use → Recheck both green.
   - Use **Reveal executable** if multiple rows.

3. **Arm**
   - Master Computer Use on; arm session; vision model (e.g. Gemini Flash vision / Claude vision).
   - Approve CRITICAL tools when prompted (do not treat deny as product bug).

4. **Demo A — Calculator**
   - Prompt: `Arm Computer Use. Open Calculator, compute 7+8, report result from screen. Keep using tools until done.`
   - Record: tool sequence, whether auto-screenshots appear, click accuracy, final answer.

5. **Demo B — WhatsApp**
   - Prompt: `Open WhatsApp, find contact <Name>, open chat, type "hi from Chaeboxi test" but do not send unless I approve. Never use Finder or Spotlight.`
   - Record: any Finder/Spotlight/`search_file_content`; whether search field found; step cap.

6. **Classify** (pick one primary)

| Class | Criteria |
|-------|----------|
| A Permissions | Capture empty / PERMISSION_DENIED / wrong binary TCC |
| B Loop | Open succeeds then model stops or only text; no click/type despite steps left |
| C Routing | Finder / Spotlight / workspace search for contact |
| D Vision/coords | Clicks consistently offset or miss keypad |
| E UI locate | WhatsApp visible but cannot find search/chat row |
| F Pass | Both demos meet success criteria |

7. **Write note**
   - Create `plans/2026-08-11-computer-use-residual/reports/measure-YYYY-MM-DD.md` with:
     - binary path / signing note
     - model id
     - tool card lists (names only is fine)
     - class letter + one sentence evidence
     - next phase from router in `plan.md`

## Success Criteria

- [ ] Dev binary used (not App Store)
- [ ] Permissions rechecked after relaunch
- [ ] Calculator demo attempted and logged
- [ ] WhatsApp demo attempted and logged
- [ ] Failure class A–F written in measure report
- [ ] Recommended next phase recorded

## Risk Assessment

- User measures App Store binary → false “harness broken”. Mitigate: check path via Reveal.
- User denies approvals → looks like B. Mitigate: log approval UI.
- No WhatsApp installed → mark WhatsApp N/A; Calculator still classifies A/B/D/F.

## Test / validation gate

Manual only. No unit tests. Exit = measure report file exists.
