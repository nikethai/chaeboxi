# OpenClaw Research Report

**Date**: 2026-04-05
**Author**: Claude Code Research
**Purpose**: Comprehensive analysis of OpenClaw for potential integration with Chaeboxi (Tauri + React chat client)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [What is OpenClaw?](#what-is-openclaw)
3. [Technical Architecture](#technical-architecture)
4. [Core Capabilities](#core-capabilities)
5. [API & Protocol Details](#api--protocol-details)
6. [Ecosystem & Extensions](#ecosystem--extensions)
7. [Integration Approach for Chaeboxi](#integration-approach-for-chaeboxi)
8. [Comparison with Alternatives](#comparison-with-alternatives)
9. [Pros & Cons Assessment](#pros--cons-assessment)
10. [Recommendations](#recommendations)

---

## Executive Summary

**OpenClaw** is an open-source, self-hosted personal AI assistant/agent runtime created by Peter Steinberger (PSPDFKit founder). It runs locally on user machines and bridges AI models (Anthropic, OpenAI, local LLMs) to messaging platforms (WhatsApp, Telegram, Discord, Slack, Signal, iMessage, etc.) through a WebSocket-based Gateway architecture.

- **GitHub**: [github.com/openclaw/openclaw](https://github.com/openclaw/openclaw) — ~348K stars, MIT licensed
- **Website**: [openclaw.ai](https://openclaw.ai)
- **Docs**: [docs.openclaw.ai](https://docs.openclaw.ai)
- **Skills Marketplace**: [clawhub.ai](https://clawhub.ai)
- **Runtime**: Node.js 24+ (or 22.16+), TypeScript
- **Status**: Production-ready, very active development (latest release 2026.3.28)

OpenClaw went viral in early 2026, gaining 60K+ GitHub stars in 72 hours. It was subsequently acquired by OpenAI but remains open-source under MIT license. Rabbit R1 hardware also added native OpenClaw integration.

---

## What is OpenClaw?

OpenClaw (formerly Moltbot/Clawdbot) is fundamentally different from chat UIs like ChatGPT or Claude.ai. It is a **local AI agent runtime** — an always-on daemon that:

1. **Runs on your machine** with full system access (files, shell, browser, scripts)
2. **Connects to messaging platforms** as its primary interface (WhatsApp, Telegram, Discord, Slack, etc.)
3. **Executes tasks autonomously** — file operations, browser automation, scheduled jobs, email management
4. **Maintains persistent memory** across sessions via local Markdown documents
5. **Extends via skills/plugins** from a community marketplace (ClawHub)

### Key Differentiator

Traditional AI chat apps (like Chaeboxi) are **conversation-centric**: you type, AI responds. OpenClaw is **action-centric**: you tell it what to do, and it does it — browsing websites, managing files, sending emails, controlling smart home devices — all while maintaining context 24/7.

### Use Cases

- Developer automation (GitHub integration, CI/CD triggers, debugging)
- Personal productivity (calendar, email, reminders, notes)
- Browser automation (web scraping, form filling, data extraction)
- Smart home control (Philips Hue, etc.)
- Social media scheduling
- Cross-platform messaging coordination
- Background monitoring with cron jobs

---

## Technical Architecture

### Hub-and-Spoke Model

```
                    ┌──────────────┐
                    │  AI Models   │
                    │ (Anthropic,  │
                    │  OpenAI,     │
                    │  Local LLMs) │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │   Pi Agent   │
                    │   Runtime    │
                    │ (RPC + Tool  │
                    │  Streaming)  │
                    └──────┬───────┘
                           │
┌──────────────────────────▼──────────────────────────┐
│                  Gateway (WS Server)                 │
│              127.0.0.1:18789 (default)               │
│                                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │ Sessions │ │ Channels │ │  Router  │            │
│  │ Manager  │ │ Manager  │ │          │            │
│  └──────────┘ └──────────┘ └──────────┘            │
└──┬────┬────┬────┬────┬────┬────┬────┬───────────────┘
   │    │    │    │    │    │    │    │
   ▼    ▼    ▼    ▼    ▼    ▼    ▼    ▼
  WA  Tele  Disc Slack Sig  iMsg IRC  Web
  App gram  ord       nal       Chat  Chat
```

### Core Components

| Component | Description | Technology |
|-----------|-------------|------------|
| **Gateway** | Central WebSocket server; all clients connect here | Node.js, WS on port 18789 |
| **Pi Agent** | LLM agent runtime with tool/block streaming | RPC mode, multi-model |
| **Channels** | Messaging platform adapters | Baileys (WA), grammY (Telegram), Bolt (Slack), discord.js |
| **Sessions** | Isolated per-sender/group conversation state | Session routing, group isolation |
| **Skills** | Plugin system for extensibility | TypeScript/JS modules |
| **Nodes** | Device-native capabilities (camera, screen, canvas) | macOS, iOS, Android companion apps |
| **Memory** | Persistent context across sessions | Local Markdown files |
| **Browser** | Web automation via CDP | Chrome DevTools Protocol |
| **Lobster** | Workflow automation engine | YAML pipelines, typed data |

### Runtime Requirements

- **Node.js**: v24 (recommended) or v22.16+
- **Platforms**: macOS, Windows, Linux
- **Companion Apps**: macOS menu bar (macOS 15+), iOS, Android
- **AI Models**: Anthropic Claude, OpenAI, or local models via any compatible API

### Configuration

Hierarchical configuration stored at `~/.openclaw/openclaw.json`:

- **Models & Auth**: API key management, OAuth rotation, model selection per-session
- **Channels**: Per-channel DM policies (`pairing`/`open`), allowlists, chunking rules
- **Sessions**: Main/group isolation, activation modes, reply-back behavior
- **Gateway Auth**: Password mode, Tailscale identity headers, token validation
- **Node Permissions**: TCC mapping, elevated bash access

Supports declarative Nix configuration and Docker deployments.

---

## Core Capabilities

### 1. Multi-Channel Messaging Gateway

Supported platforms (25+):
WhatsApp (Baileys), Telegram (grammY), Slack (Bolt), Discord (discord.js), Google Chat, Signal, BlueBubbles (iMessage), IRC, Microsoft Teams, Matrix, Feishu, LINE, Mattermost, Nextcloud Talk, Nostr, Synology Chat, Tlon, Twitch, Zalo, WeChat, WebChat

### 2. System Integration

- **File System**: Full read/write with optional sandboxing
- **Shell Execution**: Run commands, scripts, with configurable permission levels
- **Browser Automation**: Navigate, fill forms, extract data via Chrome DevTools Protocol
- **Elevated Access**: Configurable via `/elevated on|off`

### 3. Persistent Memory

- Memory stored as local Markdown documents
- Survives across sessions and restarts
- AI learns user preferences, context, and patterns
- Transfers across agent instances

### 4. Autonomous Operations

- **Cron Jobs**: Scheduled task execution
- **Event Wakeups**: Trigger on conditions
- **Webhook Handlers**: HTTP POST inbound with session routing
- **Gmail Pub/Sub**: Email event delivery
- **Background Monitoring**: Heartbeat checks

### 5. Agent-to-Agent Communication

Three session tools for cross-agent coordination:
- `sessions_list` — discover active agents
- `sessions_history` — fetch session transcripts
- `sessions_send` — message another session

### 6. Voice & TTS

- ElevenLabs integration with system TTS fallback
- Voice Wake on macOS and iOS
- Talk Mode overlay for hands-free interaction

---

## API & Protocol Details

### Gateway WebSocket Protocol

**Transport**: WebSocket with JSON text frames on port 18789

**Message Types**:
```typescript
// Request
{ type: "req", id: string, method: string, params: object }

// Response
{ type: "res", id: string, ok: boolean, payload?: object, error?: object }

// Event
{ type: "event", event: string, payload: object, seq?: number, stateVersion?: number }
```

### Authentication Flow (Challenge-Response)

```
Client                              Gateway
  │                                    │
  │──── WS Connect ──────────────────►│
  │                                    │
  │◄─── connect.challenge ────────────│
  │     { nonce, timestamp }           │
  │                                    │
  │──── connect ──────────────────────►│
  │     { auth, deviceId, signedNonce }│
  │                                    │
  │◄─── hello-ok ─────────────────────│
  │     { protocolVersion, policy }    │
```

### Client Roles

- **Operator**: Controls the system (read/write/admin/approvals scopes)
- **Node**: Provides capabilities (camera, screen, canvas, system execution)

### Major RPC Method Families

| Family | Methods | Purpose |
|--------|---------|---------|
| **System** | identity, presence, heartbeat | System state |
| **Models** | catalog, quota, cost, usage | LLM management |
| **Channels** | login, logout, push, wake-word | Messaging platforms |
| **Agent/Sessions** | create, manage, subscribe, workspace | Agent lifecycle |
| **Config** | read, write, patch, schema | Configuration |
| **Pairing** | approve, rotate, revoke tokens | Device security |
| **Node** | invoke, pending, canvas refresh | Device capabilities |
| **Approvals** | exec, policy, plugin-defined | Permission workflows |
| **Talk/TTS** | synthesis, providers, mode | Voice interaction |

### HTTP API Endpoints

- **OpenAI Chat Completions compatible** endpoint — enables drop-in replacement for OpenAI-compatible clients
- **Tools Invoke API** — HTTP endpoint for triggering tool execution

### Proposed SDK (In Development)

A `@openclaw/gateway-client` npm package is [proposed (issue #49178)](https://github.com/openclaw/openclaw/issues/49178) to extract a reusable WebSocket client SDK:

```typescript
// Proposed API surface (not yet released)
import { createGatewayClient } from '@openclaw/gateway-client'

const client = createGatewayClient({
  url: 'ws://127.0.0.1:18789',
  transport: 'browser', // or 'node', 'react-native'
  storage: 'localStorage', // or 'filesystem', 'keychain'
})

await client.connect({ token: 'device-token' })

// Send RPC requests
const sessions = await client.request('sessions.list', {})

// Listen for events
client.on('session.message', (payload) => {
  console.log('New message:', payload)
})
```

**Status**: Feature request stage — not yet implemented. Currently, integrators must implement the WS protocol directly based on source code.

---

## Ecosystem & Extensions

### ClawHub (Skills Marketplace)

- **URL**: [clawhub.ai](https://clawhub.ai)
- **Model**: npm-like versioning with vector-based search
- **Install**: `npx clawhub@latest install <skill-name>`
- **Publish**: Open submission, no gatekeeping
- **Types**: Bundled (shipped), Managed (curated), Workspace (user-defined)

### Lobster (Workflow Engine)

A typed, local-first workflow automation engine for composable pipelines:

```yaml
name: jacket-advice
args:
  location:
    default: Phoenix
steps:
  - id: fetch
    run: weather --json ${location}
  - id: confirm
    approval: Want jacket advice?
    stdin: $fetch.json
  - id: advice
    pipeline: >
      llm.invoke --prompt "Given this weather, wear a jacket?"
    stdin: $fetch.json
    when: $confirm.approved
```

- YAML-based workflow definitions
- Typed data passing (JSON objects, not text pipes)
- Human approval gates
- Tool invocation shims (`openclaw.invoke`, `clawd.invoke`)
- Native LLM calls (`llm.invoke`)

### ACPX (Agent Client Protocol CLI)

Headless CLI for Agent Client Protocol sessions:
- Persistent multi-turn conversations
- Session management (create, list, inspect, close)
- Supports multiple agents: Pi, OpenClaw, Codex CLI, Claude Code, Gemini CLI, Cursor, GitHub Copilot CLI
- Prompt queuing and cooperative cancellation

### 50+ Pre-built Integrations

Gmail, GitHub, Obsidian, Calendar, Spotify, Twitter, Philips Hue, Sentry, and many more.

---

## Integration Approach for Chaeboxi

### Strategy Overview

There are **three integration tiers**, from lightweight to deep:

### Tier 1: OpenClaw as an LLM Provider (Simplest)

OpenClaw exposes an **OpenAI Chat Completions-compatible HTTP endpoint**. Chaeboxi could connect to a running OpenClaw gateway as if it were another OpenAI-compatible provider.

**Implementation**:

1. Add OpenClaw as a provider in `src/shared/providers/definitions/`:

```typescript
// src/shared/providers/definitions/openclaw.ts
import { defineProvider } from '../registry'
import { OpenClawModel } from './models/openclaw'

export const openclawProvider = defineProvider({
  id: 'openclaw',
  name: 'OpenClaw',
  type: 'openai-compatible',
  createModel: (deps) => new OpenClawModel(deps),
  defaultSettings: {
    apiHost: 'http://127.0.0.1:18789',
    apiPath: '/v1/chat/completions',
    models: ['pi-agent'],
  },
})
```

2. Create the model class extending `OpenAICompatibleModel`:

```typescript
// src/shared/providers/definitions/models/openclaw.ts
import { OpenAICompatibleModel } from './openai-compatible'

export class OpenClawModel extends OpenAICompatibleModel {
  // OpenClaw's completions endpoint is OpenAI-compatible
  // May need to handle tool invocation responses differently
}
```

3. Add settings UI in `src/renderer/routes/settings/provider/OpenClawSettings.tsx`

**Pros**: Minimal code changes, uses existing OpenAI-compatible infrastructure
**Cons**: Loses most OpenClaw-specific features (memory, skills, browser automation, multi-channel)

### Tier 2: Gateway WebSocket Integration (Medium)

Connect to OpenClaw's Gateway WebSocket to access full session management, tool execution, and agent capabilities.

**Implementation**:

1. Create a WebSocket client service:

```typescript
// src/renderer/packages/openclaw/gateway-client.ts
export class OpenClawGatewayClient {
  private ws: WebSocket | null = null
  private requestMap = new Map<string, { resolve: Function; reject: Function }>()
  private eventHandlers = new Map<string, Set<Function>>()

  constructor(private config: { url: string; token?: string }) {}

  async connect(): Promise<void> {
    this.ws = new WebSocket(this.config.url)

    this.ws.onmessage = (event) => {
      const frame = JSON.parse(event.data)

      if (frame.type === 'res') {
        const pending = this.requestMap.get(frame.id)
        if (pending) {
          frame.ok ? pending.resolve(frame.payload) : pending.reject(frame.error)
          this.requestMap.delete(frame.id)
        }
      } else if (frame.type === 'event') {
        this.eventHandlers.get(frame.event)?.forEach((h) => h(frame.payload))
      }
    }

    // Handle challenge-response auth
    await this.handleHandshake()
  }

  async request(method: string, params: object): Promise<any> {
    const id = crypto.randomUUID()
    return new Promise((resolve, reject) => {
      this.requestMap.set(id, { resolve, reject })
      this.ws?.send(JSON.stringify({ type: 'req', id, method, params }))
    })
  }

  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set())
    }
    this.eventHandlers.get(event)!.add(handler)
  }

  private async handleHandshake(): Promise<void> {
    // Wait for connect.challenge, sign nonce, send connect frame
    // Receive hello-ok confirmation
  }
}
```

2. Create a Jotai atom for OpenClaw state:

```typescript
// src/renderer/stores/atoms/openclawAtoms.ts
import { atom } from 'jotai'

export const openclawConnectionAtom = atom<'disconnected' | 'connecting' | 'connected'>('disconnected')
export const openclawSessionsAtom = atom<OpenClawSession[]>([])
export const openclawMemoryAtom = atom<string[]>([])
```

3. Create a dedicated OpenClaw panel/view in the UI for agent interactions

**Pros**: Full access to OpenClaw's capabilities, real-time updates
**Cons**: Significant development effort, protocol may change (no stable SDK yet)

### Tier 3: Deep Integration via Tauri IPC (Most Complete)

Use Tauri's Rust backend to manage the OpenClaw connection, similar to how Chaeboxi handles MCP servers.

**Implementation**:

1. Add OpenClaw WebSocket client to `src-tauri/`:

```rust
// src-tauri/src/openclaw.rs
use tokio_tungstenite::connect_async;
use serde_json::Value;

pub struct OpenClawBridge {
    ws_tx: mpsc::Sender<String>,
    sessions: Arc<Mutex<HashMap<String, SessionState>>>,
}

impl OpenClawBridge {
    pub async fn connect(url: &str) -> Result<Self> {
        let (ws_stream, _) = connect_async(url).await?;
        // Set up message routing...
    }

    pub async fn send_message(&self, session_id: &str, content: &str) -> Result<Value> {
        // Route message through Gateway protocol
    }
}
```

2. Expose via Tauri IPC commands:

```rust
#[tauri::command]
async fn openclaw_connect(url: String, state: State<'_, OpenClawState>) -> Result<(), String> {
    // Connect to Gateway
}

#[tauri::command]
async fn openclaw_send(session_id: String, message: String, state: State<'_, OpenClawState>) -> Result<Value, String> {
    // Send message to OpenClaw session
}
```

3. Create TypeScript IPC adapter:

```typescript
// src/renderer/platform/desktop/openclawAdapter.ts
import { invoke } from '@tauri-apps/api/core'

export const openclawDesktopAdapter = {
  connect: (url: string) => invoke('openclaw_connect', { url }),
  send: (sessionId: string, message: string) =>
    invoke('openclaw_send', { sessionId, message }),
  listSessions: () => invoke('openclaw_list_sessions'),
}
```

**Pros**: Native performance, process isolation, full Tauri security model
**Cons**: Major development effort, Rust WS implementation, complex state management

### Recommended Approach

**Start with Tier 1** (OpenAI-compatible endpoint) for quick wins, then **graduate to Tier 2** (WebSocket client in the renderer) once the `@openclaw/gateway-client` SDK is released. Tier 3 only if deep native integration becomes a product requirement.

---

## Comparison with Alternatives

| Feature | OpenClaw | Open Interpreter | Claude Computer Use | Devin | Rabbit R1 |
|---------|----------|-----------------|-------------------|-------|-----------|
| **Type** | Agent runtime + gateway | Code interpreter | Browser automation | AI engineer | Hardware + LAM |
| **Self-hosted** | Yes (local) | Yes (local) | No (API) | No (cloud) | No (device) |
| **Open Source** | Yes (MIT) | Yes (MIT) | No | No | No |
| **Multi-channel** | 25+ platforms | Terminal only | Browser only | IDE | Voice + screen |
| **Persistent Memory** | Yes | Limited | No | Yes (repos) | Limited |
| **Browser Automation** | Yes (CDP) | Via tools | Yes (native) | Yes | Yes (LAM) |
| **File System Access** | Full | Full | Sandboxed | Repo-scoped | None |
| **Skills/Plugins** | ClawHub ecosystem | Community tools | None | None | App training |
| **Cron/Scheduling** | Native | No | No | No | No |
| **Agent-to-Agent** | Yes | No | No | No | No |
| **Voice Interface** | Yes (ElevenLabs) | No | No | No | Yes (primary) |
| **Mobile Companion** | iOS + Android | No | No | No | R1 device |
| **Stars (GitHub)** | ~348K | ~56K | N/A | N/A | N/A |
| **Maturity** | Production | Production | Preview | Limited access | Consumer device |

### Key Differentiators

1. **OpenClaw vs Open Interpreter**: OpenClaw is an always-on agent daemon accessible via messaging; Open Interpreter is a terminal-based code execution tool. OpenClaw is broader in scope.

2. **OpenClaw vs Claude Computer Use**: Computer Use is API-only browser automation. OpenClaw is a full local runtime with system access, memory, scheduling, and multi-platform messaging.

3. **OpenClaw vs Devin**: Devin is specialized for software engineering. OpenClaw is a general-purpose personal assistant covering all domains.

4. **OpenClaw vs Rabbit R1**: Rabbit requires dedicated hardware. OpenClaw runs on existing devices and is open-source. Notably, Rabbit now integrates WITH OpenClaw.

---

## Pros & Cons Assessment

### Pros

| Category | Details |
|----------|---------|
| **Privacy** | Fully local execution; data never leaves your machine unless you choose cloud models |
| **Open Source** | MIT licensed, massive community (348K stars), active development |
| **Multi-Channel** | 25+ messaging platforms as interfaces — meet users where they are |
| **Extensible** | Skills marketplace (ClawHub), self-modifying capabilities, hot-reloading |
| **Model Agnostic** | Works with Anthropic, OpenAI, local models — no vendor lock-in |
| **Always-On** | Daemon architecture with cron jobs, webhooks, event triggers |
| **Persistent Memory** | Context survives across sessions and restarts |
| **Production Ready** | Large community, active maintainer, enterprise deployments |
| **OpenAI-Compatible API** | Chat completions endpoint enables easy integration |
| **Cross-Platform** | macOS, Windows, Linux + iOS/Android companion apps |

### Cons

| Category | Details |
|----------|---------|
| **No Official Client SDK** | `@openclaw/gateway-client` is proposed but not yet released (issue #49178) |
| **Protocol Instability** | WebSocket protocol may change; no semver guarantees on WS frames yet |
| **System Access Risk** | Full file system + shell access requires trust; sandbox mode limits functionality |
| **Node.js Dependency** | Requires Node 24+ or 22.16+; adds runtime dependency for desktop apps |
| **Resource Usage** | Always-on daemon consumes system resources (memory, CPU for browser automation) |
| **Complexity** | Configuration is powerful but complex (hierarchical JSON, Nix, Docker options) |
| **API Key Costs** | Cloud model usage incurs API costs (though local models are free) |
| **Security Surface** | WebSocket gateway is an attack surface; pairing/auth adds complexity |
| **Young Ecosystem** | ClawHub skills marketplace is still sparse; community is growing but early |
| **Acquisition Uncertainty** | OpenAI acquisition may change project direction (though still MIT) |

---

## Recommendations

### For Chaeboxi Integration

1. **Short-term (Tier 1)**: Add OpenClaw as an OpenAI-compatible provider. This is 1-2 days of work using the existing provider registry pattern. Users who run OpenClaw locally can point Chaeboxi at `http://127.0.0.1:18789/v1/chat/completions`.

2. **Medium-term (Tier 2)**: Once `@openclaw/gateway-client` ships, add a dedicated OpenClaw panel that shows:
   - Connected sessions and their state
   - Agent memory/context
   - Skill activation controls
   - Tool execution history
   - Real-time event stream

3. **Long-term (Tier 3)**: If OpenClaw becomes a core differentiator, implement the Rust-side WebSocket bridge in `src-tauri/` for native performance and security.

### What Problem Does OpenClaw Solve That Chaeboxi Doesn't?

| Gap | Chaeboxi | OpenClaw Fills It |
|-----|----------|-------------------|
| **Task Execution** | Chat only — AI talks | AI acts — runs commands, manages files |
| **Always-On** | Open when needed | 24/7 daemon processing in background |
| **Multi-Channel** | Desktop app only | WhatsApp, Telegram, Discord, etc. |
| **Persistent Memory** | Session-based | Cross-session learned context |
| **Automation** | Manual interaction | Cron jobs, webhooks, event triggers |
| **Browser Control** | None | Full CDP automation |
| **Skills/Plugins** | None | Extensible marketplace |

### Strategic Value

Integrating OpenClaw positions Chaeboxi as not just a chat interface, but a **control plane for an AI agent**. Users could:
- Chat with AI models via Chaeboxi's polished UI
- Dispatch long-running tasks to OpenClaw's agent runtime
- Monitor agent activities and approve sensitive operations
- View agent memory and skill status
- All from one unified desktop application

This would be a significant competitive differentiator vs. other chat UIs.

---

## Sources

- [OpenClaw Website](https://openclaw.ai)
- [OpenClaw GitHub Repository](https://github.com/openclaw/openclaw) (~348K stars)
- [OpenClaw Documentation](https://docs.openclaw.ai)
- [ClawHub Skills Marketplace](https://clawhub.ai)
- [Gateway Protocol Docs](https://docs.openclaw.ai/gateway/protocol)
- [SDK Feature Request #49178](https://github.com/openclaw/openclaw/issues/49178)
- [Lobster Workflow Engine](https://github.com/openclaw/lobster)
- [ACPX Agent Client Protocol](https://github.com/openclaw/acpx)
- [DigitalOcean — What is OpenClaw](https://www.digitalocean.com/resources/articles/what-is-openclaw)
- [Towards AI — OpenClaw Deep Dive](https://pub.towardsai.net/openclaw-personal-ai-assistant-that-actually-does-your-work-538588507155)
- [Emergent — OpenClaw Competitors](https://emergent.sh/learn/best-openclaw-alternatives-and-competitors)
- [Reddit — OpenClaw 2026.3.28 Release](https://www.reddit.com/r/AISEOInsider/comments/1sbga4n/new_openclaw_2026328_is_insane/)
- [Rabbit + OpenClaw Integration](https://www.rabbit.tech/blog/first-major-update-of-2026-dlam-openclaw-and-a-surprise)
- [Coder — OpenClaw Secure Workspace](https://coder.com/blog/giving-openclaw-a-secure-workspace-using-the-rabbit-r1)
- [DataCamp — OpenClaw Alternatives](https://www.datacamp.com/blog/openclaw-alternatives)
