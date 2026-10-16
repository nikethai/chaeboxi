---
phase: 4
title: "Browser UX and Approvals"
status: completed
priority: P1
dependencies: [3]
effort: "3-5 days"
---

# Phase 4: Browser UX and Approvals

## Overview

Make browser agent **user-controllable and observable**: settings, session arm toggle, live status panel (URL, last action, running state), Stop/kill, and polished approval copy. This phase ends **M1 Browser MVP**.

## Requirements

### Functional
- Settings: enable browser agent master, **headful default true** (D12), optional max steps + headless toggle
- Composer/session control: Arm / Disarm browser for this chat
- Live panel while armed or while tools running: current URL, tab count, last tool, errors
- **Stop** button: abort generation + `browser:session` cancel/stop
- First-run explainer: isolated profile, not your personal browser
- Approval modal shows human-readable browser action (URL, ref summary); HIGH once/session/deny (D8)
- Disabled state on web/mobile with reason
<!-- Updated: Validation Session 1 - D8 D12 -->

### Non-functional
- Panel must not block chat scroll entirely (dock/side/collapsible)
- Stop within ~1s best-effort
- i18n English default strings; follow existing i18n patterns
- Match design guidelines (Mantine/Tailwind existing chat chrome)

## Architecture

```text
Settings.extension.browserAgent.enabled
Session UI: browserArmed
  → generation passes browserAgent opts
LiveBrowserPanel subscribes to:
  - tool call stream events (existing message parts)
  - optional browser:session:status push events
Stop → AbortController + platform.browser.stop(sessionId)
```

### UX copy principles

- Honest: "Chaeboxi Browser (isolated)" not "your Chrome"
- Risk: approvals explain click/type can submit forms
- Kill always visible while running

### M1 acceptance scenarios (product)

1. Arm → ask agent to open a public docs page → snapshot answer correct
2. Multi-step public form fixture → success with ≥1 approval
3. Deny a click → model continues without side effect; panel shows denied
4. Stop mid-run → browser idle/stopped; no further acts
5. Web build: control hidden or disabled with tooltip

## Related Code Files

- Modify: settings route under `src/renderer/routes/settings/` (extensions or agent tools section)
- Create: `src/renderer/components/.../BrowserAgentPanel.tsx` (path per existing layout)
- Modify: composer / session header controls (find pattern near web browsing toggle)
- Modify: `src/renderer/stores/session/generation.ts` — arm flags, abort hooks
- Modify: tool-approval modal strings if needed
- Modify: i18n locale en files
- Read: web browsing mode toggle UX for consistency (`inputBoxWebBrowsingMode`)

## Implementation Steps

1. Settings UI bound to schema from Phase 3.
2. Session arm toggle (persist on session settings if pattern exists; else ephemeral atom + session field).
3. Build live panel driven by in-flight tool parts + status IPC.
4. Wire Stop to cancel generation and browser session.
5. First-run / empty state when enabled but never armed.
6. Approval parameter pretty-print for browser tools.
7. Manual M1 scenario checklist; capture notes in `reports/phase-04-m1-acceptance.md`.
8. Polish: loading, error toasts, headful window focus optional button "Show browser".

## Todo List

- [x] Settings UI
- [x] Arm/disarm control
- [x] Live panel + Stop
- [x] Approval copy
- [x] M1 acceptance report

## Success Criteria

- [x] M1 scenarios 1–5 pass on macOS or Windows desktop dev build
- [x] User can fully stop agent browser without killing whole app
- [x] No personal profile cookies used
- [x] Lint/check/tests for touched files pass

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Panel noise | Collapse when idle |
| Users think it's their Chrome | Explicit labeling + first-run |
| Stop races | Idempotent stop; ignore late tool results |

## Security Considerations

- Do not render full HTML page content in panel (XSS); show URL + plain snapshot excerpts only if needed
- Approvals required for HIGH acts; do not add "always allow all browser" global

## Next Steps

Phase 5 hardens for GA (downloads, login, rooms, audit).
