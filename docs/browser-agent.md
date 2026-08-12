# Browser Agent (use_browser)

Desktop-only agent tools that drive a **Chaeboxi-managed isolated browser** (not your personal Chrome/Edge profile).

## User guide

1. Open **Settings → Browser Agent** and enable the master switch.
2. In a chat, open composer **Tools (+)** → **Chaeboxi Browser** and arm it.
3. Ask the model to perform multi-step web tasks (forms, docs navigation).
4. Approve HIGH-risk actions (click/type/navigate) when prompted.
5. Use the live panel **Stop** or chat Stop to abort generation and kill the browser session.

### Safety defaults

| Setting | Default |
|---------|---------|
| Master enabled | Off |
| Headful window | On (you can watch) |
| Profile | Fresh under app data `browser-profiles/{sessionId}/` |
| Downloads | `{workspace}/.chaeboxi-browser-downloads/` only; blocked without workspace |
| Domain allowlist | Off (empty) |
| Max steps/turn | 12 (wired into generation when chat arms Browser) |
| Discuss rooms | Tools off |
| Work/swarm | Lead only |

## Tools

| Tool | Risk | Purpose |
|------|------|---------|
| `browser_navigate` | HIGH | Open http(s) URL + auto snapshot |
| `browser_snapshot` | LOW | A11y/ref tree (primary perception) |
| `browser_click` | HIGH | Click by ref + auto snapshot |
| `browser_type` | HIGH | Type into ref/focus + auto snapshot |
| `browser_scroll` | HIGH | Scroll + auto snapshot |
| `browser_tabs` | MEDIUM | list/select/new/close |
| `browser_screenshot` | MEDIUM | Page image (secondary) |

Prefer `web_search` / `parse_link` for simple Q&A. Mutations return a **fresh snapshot** with new refs (old refs invalidate). On stale ref the host returns `REF_INVALID` plus a new snapshot. Pause on auth/payment walls.

Refs are bound in a **single DOM pass** (`data-chaeboxi-ref` marks) so displayed refs match live handles. The per-turn browser run lock releases when generation finishes (process stays warm until Stop).

When **Computer Use** is also armed, browser tools are **stripped** for that turn (exclusive desktop lease). Arm Browser alone for pure web tasks.

Dead host recovery: if session status/RPC fails, Chaeboxi stops and relaunches the Playwright host once before failing the tool.

## Architecture

```
UI arm + settings
  → generation passes browserAgent options
  → createBrowserToolSet → wrapToolsWithApproval
  → Platform.browser* → ipc browser:*
  → Rust BrowserManager → Node Playwright host (stdio JSON-RPC)
  → system Chrome/Edge channel or Chromium fallback
```

### Dev setup for host

```bash
cd src-tauri/sidecars/browser-host
npm install
# Playwright will download browsers as needed; channel chrome/msedge preferred
```

## Room policy (D10)

- Single-agent: OK when armed
- Discuss: never registers browser tools
- Work / swarm: lead only; non-lead gets busy/denied at generation gate

## Related

- Computer use: [computer-use.md](./computer-use.md)
- Plan: `plans/260811-1011-use-browser-use-computer/`
