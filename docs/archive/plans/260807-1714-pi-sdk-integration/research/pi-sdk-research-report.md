# Research Report: Pi SDK Integration into Chaeboxi

**Date:** 2026-08-07  
**Scope:** Evaluate `@earendil-works/pi-coding-agent` SDK for Chaeboxi (ChatGPT-like agent UX for non-tech users)  
**Gemini CLI:** unavailable (exit 127) — used official docs + WebSearch + codebase scout

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Research Methodology](#research-methodology)
3. [Key Findings](#key-findings)
4. [Chaeboxi Fit Analysis](#chaeboxi-fit-analysis)
5. [Comparative Analysis](#comparative-analysis)
6. [Implementation Recommendations](#implementation-recommendations)
7. [Resources](#resources--references)
8. [Unresolved Questions](#unresolved-questions)

---

## Executive Summary

**Pi is a coding-agent harness, not a consumer ChatGPT product.** Package `@earendil-works/pi-coding-agent` (~0.84.1, Node `>=22.19.0`) exposes agent loop, tools (`read`/`bash`/`edit`/`write`/…), skills, extensions, compaction, and multi-provider LLM auth via SDK + RPC. Official use case: embed agent in apps/IDEs; OpenClaw cited as real-world integration.

**Chaeboxi already has partial agent stack:** multi-provider chat (Vercel AI SDK), toolsets (web/KB/terminal/files), MCP, skills, tool approval/risk engine, and **OpenClaw gateway provider** with observation UI.

**Recommended strategy:** do **not** replace Chaeboxi core generation with Pi. Ship Pi as a **desktop agent backend** (RPC subprocess, OpenClaw-pattern provider), behind a simple **Assistant vs Agent** product mode. Default OOTB = safe ChatGPT-like Assistant (native stack). Agent mode uses Pi (or OpenClaw) with visible tool observation and strong approvals — “bridge to agent of choice.”

**Hard constraints:** Pi requires Node process (not WebView). No built-in sandbox. Non-tech “work OOTB” needs Chaeboxi-owned auth, workspace picker, tool presets, and UI that hides coding-agent jargon.

---

## Research Methodology

- **Sources:** pi.dev SDK/RPC/security/docs, GitHub earendil-works/pi, npm metadata, Chaeboxi codebase (OpenClaw, MCP, stream-text, skills, tools)
- **Date range:** docs current as of 2026-08-07
- **Search terms:** pi-coding-agent SDK, RPC mode, embed agent, security sandbox, OpenClaw integration
- **Max research budget:** 5 external fetches + codebase scout

---

## Key Findings

### 1. Technology Overview

| Piece | Role |
|-------|------|
| `@earendil-works/pi-ai` | Multi-provider LLM API |
| `@earendil-works/pi-agent-core` | Agent loop + tool state |
| `@earendil-works/pi-coding-agent` | Session, tools, skills, extensions, CLI/SDK/RPC |

**SDK surface (`createAgentSession`):**
- `session.prompt()` / `steer()` / `followUp()` / `abort()` / `dispose()`
- Event stream: `message_update`, `tool_execution_*`, `agent_start/end`, compaction, retry
- `ModelRuntime` for auth (auth.json, env keys, runtime overrides)
- `SessionManager` (in-memory or JSONL tree sessions)
- `DefaultResourceLoader` for skills/extensions/prompts/AGENTS.md
- Built-in tools: `read`, `bash`, `edit`, `write` (default); also `grep`, `find`, `ls`
- Custom tools via `defineTool()`; extensions via TS factories

**RPC alternative:** `pi --mode rpc` — JSONL stdin/stdout. Preferred for process isolation / non-Node hosts. Docs note: Node apps can use in-process SDK; other languages/isolation → RPC.

**Engines:** Node `>=22.19.0` (npm 0.84.1).

### 2. Current State & Trends

- Active monorepo (~5.5k commits), MIT, desktop workbenches appearing (e.g. OpenPi community)
- Design: small core + extensions/skills/packages
- Integration path proven externally (OpenClaw referenced on pi.dev)
- Security posture explicit: **no built-in permission sandbox**; project trust only gates loading project resources

### 3. Best Practices (from Pi + host-app patterns)

1. **Isolate process** for untrusted work (container/VM docs exist; RPC isolation is baseline)
2. **Inject credentials at runtime** (`setRuntimeApiKey` / env) — don’t force users into `~/.pi/agent` alone
3. **Subscribe to events** for UI; treat `message_end` as authoritative for full messages
4. **During streaming**, always set `streamingBehavior: "steer" | "followUp"`
5. **Map tool events** to host UI approval gates (Pi won’t do Chaeboxi risk tiers for you)
6. **Workspace = explicit cwd** — never free-roam home for consumer UX
7. **RPC JSONL:** split only on `\n` (not Node readline Unicode separators)

### 4. Security Considerations

| Risk | Severity for non-tech product | Mitigation |
|------|-------------------------------|------------|
| `bash` + file write as user | Critical | Safe preset: no bash; approval on write; optional container later |
| No built-in sandbox | High | Desktop-only; workspace root; OS sandbox later |
| Project trust ignored in RPC without saved trust | Medium | Control cwd + resource loading; avoid untrusted `.pi/` |
| Prompt injection via files | High (inherent) | Observation UI, confirm destructive tools |
| Credential dual-store (`~/.pi` vs Chaeboxi) | Medium | Single source: Chaeboxi settings → runtime inject |

Chaeboxi already has `risk-engine`, tool approval modals, terminal security classifiers — **reuse**, don’t reinvent inside Pi.

### 5. Performance Insights

- Agent multi-step tool loops = longer latency + higher token cost than plain chat
- Compaction/retry built-in (good for long agent sessions)
- Subprocess RPC adds IPC overhead but safer than embedding Node agent in UI process
- Bundle weight: full coding-agent package heavy — keep out of renderer web bundle

---

## Chaeboxi Fit Analysis

### Existing assets to reuse

| Capability | Location | Relevance |
|------------|----------|-----------|
| Remote agent provider pattern | `OpenClaw` provider + `OpenClawModel` | Blueprint for Pi provider |
| Gateway client / session binding | `src/shared/openclaw/` | Mirror for Pi RPC host |
| Tool observation UI | session route agent chrome | Reuse for Pi tool events |
| Tool approval + risk tiers | `packages/tools/risk-engine` | Gate Pi tools at host |
| MCP tools | `packages/mcp` + Rust IPC | Parallel “capability bus” |
| Skills | `packages/skills` (agentskills.io) | Overlaps Pi skills discovery |
| Multi-provider keys | settings store | Feed Pi `ModelRuntime` |
| Native child processes | Tauri / MCP stdio | Spawn `pi --mode rpc` |

### Platform constraints

| Platform | Pi feasible? | Notes |
|----------|--------------|-------|
| Desktop Tauri | Yes | Spawn Node sidecar or system `pi` |
| Web | No (without remote gateway) | No local bash/fs; browser can’t run Pi |
| Mobile | No (v1) | Same |

### Product tension (brutal)

User goal: **ChatGPT for non-tech + app is agent + Pi core + bridge agents + OOTB.**

Reality:
- Pi DNA = **developer coding agent**
- ChatGPT DNA = **general assistant**, tools optional, high trust UX
- Chaeboxi DNA = **multi-provider chat client** with growing agent attachments (MCP, OpenClaw)

Forcing Pi as *the only core* for all chats = wrong abstraction, dual LLM stacks, session format fight (Chaeboxi sessions vs Pi JSONL), and safety nightmare for non-tech.

**Correct product framing:**  
Chaeboxi remains the **client + observation shell**.  
Pi is one **agent runtime** you can switch to (like OpenClaw).  
Default everyday chat stays native Chaeboxi pipeline.

---

## Comparative Analysis

### Integration options

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **A. Pi as Provider (RPC)** | Isolates risk; mirrors OpenClaw; desktop-clean; OOTB profiles possible | Desktop-only; dual session models; need event mapper | **Recommended** |
| **B. In-process SDK in Node sidecar** | Typesafe; deeper control | Still need sidecar; heavier coupling | Good for v2 after RPC PoC |
| **C. Replace generation.ts with Pi** | “Pi is the core” | Breaks web/mobile providers; YAGNI violation; huge rewrite | **Reject for v1** |
| **D. Pi tools only via customTools bridge into AI SDK** | Keep single chat stack | Lose agent loop/compaction/skills runtime | Weak; reinvent agent loop |
| **E. Only document “install OpenClaw that uses Pi”** | Minimal code | Not embedding Pi in Chaeboxi; user already has OpenClaw path | Complementary, not the ask |

### Chaeboxi native agent vs Pi vs OpenClaw

| | Native (model-calls) | Pi | OpenClaw |
|--|---------------------|-----|----------|
| UX fit non-tech chat | Best | Poor unless skinned | Medium |
| Local tools / coding | Partial | Best | Depends on gateway |
| Multi-provider keys | Best (existing) | Via ModelRuntime | Gateway-managed |
| Web support | Yes | No | Remote yes |
| Observation of tools | Yes | Excellent events | Already wired |
| Maturity in app | High | Zero | Partial |

---

## Implementation Recommendations

### Product architecture (KISS)

```
┌─────────────────────────────────────────────────────────┐
│  Chaeboxi UI (ChatGPT-like)                             │
│  - messages, approvals, tool timeline, model picker     │
└───────────────────────┬─────────────────────────────────┘
                        │ AgentRuntime interface
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
   NativeRuntime   PiRuntime    OpenClawRuntime
   (AI SDK+tools)  (RPC/SDK)    (WS gateway)
```

**Modes for non-tech:**
1. **Assistant** (default): NativeRuntime, tools off or soft tools (search), no shell
2. **Agent**: PiRuntime with profile:
   - Safe: `read`/`ls`/`grep` only + approvals
   - Helpful: + web/search custom tools
   - Power: + edit/write with confirm; bash optional + strong gates
3. **Remote Agent**: OpenClaw (existing)

User never picks “RPC” or “ModelRuntime” — only: chat mode + model + optional folder.

### Recommended ship path

#### Phase 0 — Decisions + PoC (2–4 days)

- Confirm product modes (Assistant vs Agent)
- PoC: Tauri spawn `pi --mode rpc --no-session`, prompt, stream text + one tool event into dummy UI
- Validate Node 22 packaging strategy (system install vs bundled sidecar)
- Go/no-go on RPC vs sidecar SDK

**PoC acceptance:** stream reply in desktop app; show tool start/end; abort works; process dies cleanly.

#### Phase 1 — Pi host in Tauri (backend)

- Rust command: start/stop/send/subscribe Pi RPC child
- Auth injection from Chaeboxi provider keys
- Workspace path binding (user-selected project folder)
- Crash recovery + single-instance per session

#### Phase 2 — Provider + session model

- New `ModelProviderEnum.Pi` (or `AgentRuntime: pi`) following OpenClaw patterns:
  - Own session binding store
  - Bypass local thread semantics where Pi owns history (same as OpenClaw)
- Map Pi events → `Message` / `MessageToolCallPart` / thinking parts
- Wire abort, steer/follow-up for mid-flight user messages

#### Phase 3 — Observation + safety UX (ChatGPT-like)

- Tool timeline (reuse OpenClaw agent chrome)
- Approval modal for medium/high risk tools (map Pi tools into risk-engine)
- Safe defaults OOTB; Advanced collapse for bash/extensions
- Empty states: “Choose a folder” / “Connect a model” — no terminal language

#### Phase 4 — Agent-of-choice bridge

- Session setting: runtime = native | pi | openclaw
- Unified observation contract so UI is runtime-agnostic
- Optional: skill catalog merge (Chaeboxi skills ↔ Pi skills paths)

#### Phase 5 — Hardening

- Bundle Node+pi for zero-setup desktop (hardest packaging piece)
- Optional sandbox (Docker/Gondolin) for Power profile
- Web: message “Agent mode requires desktop” or remote OpenClaw only

### Do NOT do in v1

- Replace all providers with Pi’s model catalog
- Run Pi in renderer / web build
- Enable bash by default for non-tech profile
- Dual-write full history to both Pi JSONL and Chaeboxi storage without a sync plan (pick: Pi owns agent history OR map into Chaeboxi messages on each turn)

### Session ownership recommendation

**Like OpenClaw:** Pi owns agent history during Agent sessions; Chaeboxi stores projected UI messages + binding ids. Avoid 2-way sync complexity in v1.

### Auth recommendation

```
Chaeboxi Settings providers
        │
        ▼
  Pi host sets env / setRuntimeApiKey
        │
        ▼
  ModelRuntime (no user-facing ~/.pi required)
```

Optional advanced: “Use my existing Pi CLI config” toggle.

### Code sketch (RPC client shape)

```typescript
// conceptual — desktop host, not renderer
type PiCommand =
  | { id: string; type: 'prompt'; message: string; streamingBehavior?: 'steer' | 'followUp' }
  | { type: 'abort' }
  | { type: 'get_state' }

// events: message_update.text_delta → append assistant text
//         tool_execution_start/end → tool call parts + approval hooks
//         agent_settled → mark generation complete
```

### Common pitfalls

1. Treating Pi as drop-in ChatGPT model provider (wrong lifecycle)
2. Using Node `readline` for RPC framing
3. Shipping bash-on-by-default to non-tech users
4. Loading untrusted project `.pi/extensions` without trust policy
5. Trying full SDK inside Vite renderer bundle
6. Ignoring Node 22 engine requirement on user machines

---

## Resources & References

### Official

- https://pi.dev/docs/latest/sdk
- https://pi.dev/docs/latest/rpc
- https://pi.dev/docs/latest/security
- https://pi.dev/docs/latest/ (overview)
- https://github.com/earendil-works/pi
- npm: `@earendil-works/pi-coding-agent@0.84.1`

### Chaeboxi internal

- OpenClaw provider: `src/shared/providers/definitions/openclaw.ts`
- OpenClaw model: `src/shared/models/openclaw.ts`
- Stream/tools: `src/renderer/packages/model-calls/stream-text.ts`
- Skills: `docs/skills.md`
- OpenClaw remote: `docs/openclaw-remote-setup.md`

### Further reading

- Pi extensions, skills, containerization docs on pi.dev
- Community desktop shell: OpenPi (Reddit / PiCodingAgent)

---

## Unresolved Questions

1. **Target users for v1 Agent mode:** pure non-tech only, or power users first then simplify?
2. **Sidecar strategy:** require system `pi` install vs ship Node+pi binary in Tauri resources?
3. **Model source of truth:** only Chaeboxi-configured providers, or also Pi’s native catalogs/OAuth?
4. **Workspace model:** one folder per session, per “project”, or free multi-root?
5. **Relationship to OpenClaw:** keep both as peer runtimes, or treat OpenClaw as remote-only and Pi as local-only?
6. **Skill systems:** merge Chaeboxi `$skills` with Pi skills, or keep separate until v2?
7. **Web product story:** Agent mode desktop-only forever, or future remote Pi gateway?

---

## Actionable Next Steps

1. Stakeholder decide: **Assistant default + Agent (Pi) optional** vs full Pi-core rewrite (recommend first).
2. Run **Phase 0 PoC** (RPC spawn + stream + tool event) before any product UI work.
3. If PoC green → write formal `plan.md` phases 1–4 with file ownership and acceptance tests.
4. Parallel: product copy for non-tech (folder, approve, working…) — hide coding-agent terms.
5. Defer packaging/sandbox until RPC path is proven.
