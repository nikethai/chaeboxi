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
| Discuss rooms | Tools off |
| Work/swarm | Lead only |

## Tools

| Tool | Risk | Purpose |
|------|------|---------|
| `browser_navigate` | HIGH | Open http(s) URL |
| `browser_snapshot` | LOW | A11y/ref tree (primary perception) |
| `browser_click` | HIGH | Click by ref |
| `browser_type` | HIGH | Type into ref/focus |
| `browser_scroll` | HIGH | Scroll |
| `browser_tabs` | MEDIUM | list/select/new/close |
| `browser_screenshot` | MEDIUM | Page image (secondary) |

Prefer `web_search` / `parse_link` for simple Q&A. Snapshot before click. Pause on auth/payment walls.

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
