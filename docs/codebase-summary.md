# Codebase Summary

| | |
| --- | --- |
| **Product** | Chaeboxi 1.6.0 |
| **Last updated** | 2026-08-11 |

High-level map of the monorepo for onboarding and navigation. Prefer feature docs (linked below) for subsystem detail.

## Repository layout

```text
chaeboxi/
├── src/
│   ├── renderer/     # React 18 UI, routes, stores, packages, platform
│   └── shared/       # Providers, models, types, pure agent/room logic
├── src-tauri/        # Tauri 2 / Rust backend (IPC, MCP, KB, shell)
├── test/             # Integration / case tests
├── docs/             # Product & feature documentation
├── plans/            # Implementation plans (timestamped folders)
├── package.json      # pnpm scripts, engines (Node 20–22, pnpm ≥10)
├── AGENTS.md         # Contributor architecture entry
└── README.md
```

## Approximate scale

| Area | Files | LOC (approx.) |
| --- | --- | --- |
| `src/renderer` (TS/TSX) | ~760 | ~120k |
| `src/shared` (TS/TSX) | ~164 | ~22k |
| `src-tauri/src` (Rust) | 3 (`lib.rs`, `desktop_shell.rs`, `main.rs`) | ~4.5k |

Counts are approximate and change with development.

## Three layers

### Renderer (`src/renderer/`)

React frontend: UI, routing, state, platform adapters, domain packages.

| Area | Path | Role |
| --- | --- | --- |
| Entry | `index.tsx` | Migrate → settings → i18n → Router; non-blocking MCP bootstrap |
| Routes | `routes/`, `router.tsx`, `routeTree.gen.ts` | TanStack Router; hash history desktop/mobile, browser history web |
| State | `stores/` | Zustand settings/UI; React Query sessions; Jotai atoms |
| Modals | `modals/` | `@ebay/nice-modal-react` |
| Platform | `platform/` | `DesktopPlatform` / `WebPlatform` / `TestPlatform` |
| Storage | `storage/` | `StoreStorage` + debounce policy |
| UI stack | components / pages | Mantine 7 + Tailwind + Emotion (+ residual MUI) |

### Key packages (`src/renderer/packages/`)

| Package | Responsibility |
| --- | --- |
| `model-calls/` | LLM request/streaming wrapper; toolsets |
| `model-context/` | Conversation context assembly |
| `context-management/` | Context window management |
| `token-estimation/` | Token counting |
| `mcp/` | MCP client (IPC to Rust) |
| `memory/` | Personal / session memory |
| `skills/`, `commands/`, `hooks/` | Skills, slash commands, lifecycle hooks |
| `tools/` | Tool execution framework |
| `agents/` | Agent identity / agent-mode helpers |
| `web-search/`, `web-search-enhanced/` | Web search tools |
| `video-url/`, `video/` | Public video URL reader + video UX |
| `integrations/` | Third-party connectors |
| `notifications/` | System notification helpers |
| `usage-tracking/`, `cost-tracking/` | Usage / cost tracking |
| `model-setting-utils/` | Provider settings helpers |
| `session-export/` | Export flows |

### Shared (`src/shared/`)

Process-agnostic TypeScript: providers, models, Zod types, pure orchestration helpers.

| Area | Path | Role |
| --- | --- | --- |
| Product flags | `product.ts` | `PRODUCT`, `CHATBOX_CLOUD_ENABLED`, `TELEMETRY_ENABLED` |
| Registry | `providers/registry.ts`, `providers/definitions/` | `defineProvider()` registrations |
| Models | `models/` | `ModelInterface` → `AbstractAISDKModel` → OpenAI-compatible / concrete / OpenClaw |
| Types | `types/*.ts`, `types.ts` | Provider, session, settings, adapters (split to avoid cycles) |
| Agents (pure) | `agent-room.ts`, `swarm-plan.ts`, `new-chat-agents.ts` | Room modes, swarm plan, new-chat agent selection |
| Integrations types | `integrations/` | Connector contracts |
| IPC types | `desktop-ipc-types.ts` | Desktop IPC surface typing |

**Providers registered (definitions):** OpenAI, OpenAI Responses, Claude, Gemini, DeepSeek, Qwen, MiniMax, Moonshot, SiliconFlow, OpenRouter, Ollama, LM Studio, Azure, Groq, xAI, Mistral, Perplexity, VolcEngine, ChatGLM, OpenClaw, ComfyUI. Legacy ChatboxAI hosted path is disabled via product flags.

### Tauri backend (`src-tauri/src/`)

| File | Role |
| --- | --- |
| `main.rs` | Thin entry |
| `lib.rs` | ~3.8k LOC — app state, **single** `ipc_invoke` command, ~90 channel strings |
| `desktop_shell.rs` | ~770 LOC — tray, shortcuts, screenshot, desktop shell extras |

IPC is **multiplexed**: one Tauri command `ipc_invoke(channel, args)` dispatches by channel name. Channel groups include:

- **Store / blobs** — `getStoreValue`, `setStoreValue`, blob APIs, persistence to JSON on disk
- **System / window** — version, platform, arch, hostname, window controls
- **Secrets** — `secrets:set` / `get` / `delete` (OS keychain)
- **HTTP** — privileged HTTP where needed
- **OAuth** — local callback helper
- **OpenClaw** — `openclaw:*` WebSocket invoke / stream / cancel
- **MCP** — `mcp:server:create|start|list-tools|call-tool|close|list|status` (stdio + HTTP; connect-per-operation in Rust)
- **Knowledge base** — `kb:*`, `kb:file:*`, `kb:search` (in-memory maps + `kb_chunks` JSON files; **keyword** search — not SQLite)
- **FS / shell** — `fs:*`, `execute_command`
- **Skills / commands / hooks scan** — filesystem discovery helpers
- **Desktop shell** — tray, global shortcuts, screenshot (via `desktop_shell`)

CSP is effectively open for local app needs (`null` CSP configuration). Android builds use a reduced capability set.

## Test layout

| Location | Purpose |
| --- | --- |
| Colocated `*.test.ts` / `*.test.tsx` | Unit tests next to source |
| `test/integration/` | Integration suite (long timeout via `pnpm test:integration`) |
| `test/cases/` | Case fixtures / scenarios |
| Vitest | Node env, path aliases `@/*` and `@shared/*` |

See [testing.md](./testing.md).

## Feature doc map

| Doc | Subsystem |
| --- | --- |
| [project-overview-pdr.md](./project-overview-pdr.md) | Product vision, PDR, non-goals |
| [system-architecture.md](./system-architecture.md) | Layers, flows, IPC, security |
| [code-standards.md](./code-standards.md) | Style and contribution standards |
| [design-guidelines.md](./design-guidelines.md) | UI design |
| [adding-provider.md](./adding-provider.md) / [adding-new-provider.md](./adding-new-provider.md) | New LLM provider |
| [agents-multi-agent-rooms.md](./agents-multi-agent-rooms.md) | Agents, Discuss/Work/Swarm |
| [skills.md](./skills.md), [hooks-and-commands.md](./hooks-and-commands.md) | Skills, commands, hooks |
| [memory.md](./memory.md) | Memory |
| [rag.md](./rag.md) | Knowledge base / RAG |
| [storage.md](./storage.md) | Storage backends & migration |
| [video-url-reader.md](./video-url-reader.md) | Video URL tool |
| [browser-agent.md](./browser-agent.md) | Desktop browser agent tools |
| [computer-use.md](./computer-use.md) | Desktop computer use |
| [integrations.md](./integrations.md) | Connectors |
| [openclaw-remote-setup.md](./openclaw-remote-setup.md) | OpenClaw remote |
| [system-notifications.md](./system-notifications.md) | Notifications |
| [token-estimation.md](./token-estimation.md) | Tokens |
| [testing.md](./testing.md) | Test conventions |
| [provider-usage-status.md](./provider-usage-status.md) | Provider status notes |

## Related

- Contributor entry: [AGENTS.md](../AGENTS.md)
- Architecture detail: [system-architecture.md](./system-architecture.md)
