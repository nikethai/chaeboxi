---
phase: 3
title: "Browser Toolset Integration"
status: completed
priority: P1
dependencies: [2]
effort: "3-5 days"
---

# Phase 3: Browser Toolset Integration

## Overview

Expose browser actions as a first-party **toolset** assembled in `stream-text` like terminal/file tools. Extract shared approval wrapping so browser tools never bypass risk gates. Model-agnostic schemas only.

## Requirements

### Functional
- Tools: `browser_navigate`, `browser_snapshot`, `browser_click`, `browser_type`, `browser_scroll`, `browser_tabs`, `browser_screenshot` (names finalizable but stable prefix `browser_`)
- Gate: `platform.type === 'desktop'` + session/settings browser armed + `model.isSupportToolUse()`
- System prompt instructions describing when/how to use browser vs `web_search`
- maxSteps / per-action timeout compatible with generation loop
- Denied tools return structured `{ denied: true, ... }` like existing pattern

### Non-functional
- Snapshot tool results truncated for context
- Risk tiers: snapshot/tabs LOW–MEDIUM; navigate MEDIUM–HIGH; click/type/scroll HIGH
- Unit tests for gating and tool registration (mirror `agent-coding-tools.test.ts`)

## Architecture

```text
streamText({ browserAgent })
  → createBrowserToolSet(sessionId)
  → wrapToolsWithApproval(sessionId, tools)  // SHARED
  → model tool loop
  → BrowserController
```

### Extract approval wrapper (D16 + D8)

Today: `wrapMCPToolsWithApproval` in `stream-text.ts` (~line 235) already wraps MCP **and** terminal/file/video (~822+). Name is misleading.

**Must:**
1. Rename → `wrapToolsWithApproval` (update call sites + tests)
2. Apply to browser toolset the same way as terminal
3. Fix auto-approve: exclude **HIGH and CRITICAL** from session auto-approve  
   Current code (`stream-text.ts:253-257`) only excludes HIGH — CRITICAL can session-auto (bug for CU and any CRITICAL tool)

```ts
const canAutoApprove =
  riskTier === ToolRiskTier.LOW ||
  (existingApproval?.scope === 'session' &&
    existingApproval.riskTier === riskTier &&
    riskTier !== ToolRiskTier.HIGH &&
    riskTier !== ToolRiskTier.CRITICAL)
```

Browser HIGH: once/session/deny remains OK (D8).
<!-- Updated: Validation Session 1 - D8 D16 CRITICAL fix -->

### Settings / session flags (minimal for tools; UI in Phase 4)

```ts
// settings.extension.browserAgent
{ enabled: boolean; maxStepsPerTurn?: number; headless?: boolean }

// session or generation options
browserAgent?: { armed: boolean; sessionId: string }
```

Pass `browserAgent` into `streamText` analogous to `agentCoding`.

### Tool schemas (sketch)

```ts
browser_navigate: { url: string }
browser_snapshot: { /* optional interestingOnly */ }
browser_click: { ref: string; button?: 'left'|'right' }
browser_type: { ref?: string; text: string; submit?: boolean }
browser_scroll: { direction: 'up'|'down'; amount?: number; ref?: string }
browser_tabs: { action: 'list'|'select'|'new'|'close'; tabId?: string; url?: string }
browser_screenshot: { /* none */ }
```

### Instructions priority

Document in toolset description:

1. Prefer `web_search` / `parse_link` for simple Q&A
2. Use browser for multi-step interactive web
3. Snapshot before click
4. Stop and ask user on auth/payment walls

## Related Code Files

- Create: `src/renderer/packages/model-calls/toolsets/browser.ts`
- Create: `src/renderer/packages/model-calls/toolsets/browser.test.ts`
- Modify: `src/renderer/packages/model-calls/stream-text.ts` — assemble + wrap
- Modify: `src/renderer/packages/model-calls/stream-text.test.ts` / `agent-coding-tools.test.ts` patterns
- Modify: `src/renderer/packages/tools/risk-engine.ts` — browser intent patterns
- Modify: `src/shared/types/settings.ts` — extension.browserAgent schema + defaults
- Modify: `src/shared/defaults.ts` — defaults
- Modify: generation path (`stores/session/generation.ts`) — pass browserAgent options when armed
- Possibly: `ToolUseScopeSchema` if scopes extended

## Implementation Steps

1. Add settings schema + defaults (`enabled: false` master until Phase 4 UX).
2. Implement `createBrowserToolSet(sessionId, opts)` calling platform controller.
3. Extract `wrapToolsWithApproval`; ensure browser tools included whenever assembled.
4. Wire `needBrowserTools` gate in `streamText` (desktop + enabled + armed + tool_use).
5. Append toolset description to system instructions; conflict note vs Gemini grounding (function tools disable grounding — already handled).
6. Risk-engine patterns for `browser_`, navigate, click.
7. Unit tests: not registered on web; registered when armed; deny path mocked.
8. Manual: force-arm in dev, run one navigate+snapshot loop.

## Todo List

- [x] browser toolset module
- [x] shared approval wrap
- [x] stream-text + generation wiring
- [x] risk-engine updates
- [x] unit tests green

## Success Criteria

- [x] Armed desktop session exposes browser_* tools to model
- [x] Unarmed / web / no-tool-use → tools absent
- [x] Approval modal fires on HIGH browser_click (unless future policy says otherwise)
- [x] `pnpm test` covers new unit tests; `pnpm check` clean for touched TS

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Tool name collisions with MCP | Prefix `browser_`; document denylist |
| Context bloat from snapshots | Cap + instruct model to snapshot sparingly |
| Double-wrap approval | Single wrap at assembly boundary |

## Security Considerations

- RT3: never register browser tools outside approval wrap
- Validate tool args (URL scheme) again at tool layer even if controller checks
- Audit log entries for allow/deny with args (truncate large snapshots in audit)

## Next Steps

Phase 4 adds user-visible arming, panel, kill switch.
