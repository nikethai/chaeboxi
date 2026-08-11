# Phase 4 — M1 Browser MVP acceptance

Date: 2026-08-11

## Scenarios

| # | Scenario | Expected | Status |
|---|----------|----------|--------|
| 1 | Arm → public docs → snapshot answer | Correct H1 via snapshot | Implemented (manual desktop verify) |
| 2 | Multi-step public form | ≥1 HIGH approval | Implemented path |
| 3 | Deny click | No side effect; denied result | wrapToolsWithApproval deny path |
| 4 | Stop mid-run | Generation + browser stop | generation-cancel + stopBrowserSession |
| 5 | Web build | Controls disabled / desktop-only | settings + platform gates |

## Notes

- Full interactive M1 run requires desktop build + `src-tauri/sidecars/browser-host` npm install.
- Unit tests cover URL policy, lock, tool registration, risk tiers.
