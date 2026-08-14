# Chaeboxi — Project Overview & Product Development Requirements

| | |
| --- | --- |
| **Product** | Chaeboxi |
| **Version** | 1.7.0 |
| **License** | [GNU GPLv3](../LICENSE) |
| **Repo** | [github.com/nikethai/chaeboxi](https://github.com/nikethai/chaeboxi) |
| **Last updated** | 2026-08-11 |

## Vision

Chaeboxi is a **local-first, multi-platform AI copilot**. Users bring their own API keys (BYOK), keep chats and settings on-device, and use the same product surface on **Windows, macOS, Linux, web, iOS, and Android**.

It is an independent GPLv3 product (derived from an earlier open-source client; see [NOTICE](../NOTICE)). It is **not** a commercial SaaS client and does **not** sell a first-party hosted LLM subscription.

## Product principles

1. **Local-first** — conversation data and settings live on the user’s device (or platform storage they choose).
2. **BYOK only** — no bundled paid AI plan; users configure providers they already have (or run local models via Ollama / LM Studio).
3. **Independence** — first-party hosted cloud and paid-cloud upsell paths stay off:
   - `CHATBOX_CLOUD_ENABLED = false` (`src/shared/product.ts`)
   - `TELEMETRY_ENABLED = false` (analytics/Sentry off until Chaeboxi-owned accounts exist)
4. **Multi-platform from one codebase** — Tauri 2 desktop + React 18 / TypeScript renderer; web and mobile targets share the same frontend.
5. **English for product docs and default UI** — repository docs, code comments, and default product copy are English; optional UI locales remain for end-user preference; first-run language is English.

## Non-goals

- Not a rebranded third-party “AI license” marketplace client
- Not a first-party LLM subscription or hosted chat backend
- Not a multi-tenant SaaS control plane
- Not guaranteed parity of every native capability on web/mobile (desktop remains the richest shell: MCP stdio, keychain, tray, screenshots, etc.)

## Target platforms

| Target | Shell / notes |
| --- | --- |
| Windows, macOS, Linux | Tauri 2 desktop (primary) |
| Web | Vite web build (`CHATBOX_BUILD_PLATFORM=web`) |
| iOS, Android | Capacitor / mobile targets; Android capability set is reduced vs full desktop |

## Feature inventory

| Area | Summary | Feature doc |
| --- | --- | --- |
| **Providers** | 16+ LLM providers (OpenAI, Claude, Gemini, DeepSeek, Qwen, MiniMax, Moonshot, SiliconFlow, OpenRouter, Ollama, LM Studio, Azure, Groq, xAI, Mistral, Perplexity, VolcEngine, ChatGLM, OpenClaw, ComfyUI; legacy ChatboxAI path disabled) | [adding-provider.md](./adding-provider.md), [provider-usage-status.md](./provider-usage-status.md) |
| **Agents & multi-agent rooms** | Persona agents; rooms up to 3 members; Discuss / Work / Swarm modes | [agents-multi-agent-rooms.md](./agents-multi-agent-rooms.md) |
| **Skills / commands / hooks** | Extensible skill packs, slash commands, lifecycle hooks | [skills.md](./skills.md), [hooks-and-commands.md](./hooks-and-commands.md) |
| **MCP** | Model Context Protocol client (stdio on desktop, HTTP); IPC to Rust backend | (see [system-architecture.md](./system-architecture.md)) |
| **Memory** | Personal / session memory | [memory.md](./memory.md) |
| **Knowledge base / RAG** | Local document KB; desktop Rust path uses in-memory indexes + JSON chunk files + keyword search (not SQLite in Rust) | [rag.md](./rag.md) |
| **Video URL reader** | Public video URL tool (YouTube/Vimeo/TikTok/Facebook) — `read_video_url` | [video-url-reader.md](./video-url-reader.md) |
| **Browser agent** | Desktop isolated browser tools (`browser_*`) | [browser-agent.md](./browser-agent.md) |
| **Computer use** | Desktop screen observe/act (`computer_*`) | [computer-use.md](./computer-use.md) |
| **Web search** | Web search integration for agents/tools | (packages under `src/renderer/packages/web-search*`) |
| **OpenClaw** | Remote OpenClaw agent runtime over WebSocket | [openclaw-remote-setup.md](./openclaw-remote-setup.md) |
| **Integrations** | Connectors (e.g. Jira, Asana, Google Workspace, GitHub); secrets in OS keychain on desktop | [integrations.md](./integrations.md) |
| **System notifications** | Desktop / web notification surfaces | [system-notifications.md](./system-notifications.md) |
| **Storage** | Cross-platform StoreStorage with debounce; migrations | [storage.md](./storage.md) |

## Tech stack (summary)

| Layer | Stack |
| --- | --- |
| Desktop shell | Tauri 2, Rust (`src-tauri/`) |
| UI | React 18, TypeScript, TanStack Router, Mantine 7, Tailwind, Emotion (residual MUI) |
| State | Zustand (settings/UI), Jotai (fine-grained UI), React Query (sessions) |
| Models | Vercel AI SDK via `AbstractAISDKModel` / provider registry in `src/shared/` |
| Tooling | pnpm ≥ 10, Node 20–22, Biome 2.0, Vitest, Husky + lint-staged |
| Mobile | Capacitor 7 bridges |

See [system-architecture.md](./system-architecture.md) and [codebase-summary.md](./codebase-summary.md) for structure and data flow.

## Success criteria

- **Privacy default**: cloud and telemetry flags remain off unless product intentionally re-enables them with owned infrastructure.
- **Provider flexibility**: new providers fit the `defineProvider` + model class pattern without forking chat UI.
- **Desktop capability depth**: MCP, secrets, FS, shell integrations work through a single multiplexed IPC command.
- **Cross-platform UX**: core chat, settings, and sessions usable on desktop and web; mobile targets build from the same renderer.
- **Contributor clarity**: AGENTS.md + `docs/` keep architecture claims aligned with code (especially KB and cloud flags).

## Related documentation

| Doc | Purpose |
| --- | --- |
| [system-architecture.md](./system-architecture.md) | Layers, init flow, IPC, MCP, storage, security |
| [codebase-summary.md](./codebase-summary.md) | Repo layout, scale, package map |
| [code-standards.md](./code-standards.md) | Style, layering, testing, commits |
| [design-guidelines.md](./design-guidelines.md) | UI design system |
| [AGENTS.md](../AGENTS.md) | Contributor architecture entry (keep in sync with these docs when claims drift) |
| [README.md](../README.md) | Product identity, privacy, dev quickstart |

## PDR change log

| Date | Change |
| --- | --- |
| 2026-08-11 | Initial project overview / PDR from codebase scout |
