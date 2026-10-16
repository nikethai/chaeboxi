---
title: "use_browser and use_computer"
description: "Desktop-first agent browser (isolated Chromium + structured tools) then opt-in computer use (observe → act) with approvals, kill switch, and BYOK model-agnostic tools."
status: completed
priority: P1
branch: "main"
tags: [feature, agent-tools, desktop, security, browser, computer-use]
blockedBy: []
blocks: []
created: "2026-08-11"
createdBy: "ck:plan"
source: skill
---

# use_browser and use_computer

## Overview

Ship two desktop agent capabilities for Chaeboxi:

1. **use_browser** — agent drives a **Chaeboxi-managed isolated browser** via structured tools (a11y snapshot + click/type/navigate).
2. **use_computer** — agent **observes then operates** the OS GUI under explicit consent (screenshot → later mouse/keyboard).

Order is fixed: **browser MVP first**, computer use only after browser is stable. Both are **desktop-only**, **BYOK / model-agnostic function tools**, fail-closed approvals, live kill switch. No hosted cloud browser. No default hijack of the user's daily Chrome profile.

Research: [research/research-use-browser-use-computer-2026-08-11.md](./research/research-use-browser-use-computer-2026-08-11.md)  
Prior architecture draft: [research/architecture-proposal-draft.md](./research/architecture-proposal-draft.md)

## Scope Challenge (locked)

| Item | Decision |
|------|----------|
| Mode | **HOLD** — full product path, no extension-into-daily-browser in v1 |
| Planning mode | **hard** (research done; red-team embedded below) |
| Existing reuse | `stream-text` tool assembly, terminal/file toolset pattern, risk-engine + tool-approval, MCP client (spike only), `desktop_shell` capture primitives for CU observe later |
| Deferred | User Chrome profile attach, provider-native CU-only path, web/mobile parity, OSWorld autonomy |
| Complexity | ~7 phases; new controllers: BrowserController, ComputerController; one shared approval wrapper extract |

## Locked product decisions

| ID | Decision | Choice |
|----|----------|--------|
| D1 | Delivery order | Browser → Computer observe → Computer act |
| D2 | Browser isolation | Fresh profile default; empty cookies |
| D3 | Browser perception | A11y/ref snapshot primary; screenshot secondary |
| D4 | Tool schema | Normal Vercel AI SDK function tools (all tool-capable models) |
| D5 | Platform | Desktop only; web/mobile hard-unavailable |
| D6 | Concurrency | One browser session lock per chat `sessionId` |
| D7 | Computer default | Master setting **off**; session must arm |
| D8 | Approvals | Browser HIGH: once/session/deny OK; **CRITICAL never session-auto** (fix wrap globally) |
| D9 | Spike | Playwright MCP go/no-go **required** before Phase 2 controller code |
| D10 | Rooms | Single-agent + **Work lead only**; Discuss **off**; not all swarm assignees |
| D11 | Chromium | Prefer **system Chrome/Edge via CDP**; download Chromium only if missing |
| D12 | Headful | **Headful default** (user watches); headless optional setting |
| D13 | CU timing | **Separate milestone** after browser M2 GA (Phases 6–7 not same train as M1/M2) |
| D14 | Downloads | Save under **session workspace** downloads; if no workspace → **block + message** |
| D15 | Allowlist | **Off by default** (all http/https subject to approval); optional user allowlist |
| D16 | Approval wrap | Rename `wrapMCPToolsWithApproval` → `wrapToolsWithApproval`; wrap browser tools same as terminal |

## Architecture (target)

```text
UI toggle + live panel + kill
  → session flags (browserArmed / computerArmed)
  → stream-text tool assembly
  → browser | computer toolsets
  → wrapToolsWithApproval (shared; risk tiers)
  → BrowserController | ComputerController (platform/)
       Desktop → ipc_invoke → Rust manager
            → Playwright host → system Chrome/Edge (CDP) or Chromium fallback
            → capture + input backends (computer)
       Web/Mobile → unsupported errors
  → audit log + optional frame tool results
```
<!-- Updated: Validation Session 1 - D11 packaging -->

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Spec Threat Model and Spike](./phase-01-spec-threat-model-and-spike.md) | Completed |
| 2 | [Browser Platform Controller](./phase-02-browser-platform-controller.md) | Completed |
| 3 | [Browser Toolset Integration](./phase-03-browser-toolset-integration.md) | Completed |
| 4 | [Browser UX and Approvals](./phase-04-browser-ux-and-approvals.md) | Completed |
| 5 | [Browser Hardening](./phase-05-browser-hardening.md) | Completed |
| 6 | [Computer Observe](./phase-06-computer-observe.md) | Completed |
| 7 | [Computer Act and Ship Gates](./phase-07-computer-act-and-ship-gates.md) | Completed |

## Milestone ship bars

| Milestone | After phase | Ship meaning |
|-----------|-------------|--------------|
| M1 Browser MVP | 4 | Desktop agent completes public-web tasks with panel + kill + approvals |
| M2 Browser GA | 5 | Downloads/login handoff/audit/room lock hardened |
| M3 Computer observe | 6 | Screenshot tool under OS permission + arm (**post-M2 release**) |
| M4 Computer act | 7 | Click/type with HUD + abort; Linux may be experimental (**post-M3**) |

**Release trains:** Train A = Phases 1–5 (browser). Train B = Phases 6–7 (computer). Do not block Train A ship on CU.

## Dependencies

### In-repo

- Tool path: `src/renderer/packages/model-calls/stream-text.ts`
- Toolsets: `src/renderer/packages/model-calls/toolsets/`
- Risk/approval: `src/renderer/packages/tools/risk-engine.ts`, tool-approval modal/store
- Platform: `src/renderer/platform/interfaces.ts`, DesktopPlatform
- Desktop shell capture: `src-tauri/src/desktop_shell.rs`
- IPC multiplex: `src-tauri/src/lib.rs`
- Patterns to mirror: terminal toolset + `agentCoding` gating; video-url tool productization

### Cross-plan

| Relationship | Plan | Notes |
|--------------|------|-------|
| Soft related | `2026-08-06-menubar-floating-chat-screenshots` | Done — share capture ideas, keep snip-to-chat separate |
| Soft related | `2026-08-10-agent-video-url-reader` | Done — toolset + settings + docs pattern |
| Soft related | `260807-1830-agents-multi-agent-chat` / swarm | Done — room lock rules in Phase 5 |
| Blocks none | — | No unfinished plan hard-blocks this |

### External

- Chromium: system Chrome/Edge CDP preferred; download fallback (D11)
- OS permissions: Screen Recording, Accessibility (Phases 6–7, Train B)

## NOT in scope (v1)

- Web/iOS/Android browser or CU
- Default attach to personal Chrome/Edge profile
- Cloud Operator-style remote browser
- Anthropic/OpenAI-only computer tool beta as sole API
- Autonomous multi-hour OSWorld agent
- Silent background CU without HUD

## Risks (top)

| Risk | Severity | Mitigation |
|------|----------|------------|
| Prompt injection via page/UI | Critical | Isolated profile; approvals; allowlist; never auto-pay |
| Sidecar size / install friction | High | Spike decides; lazy download option |
| Scope explosion CU+browser+extension | High | Phase gates; M1 ship without CU |
| Hung tool loops | High | Action timeouts, maxSteps, Stop |
| Multi-monitor / DPI for CU | High | Display picker; per-OS tests |
| Multi-agent browser races | Medium | Session mutex; lead-only |

## Red Team Review (pre-cook adversarial pass)

Embedded hard-mode review (security + failure + scope). Findings accepted into phases:

| ID | Severity | Finding | Disposition | Applied where |
|----|----------|---------|-------------|---------------|
| RT1 | Critical | Prompt injection can drive navigate/click/pay if session auto-approve allowed | Accept | D8; Phases 3–4 force HIGH for act; no CRITICAL auto-approve |
| RT2 | Critical | Shared user browser profile = session theft | Accept | D2; Phase 5 advanced profile attach remains out |
| RT3 | High | `wrapMCPToolsWithApproval` name/scope may skip built-in browser tools | Accept | Phase 3 extract `wrapToolsWithApproval` for all tools |
| RT4 | High | Screenshot-to-chat ≠ full-display CU capture; reuse without redesign fails multi-monitor | Accept | Phase 6 separate capture path + display id |
| RT5 | High | Room/swarm concurrent agents double-drive browser | Accept | D10; Phase 5 lock |
| RT6 | Medium | Unlimited snapshot tokens blow context | Accept | Phase 3/5 snapshot size caps + truncate |
| RT7 | Medium | Linux CU quality trap delaying M1 | Accept | Phase 7 Linux experimental; M1 desktop browser only |
| RT8 | Medium | Playwright MCP forever = weak product UX | Accept | Phase 1 go/no-go; Phase 2 first-party required for M1 |
| RT9 | Low | Provider-native CU later must not fork controllers | Accept | D4; Phase 7 note adapters call same controller |

### Whole-Plan Consistency Sweep

- Order Browser→CU consistent across overview, phases, milestones.
- No phase claims user-profile default.
- No phase requires Anthropic-only tools.
- Spike is not M1 ship path.
- CU act never before observe phase.
- Unresolved contradictions: **none** in plan text; product open questions listed below.

## Open questions (product owner)

None remaining after Validation Session 1. Residual eng choices (exact CDP attach flags, HUD toolkit) deferred to implementers within locked decisions.

## Validation Log

### Session 1 — 2026-08-11
**Trigger:** `/ck:plan validate` after full plan create  
**Questions asked:** 8 answered + 3 timed-out → recommended defaults applied

#### Verification Results
- Tier: Full (7 phases; sampled key claims)
- Claims checked: 12
- Verified: 11 | Failed: 0 | Unverified: 1 (soft)
- Notes:
  - VERIFIED: `stream-text.ts:235` `wrapMCPToolsWithApproval`; already wraps terminal/file/video at ~822–862 — browser must call same wrap (rename D16)
  - VERIFIED: `ToolRiskTier` includes CRITICAL (`src/shared/types/mcp.ts:8-12`)
  - VERIFIED: auto-approve excludes HIGH only (`stream-text.ts:253-257`) — CRITICAL can currently session-auto → must fix (D8)
  - VERIFIED: `shell:captureScreenshot` desktop path; `Platform` in `interfaces.ts`; `agentCoding` in generation.ts; risk-engine; tool-approval modal
  - UNVERIFIED soft: exact sidecar layout path (to be created)

#### Questions & Answers
1. **[Architecture]** Chromium packaging — **Answer:** system Chrome/Edge CDP; download Chromium if missing (D11)
2. **[Assumptions]** Headful default — **Answer:** headful default (D12)
3. **[Scope]** CU timing — **Answer:** separate milestone after M2 (D13)
4. **[Scope]** Rooms — **Answer:** single-agent + Work lead; Discuss off (D10)
5. **[Tradeoffs]** Browser HIGH approval — **Answer:** once/session/deny OK for HIGH (D8)
6. **[Risks]** Downloads — **Answer:** workspace downloads folder (D14); no-workspace → block (default)
7. **[Risks]** CRITICAL auto-approve — **Answer:** fix globally never session-auto CRITICAL (D8)
8. **[Scope]** Spike gate — **Answer:** required go/no-go before Phase 2 (D9)
9–11. Timed out → defaults: no-workspace block downloads; allowlist off; rename wrap function

#### Confirmed Decisions
- D8–D16 locked as table above
- Train A (browser) / Train B (CU) split

#### Action Items
- [x] Propagate D11–D16 into phases 1–3, 5, 7
- [x] Document CRITICAL wrap fix in Phase 3 and 7
- [x] Download policy: workspace required else block

#### Impact on Phases
- Phase 1: spike required gate; product lock sheet already decided
- Phase 2: Chrome/Edge channel preference + Chromium fallback
- Phase 3: rename wrap; CRITICAL auto-approve fix early (shared)
- Phase 5: workspace downloads; allowlist optional off
- Phase 6–7: explicit post-M2; no parallel with Train A ship

### Whole-Plan Consistency Sweep
- Locked table D1–D16 consistent with architecture block and milestones
- Open questions cleared
- Phase 5 download text must not say “block all” only — workspace sandbox
- No unresolved contradictions

## Validation / cook gates

Before `/ck:cook`:

- [x] Product open questions resolved (Session 1)
- [x] Phase 1 spike go/no-go recorded in `reports/`
- [x] M1 acceptance scenarios listed in Phase 4 success criteria

Suggested cook: `/ck:cook /Users/huynguyen/Personal/chaeboxi/plans/260811-1011-use-browser-use-computer/plan.md`

## Effort (rough)

| Phase | Effort |
|-------|--------|
| 1 | 2–4 days |
| 2 | 4–7 days |
| 3 | 3–5 days |
| 4 | 3–5 days |
| 5 | 3–5 days |
| 6 | 3–5 days |
| 7 | 5–10 days |
| **Total** | **~4–6 weeks** calendar with one engineer; CU act optional stretch |
