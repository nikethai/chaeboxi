# Phase 1 — Threat Model (browser + computer use)

Date: 2026-08-11  
Plan: `260811-1011-use-browser-use-computer`  
Scope: STRIDE-lite for Train A (browser) and Train B (computer use)

## Product lock sheet (D1–D16)

| ID | Decision | Choice |
|----|----------|--------|
| D1 | Delivery order | Browser → CU observe → CU act |
| D2 | Browser isolation | Fresh profile; empty cookies |
| D3 | Perception | A11y/ref snapshot primary; screenshot secondary |
| D4 | Tool schema | Vercel AI SDK function tools (model-agnostic) |
| D5 | Platform | Desktop only |
| D6 | Concurrency | One browser session lock per chat `sessionId` |
| D7 | Computer default | Master **off**; session must arm |
| D8 | Approvals | HIGH: once/session/deny OK; **CRITICAL never session-auto** |
| D9 | Spike | Playwright MCP go/no-go required before Phase 2 |
| D10 | Rooms | Single-agent + Work lead only; Discuss **off** |
| D11 | Chromium | System Chrome/Edge CDP preferred; download fallback |
| D12 | Headful | Headful default |
| D13 | CU timing | Separate train after browser M2 |
| D14 | Downloads | Workspace downloads only; no workspace → block |
| D15 | Allowlist | Off by default |
| D16 | Approval wrap | `wrapToolsWithApproval` for all tools including browser |

## Top 10 threats → mitigations → phases

| # | Threat | STRIDE | Severity | Mitigation | Phase |
|---|--------|--------|----------|------------|-------|
| 1 | Prompt injection via page content drives navigate/click/pay | Tampering / Elevation | Critical | Isolated profile; HIGH/CRITICAL approvals; never auto CRITICAL; no auto-pay | 3–5 |
| 2 | Session theft via shared user Chrome profile | Info disclosure | Critical | Always isolated user-data-dir; no daily profile attach in v1 | 2, 5 |
| 3 | Built-in tools bypass approval wrap | Elevation | High | Rename + apply `wrapToolsWithApproval` to all assembled tools | 3 |
| 4 | CRITICAL tools session-auto-approved | Elevation | High | Exclude CRITICAL from auto-approve | 3, 7 |
| 5 | Multi-agent double-drive of one browser | Tampering | High | Session mutex; Discuss off; Work lead only | 5 |
| 6 | Download exfil / write outside sandbox | Info disclosure | High | Workspace downloads only; block if no workspace | 5 |
| 7 | Snapshot token bomb / context blow | Denial of service | Medium | Snapshot size caps + truncate markers | 2–5 |
| 8 | Screen capture leaks secrets to model | Info disclosure | High | Opt-in master + arm + approval; vision-only | 6 |
| 9 | Accidental destructive OS clicks | Tampering | Critical | CRITICAL approval every act; HUD + abort hotkey | 7 |
| 10 | Orphan Chromium / hung tool loops | Denial of service | Medium | Timeouts, kill on quit, Stop → session stop | 2, 4 |

## Residual risks (accepted for v1)

- On-screen text can still inject into vision models (same class as DOM injection).
- Linux computer-act quality may remain experimental.
- No enterprise domain policy beyond optional allowlist.
- Abort is best-effort within ~1s; late tool results ignored.

## Room policy (D10)

| Mode | Browser tools | Computer tools |
|------|---------------|----------------|
| Single-agent | Allowed when armed + master enabled | Allowed when armed + master enabled |
| Discuss | **Off** | **Off** |
| Work | Lead only | Lead only |
| Swarm non-lead | **Off** | **Off** |

## Defaults

- `extension.browserAgent.enabled = false` until user opts in
- `extension.browserAgent.headless = false` (D12)
- `extension.computerUse.enabled = false` (D7)
- Allowlist empty = no extra filter beyond http(s)
