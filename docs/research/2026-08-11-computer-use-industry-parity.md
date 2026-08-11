# Research Report: Computer Use Parity (Claude / GPT / Perplexity → Chaeboxi)

**Date:** 2026-08-11  
**Scope:** How production computer-use products handle desktop control, and what Chaeboxi should copy vs ignore.  
**Trigger:** Model opens WhatsApp then fails “find contact” (wrong tools, Finder/Spotlight, stop after open).

## Executive Summary

Industry leaders do **not** win WhatsApp-style tasks with smarter prompts alone. They win with a **tight agent harness**:

1. **Dedicated computer tool schema** (one tool, many actions) + **forced agent loop** until done or max iterations.
2. **Screenshot quality pipeline** (pre-downscale to model limits, exact display px, map coords back).
3. **Verify-after-act** prompting baked into the product system prompt.
4. **Tool hierarchy:** connector/API first → browser → **screen last**.
5. **App-scoped permission / focus** (Claude Desktop/Cowork: approve per app; no free roam into everything).
6. **Context management** for multi-screenshot turns (prune old images, keep last N).
7. **Human confirm** on high-stakes acts (send message, money, delete).

Chaeboxi already has pieces (screenshot, click/type/key, open_app, approvals, UI lock, step floor). It is still **behind** on: single-schema computer tool, post-act auto-screenshot, wait/zoom/double-click, screenshot pruning, app allowlist, and “API/integration before pixels.”

**Brutal truth:** locking tools stops Finder *somewhat*. Reliable messaging needs **loop + vision fidelity + optional AX/deep-link**, not more ban-lists.

## Research Methodology

| Item | Detail |
|------|--------|
| Sources | Anthropic Computer Use API docs, Anthropic best-practices blog, Claude Cowork support, OpenAI CUA/Operator, Perplexity Computer/Comet public pages, Chaeboxi `docs/computer-use.md` + code |
| Date range | 2024–2026 public material |
| Search terms | computer use agent loop, screenshot coordinate scaling, Claude Desktop computer use, Operator CUA, Perplexity Computer, accessibility tree vs vision |
| Limit | ~5 research tool batches (ck-research cap) |

### Sources (primary)

- https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool  
- https://claude.com/blog/best-practices-for-computer-and-browser-use-with-claude  
- https://support.claude.com/en/articles/14128542-let-claude-use-your-computer-in-cowork  
- https://openai.com/index/computer-using-agent/  
- https://www.perplexity.ai/products/computer (and help: What is Computer / Comet permissions)

## Key Findings

### 1. Claude (API + Desktop/Cowork)

**Architecture**

- **Agent loop:** model emits `tool_use` → host executes → host returns `tool_result` (often screenshot) → repeat until text-only response or max iterations.
- **Official tool is schema-less / fixed:** one tool named `computer` with actions: `screenshot`, `left_click`, `type`, `key`, `mouse_move`, later `scroll`, drag, multi-click, `hold_key`, **`wait`**, **`zoom`**.
- Host owns: capture, mouse/keyboard inject, display sizing. Model never “opens Finder as a separate universe” unless the sandbox desktop shows it.
- Reference env is often **VM/container** (API demo). **Cowork/Desktop** is **live Mac**: Screen Recording + Accessibility; **per-app permission**; prioritizes **connector → then screen**.

**What makes it work**

| Practice | Why |
|----------|-----|
| Pre-downscale screenshots (e.g. 1280×720; max long edge 1568 / 1.15MP for 4.6 family) | Silent API downscale **breaks click coords** if host doesn’t match |
| `display_width_px` / `display_height_px` = **exact image size model saw** | Offset clicks |
| Text instruction **before** image in content | Better click grounding |
| Prompt: after each step screenshot + self-eval before next | Stops “assume success after open” |
| Keyboard shortcuts when click is hard | Dropdowns/scrollbars |
| Example trajectories / Teach Mode (show don’t tell) | Repeatable workflows |
| Prompt-injection classifiers on official CU tool | Safety |
| Rolling screenshot buffer + compaction | Long tasks don’t explode context |
| Thinking effort medium/high for multi-step UI | Planning without thrash |

**Cowork tool priority (critical product insight)**

> Most precise / fastest first: **connectors & integrations → browser tools → computer use (pixels) last.**

That alone would prevent many “find contact via Finder” failures if WhatsApp had an API/deep-link path.

### 2. OpenAI (Operator / CUA / ChatGPT desktop)

**Architecture**

- Same core loop: **screenshot → reason → GUI action → new state**.
- Often **sandboxed / virtual computer** for Operator-class products (isolation).
- Dedicated **computer-use-oriented models** (e.g. computer-use-preview lineage) trained for GUI grounding.
- Desktop ChatGPT: Screen Recording for observe; local interaction layer for acts (product-specific).
- Safety: system card, user confirmation patterns, limited privileges in sandbox.

**Takeaway for Chaeboxi:** OpenAI invests in **model+loop specialization** and **isolation**. Chaeboxi uses **user’s chosen vision model** + custom tools → harness quality matters more, model variance is higher.

### 3. Perplexity (Computer + Comet)

**Architecture (public)**

- **Comet:** browser agent with explicit permissions.
- **Computer:** agent across **connected apps / Skills** (Gmail, Slack, Notion, GitHub, …) — closer to **integration-first** than pure pixel RPA.
- Enterprise permission model for browser assistant.

**Takeaway:** Perplexity de-risks hard GUIs by **not using the screen when a connector exists**. Pixel control is backup, not default.

### 4. Grounding: vision-only vs hybrid

| Approach | Pros | Cons |
|----------|------|------|
| Screenshot-only (Claude API style, Chaeboxi today) | Works any app | Misses small targets; confuses similar UIs; no semantic “search field” |
| Accessibility tree (AX / UI Automation) | Stable roles, focused app, search fields | Platform-specific; incomplete for Electron/games UIs |
| Hybrid (AX + screenshot fallback) | Best reliability for messaging apps | More code; privacy surface |

Research consensus: **hybrid beats pure vision** for “find contact in WhatsApp.” Industry products often hide this behind product polish + model training.

### 5. Chaeboxi current state (gap map)

| Capability | Industry | Chaeboxi now | Gap |
|------------|----------|--------------|-----|
| Agent loop max steps | High + hard stop | Floor 16 when armed | OK-ish; still low for long flows |
| Single `computer` tool | Yes (Anthropic) | Many `computer_*` tools | Model tool-selection noise |
| Auto screenshot after act | Strongly prompted / harness | Prompt + `nextAction` only | Model can skip |
| Wait / zoom / double-click | Yes (Claude) | Partial (no wait/zoom) | Small targets hard |
| Display px contract | Strict | CaptureMeta + map_coords | Good; verify JPEG resize matches model image |
| Tool hierarchy connector→UI | Yes | Flat tool soup (+ UI lock) | Still weak |
| App allowlist / per-app grant | Claude Desktop | Master + session arm | Free roam |
| Screenshot prune in context | Rolling buffer | Budget count only | Context bloat / cost |
| Deep links / app skills | Perplexity-style | open_app by name only | WhatsApp search fragile |
| AX / focused element | Rare public detail | No | Missing |
| Approvals on send/type | HITL | CRITICAL tools | OK |
| UI space lock | Custom | Shipped | Soft only |

## Best Practices (portable to Chaeboxi)

1. **Harness owns the loop** — don’t rely on model to remember “screenshot after open.”
2. **One computer surface** — reduce parallel “find” tools when CU armed (started; expand).
3. **Exact image ↔ coordinate space** — never let provider silent-resize without host map.
4. **Verify gate** — next act only after screenshot (or explicit wait) shows expected app.
5. **Prefer non-pixel paths** — deep link, URL scheme, MCP/API when available.
6. **App scope** — after open WhatsApp, focus/activate; block open of Finder unless goal needs files.
7. **Human confirm send** — keep; don’t confuse with “stuck.”
8. **Teach / playbooks** — short recorded or static playbooks for WhatsApp/Calculator.
9. **Log trajectory** — screenshot + action overlay for debug (industry uses viewers).
10. **YAGNI:** skip full VM cloud computer until local harness works on Calculator + 1 messenger.

## Options Analysis

### A. Prompt-only more (status quo++)
- **Pros:** cheap  
- **Cons:** already failing on WhatsApp find  
- **Verdict:** insufficient alone

### B. Harness auto-observe (recommended core)
- After every act tool: host injects screenshot result or forces next tool = screenshot  
- **Pros:** matches Anthropic “evaluate after step”  
- **Cons:** more tokens / latency  
- **Verdict:** highest ROI

### C. App playbooks + deep links
- WhatsApp: `open -a WhatsApp` + optional `whatsapp://send?phone=` / in-app search playbook  
- **Pros:** reliable for known apps  
- **Cons:** per-app maintenance  
- **Verdict:** do for top 3 apps after B

### D. Accessibility assist
- Resolve frontmost app, find search field, focus it, then type  
- **Pros:** fixes “can’t find search box”  
- **Cons:** macOS AX work  
- **Verdict:** Phase 2

### E. Cloud VM computer
- **Pros:** isolation like Operator demos  
- **Cons:** wrong product for “my WhatsApp on my Mac”  
- **Verdict:** out of scope

## Recommendation

**Build a “Computer Harness v2”** in three phases:

1. **Loop fidelity** (auto-screenshot, wait, zoom optional, prune images, stricter open→verify).  
2. **App-scoped control** (target app lock, deny Finder for messaging goals, allowlist).  
3. **Hybrid grounding** (AX focus search field + deep links for WhatsApp/iMessage).

Keep UI lock; it is necessary but **not sufficient**.

## Risks

| Risk | Mitigation |
|------|------------|
| Auto-screenshot burns tokens | keep_n=2–3 images; JPEG; budget |
| Hard deny Finder breaks file tasks | intent classifier / user says “files” |
| AX flaky on Electron WhatsApp | fallback to vision |
| User still on App Store old binary | ship TestFlight/local release |
| Over-approval fatigue | batch low-risk observe; keep critical on send |

## Unresolved Questions

1. Exact failure tool cards on latest dev build (search_file_content vs click miss vs step cap)?  
2. Does capture JPEG size always equal dimensions reported to the model for every provider path?  
3. Target: pure vision forever, or invest in AX this quarter?  
4. WhatsApp Desktop vs WhatsApp Web (browser tools might be better for Web)?

---

*Research for Chaeboxi Computer Use. Not an implementation commit.*
