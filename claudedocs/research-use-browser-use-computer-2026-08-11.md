# Research Report: Use Browser & Use Computer for Chaeboxi

**Date:** 2026-08-11 (UTC)  
**Scope:** How peer products implement browser agents and desktop computer-use; what Chaeboxi already has; recommended architecture for first-party `use_browser` / `use_computer`.

## Executive Summary

Industry split is clear:

1. **Browser agents** mostly win with **structured observation** (accessibility/DOM snapshots + discrete actions) via Playwright/CDP — not pure pixels.
2. **Computer use** is **screenshot → reason → mouse/keyboard**, optionally Accessibility APIs. High demo value, weak long-horizon reliability, highest security surface.
3. Vendors isolate environments when possible (cloud browser / VM). Products that drive the **user’s real browser/desktop** (Claude in Chrome, ChatGPT desktop Computer Use) trade convenience for severe prompt-injection and account-takeover risk.

Chaeboxi today has **web_search + parse_link**, workspace **file/terminal**, **tool approval + risk engine**, and **region screenshot-to-chat** — but **no agent browser loop and no GUI control loop**.

For a **local-first BYOK Tauri app**, the correct order is:

1. **use_browser first** — isolated Chromium profile, structured tools, desktop-only.
2. **use_computer second** — opt-in, permission-gated, approval-heavy, prefer observe-before-act.
3. Never ship “drive my daily logged-in Chrome + full desktop control” as default.

## Research Methodology

- Sources: official OpenAI/Anthropic docs, industry surveys 2025–2026, browser-use / Playwright MCP ecosystem, Chaeboxi `docs/` + tool assembly code.
- Key terms: computer use, CUA, Operator, Playwright MCP, browser-use, Claude in Chrome, accessibility tree, OSWorld.
- Chaeboxi codebase scout: `stream-text.ts`, toolsets, `risk-engine`, `desktop_shell`, platform/MCP architecture.

## Key Findings

### 1. Technology overview

| Pattern | Perception | Action | Typical host |
| --- | --- | --- | --- |
| **Structured browser** | A11y tree / simplified DOM / ARIA refs | click(ref), type(ref), navigate, scroll | Playwright, browser-use, Playwright MCP |
| **Pixel browser (CUA)** | Screenshots | click(x,y), type, key, scroll | OpenAI CUA / Operator lineage |
| **User browser extension** | DOM + CDP via debugger | Same as human in existing session | Claude in Chrome |
| **Desktop computer use** | Screen capture (+ optional AX tree) | Global mouse/keyboard | Anthropic computer tool, ChatGPT desktop CU |

Loop is always: **observe → plan → act → re-observe**, with user stop/approve gates.

### 2. Current state & trends (2025–2026)

- OpenAI: Operator → ChatGPT **agent mode** / desktop **Computer Use** (macOS/Windows; Screen Recording + Accessibility; background cursor on macOS). Also **built-in browser** for web work separate from full OS control.
- Anthropic: **computer_*** tools (screenshot, click, type, key, scroll, drag). Reference implementations often sandboxed. **Claude in Chrome** uses real sessions via extension + often native messaging; high risk (prompt injection, extension attack surface e.g. ClaudeBleed-class issues).
- Open source: **browser-use** (Python, Playwright/CDP), **Playwright MCP** (a11y snapshots, token-efficient, host policies).
- Reality check: GUI agents improve on synthetic benchmarks but **long-horizon real workflows still fail often**. Prefer APIs/MCP/CLI when available; GUI is last resort.

### 3. Best practices

- **Prefer structured refs over coordinates** for browsers.
- **Isolated browser context** default; user-profile attach is explicit advanced mode.
- **Domain allowlists**, download blocks, no OS file picker hijacks in v1.
- **Human-in-the-loop** for auth, payments, email send, irreversible actions.
- **Model-agnostic function tools** for BYOK (do not lock to Anthropic beta tool types only).
- **Live UI**: show what agent sees + action log; kill switch.
- **Cap steps / timeouts / cost** (screenshots burn tokens).
- **Security classifiers** help but do not eliminate injection from page/screen content.

### 4. Security considerations

| Threat | Browser | Desktop CU |
| --- | --- | --- |
| Prompt injection via page/UI text | High | Critical |
| Credential / session theft | High if shared profile | Critical (screen can show secrets) |
| Unintended purchase / message | High | Critical |
| Lateral movement (files, other apps) | Medium if downloads/FS bridge | Critical |
| Extension/CDP malware path | High (debugger perms) | N/A |

Mitigations that matter for Chaeboxi:

- Default **isolated profile**, empty cookies.
- **Fail-closed approvals** (reuse `tool-approval` + raise tiers for act tools).
- **No secret injection** into model prompts (same rule as integrations).
- **Audit log** of actions (domain, URL, coords, timestamps).
- Desktop CU: require OS permissions explicitly; show persistent “agent controlling” indicator; pause on focus-sensitive apps optional later.
- Do not grant Accessibility + Screen Recording silently.

### 5. Performance insights

- A11y snapshot << full HTML << full-res screenshot for tokens.
- Pixel grounding is slow and brittle (DPI, multi-monitor, animations).
- Parallel tools + long loops need **maxSteps**, abort, and UI status (Chaeboxi already has tool execute timeouts ~90s and approval timeout ~120s — browser steps need their own shorter action timeouts + higher step budget).

## Comparative Analysis

| Approach | Fit for Chaeboxi | Pros | Cons |
| --- | --- | --- | --- |
| **A. First-party Playwright sidecar + toolset** | **Best default** | Local-first, BYOK multi-model, full approval UX, desktop IPC | Bundle size, process mgmt, maintenance |
| **B. Ship as optional MCP (Playwright MCP)** | Good spike / power users | Fast validation, zero core code | Weak product UX, approval granularity harder, install friction |
| **C. Embed browser-use Python** | Poor core path | Mature agent loop | Python runtime, second language, product glue hell |
| **D. Claude/OpenAI provider-native CU only** | Partial | Better model performance when available | Breaks BYOK story; not all models |
| **E. Chrome extension into user browser** | Phase 3+ only | Real logins | Highest risk; store review; support load |
| **F. Full desktop CU day one** | No | Demo wow | Permissions, reliability, liability |

## Chaeboxi baseline (code)

**Exists**

- Tool assembly: `src/renderer/packages/model-calls/stream-text.ts` (web, file, terminal, MCP, memory, tasks, video…).
- Toolsets under `src/renderer/packages/model-calls/toolsets/`.
- Risk + approval: `risk-engine.ts`, `wrapMCPToolsWithApproval`, NiceModal `tool-approval`.
- Desktop coding: `agentCoding` + workspace-scoped terminal/file.
- Shell screenshots: `desktop_shell.rs` (`shell:captureScreenshot`) — **human capture to chat**, not agent loop.
- MCP client already in Tauri — external browser MCP is a valid **spike**, not the product end state.
- Platforms: desktop richest; web/mobile reduced (PDR non-goal of full parity).

**Missing**

- Browser session manager, page snapshot tools, action executor.
- Screen/input controller for arbitrary apps.
- Settings flags, permission onboarding, live agent viewport UI.
- Threat model / allowlist policy engine for interactive environments.

## Implementation Recommendations

### Product definitions

- **use_browser**: Agent operates a **Chaeboxi-managed browser session** (isolated profile) to complete web tasks.
- **use_computer**: Agent **observes and operates the OS GUI** (screen + input) under explicit user grant — desktop only.

### Architecture (target)

```text
UI (toggle + live panel + kill)
  → session flags (browserEnabled / computerEnabled)
  → stream-text tool assembly
  → use_browser / use_computer toolsets (Vercel AI SDK tools)
  → approval + risk wrapper (stricter than MCP defaults)
  → BrowserController / ComputerController (platform interface)
       Desktop → Tauri IPC → Rust orchestration
            → browser sidecar (Playwright/Chromium) OR
            → OS capture + input injection modules
       Web/Mobile → unavailable (clear errors)
  → audit log + optional frame attachments to message parts
```

### Tool surface (YAGNI v1)

**Browser v1**

- `browser_navigate`, `browser_snapshot` (a11y), `browser_click`, `browser_type`, `browser_scroll`, `browser_tabs`, `browser_screenshot` (debug/vision fallback)
- Optional later: `browser_select`, `browser_wait`, downloads, PDF print

**Computer v1 (after browser stable)**

- Start with **observe-only**: `computer_screenshot` (+ optional AX summary)
- Then act: `computer_click`, `computer_type`, `computer_key`, `computer_scroll`
- Hard gate: settings opt-in + OS permission check + per-session arming

### Common pitfalls

- Building pixel-only browser because demos look cool — worse reliability and cost.
- Reusing user’s daily browser profile by default.
- Treating CU as “terminal but with mouse” without approval redesign.
- Provider-specific tool schemas only (Claude beta) — breaks Ollama/OpenRouter path.
- No live kill switch → support nightmare.
- Unlimited step loops → token bill and stuck generations.

## Resources

- OpenAI Computer Use / desktop CU docs; Operator/CUA historical design (screenshot + actions).
- Anthropic computer use tool docs + quickstart reference.
- Playwright MCP / Playwright a11y snapshots.
- browser-use (Python) architecture notes (CDP migration).
- Chaeboxi: `docs/system-architecture.md`, `docs/project-overview-pdr.md`, prior screenshot research under `plans/2026-08-06-menubar-floating-chat-screenshots/`.

## Unresolved questions

1. Accept Chromium download/sidecar size on desktop installers?
2. Multi-monitor coordinate space policy for CU?
3. Should browser pages ever auto-attach screenshots into chat history (storage bloat)?
4. Room/swarm: which agent may hold browser lock (single session mutex)?
5. Legal/copy: how aggressive to warn on CU vs browser?

## Next steps

See `plans/2026-08-11-use-browser-use-computer/plan.md`.
