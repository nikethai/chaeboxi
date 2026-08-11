---
phase: 2
title: "Browser Platform Controller"
status: completed
priority: P1
dependencies: [1]
effort: "4-7 days"
---

# Phase 2: Browser Platform Controller

## Overview

Add a **desktop BrowserController**: lifecycle (start/stop/health), isolated user-data dir, and IPC actions (navigate, snapshot, click, type, scroll, tabs, screenshot). No chat tool wiring yet — prove the backend alone.

## Requirements

### Functional
- Create/destroy browser session bound to `sessionId`
- Isolated profile directory under app data (`browser-profiles/{sessionId}/`)
- Actions: navigate, a11y snapshot (with refs), click(ref), type(ref|text), scroll, list/select/close tabs, page screenshot
- Headful/headless flag
- Abort in-flight action; kill browser process on session end / app quit

### Non-functional
- Action timeout default ≤30s
- Snapshot payload cap (e.g. 100–200KB text) with truncate marker
- Desktop only; web platform methods throw/return unsupported
- No secrets in logs

## Architecture

```text
Renderer Platform.browser.*
  → desktopAPI / ipc_invoke("browser:*")
  → Rust browser_manager
       → spawns Node Playwright sidecar OR embeds automation host
       → JSON-RPC over stdio/socket
       → Chromium instance per session (or pooled with hard reset)
```

**Recommended packaging (D11):**

| Option | When |
|--------|------|
| A. Playwright driving **system Chrome/Edge** via channel/CDP | **Default** when browser installed |
| B. Download Playwright Chromium | Fallback if A unavailable |
| C. Pure Rust CDP | Only if A/B fail product needs |

Headful default true (D12). User-data-dir always isolated — never the user's daily profile path.
<!-- Updated: Validation Session 1 - D11 D12 -->

### IPC channel sketch

```text
browser:session:start { sessionId, headless?, viewport? }
browser:session:stop  { sessionId }
browser:session:status { sessionId }
browser:navigate { sessionId, url }
browser:snapshot { sessionId, interestingOnly? }
browser:act { sessionId, action, ref?, text?, x?, y?, ... }
browser:tabs { sessionId, op, tabId? }
browser:screenshot { sessionId } -> bytes|path
```

### Ref model

Snapshot returns stable **element refs** (e.g. `e12`) mapping to backend handles for the next act. Invalidate refs after navigation.

## Related Code Files

- Create: `src-tauri/src/browser_manager.rs` (or module split)
- Modify: `src-tauri/src/lib.rs` — route `browser:*` channels
- Create: `src/shared/desktop-ipc-types.ts` entries for browser channels (if typed there)
- Modify: `src/renderer/platform/interfaces.ts` — `BrowserController` interface
- Modify: `src/renderer/platform/desktop_platform.ts` (or equivalent) — impl
- Modify: `src/renderer/platform/web_platform.ts` / test — unsupported stubs
- Create: sidecar dir e.g. `src-tauri/sidecars/browser-host/` or `packages/browser-host/`
- Tests: Rust unit where possible; integration test start→navigate→snapshot→stop

## Implementation Steps

1. Define `BrowserController` TS interface + error codes (`UNSUPPORTED_PLATFORM`, `SESSION_NOT_FOUND`, `ACTION_TIMEOUT`, `REF_INVALID`, `SECURITY_BLOCKED`).
2. Implement web/test stubs.
3. Scaffold sidecar: minimal Playwright script with JSON-RPC.
4. Rust manager: spawn, health check, request/response, kill on drop.
5. Implement session start with unique userDataDir; never reuse across sessions without wipe.
6. Implement navigate + snapshot + click/type/scroll + tabs + screenshot.
7. Wire IPC in `lib.rs` next to existing channel groups.
8. Manual CLI/integration: start session, open example.com, snapshot, stop.
9. App quit hook: tear down all browser sessions.

## Todo List

- [x] Interface + stubs
- [x] Sidecar MVP
- [x] Rust manager + IPC
- [x] Session isolation verified on disk
- [x] Integration smoke test

## Success Criteria

- [x] Desktop can start isolated browser, navigate, return a11y snapshot with refs, click a ref, stop cleanly
- [x] Web build compiles; browser APIs return unsupported
- [x] Killing Chaeboxi leaves no orphan Chromium (best-effort verified)
- [x] No toolset/UI yet (Phase 3–4)

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Sidecar binary packaging hell | Dev path uses local node; package strategy explicit in report |
| Zombie Chromium | process group kill; quit hook; status poll |
| CDP flakiness | Action retries limited; clear errors to agent |

## Security Considerations

- Profile dir permissions user-only
- Block `file://` navigate in v1 (or allowlist workspace later in Phase 5)
- No exposing full cookie jar to renderer/model
- Validate URLs scheme http/https only in manager

## Next Steps

Phase 3 binds tools → controller.
