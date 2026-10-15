# Phase 1 — Playwright MCP Spike Findings + Go/No-Go

Date: 2026-08-11  
Plan: `260811-1011-use-browser-use-computer`  
Gate: **D9 hard stop before Phase 2 controller code**

## Spike setup (documented MCP config)

Optional power-user path (not product default):

```json
{
  "id": "playwright",
  "name": "Playwright Browser",
  "enabled": true,
  "transport": {
    "type": "stdio",
    "command": "npx",
    "args": ["-y", "@playwright/mcp@latest"]
  }
}
```

Prereqs: Node 20+, desktop Chaeboxi, network for public sites. No banking/prod accounts.

## Expected MCP tool loop

1. `browser_navigate` / navigate → public docs URL  
2. Snapshot / a11y tree → extract heading  
3. Click/type on public fixture form  
4. User deny mid-action via Chaeboxi tool approval

## Findings (architecture evaluation)

| Area | Observation | Impact on product |
|------|-------------|-------------------|
| Agent loop | Playwright MCP can complete public-web multi-step tasks when MCP is configured | Proves browser tool loop is viable |
| Approval UX | MCP tools go through existing wrap; naming `wrapMCPToolsWithApproval` is misleading; CRITICAL auto-approve bug remains | Must extract shared wrap + fix CRITICAL (Phase 3) |
| Product control | No first-party session lock, live panel, kill-tied-to-generation, isolated profile under app data, download sandbox, room policy | MCP-only is insufficient for M1 UX/security |
| Packaging | `npx` MCP is contributor-friction; not a ship path for default users | First-party host preferred |
| Snapshot size | MCP snapshots can be large; no product-level cap | Cap in first-party controller |
| Profile isolation | MCP profile path not under Chaeboxi app data by default | Own user-data-dir required |
| Kill switch | Stopping generation does not reliably kill MCP browser process | First-party lifecycle required |

## M1 acceptance scenarios (product scripts)

1. **Navigate + extract** — Arm browser → open public docs → snapshot → answer with correct H1.  
2. **Multi-step form** — Public fixture form fill with ≥1 HIGH approval on click/type.  
3. **Deny mid-click** — User denies `browser_click` → no side effect; panel shows denied.  
4. **Stop mid-run** — Stop cancels generation + browser session; no further acts.  
5. **Web build** — Browser controls hidden/disabled with reason.

## Go / No-Go decision

### **GO first-party controller (Phase 2+)**

Rationale:

1. Spike-class MCP proves the agent can drive a browser tool loop (capability exists).  
2. Product requirements (isolated profile, panel, kill, room lock, download sandbox, honest branding) are not met by MCP-as-default.  
3. Plan D9/RT8: MCP forever = weak product UX; M1 requires first-party.  
4. Hybrid allowed later: MCP remains optional power feature; **default path is first-party**.

### Hold condition (not met)

Hold only if Playwright cannot run on target desktop OS at all. Not observed for macOS/Windows primary targets.

## Evidence notes

- No production feature flag shipped in Phase 1 (spike docs only).  
- No cookies/storage state/secrets committed.  
- Redacted: no live credentials or tokenized URLs.

## Hard gate checklist

- [x] Product lock defaults written (threat-model report)  
- [x] Threat model report  
- [x] M1 scenarios listed  
- [x] Spike evaluation recorded (MCP path documented; first-party required)  
- [x] Go/no-go: **GO first-party**
