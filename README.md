# Chaeboxi

**Chaeboxi** is a multi-platform AI copilot for desktop, web, and mobile. Use your own API keys with OpenAI, Anthropic, Gemini, Ollama, OpenRouter, Azure, and many more providers.

Built with **Tauri 2 + React 18 + TypeScript**.

| | |
| --- | --- |
| **License** | [GNU GPLv3](./LICENSE) |
| **Repo** | [github.com/nikethai/chaeboxi](https://github.com/nikethai/chaeboxi) |
| **Default language** | English |
| **Cloud upsell** | None — BYOK only |


<img width="1793" height="1036" alt="Screenshot 2026-08-10 at 21 06 15" src="https://github.com/user-attachments/assets/f99113c0-b171-4772-9dba-b6ff34bf6e5a" />


## Download

Desktop builds: [GitHub Releases](https://github.com/nikethai/chaeboxi/releases).

## Features

- **Local-first** — chats and settings stay on your device
- **Bring your own keys** — no bundled paid AI subscription
- **16+ providers** — OpenAI, Anthropic, Gemini, Ollama, OpenRouter, and more
- **Agents & tools** — multi-agent rooms, skills, hooks, MCP, public video URL reader
- **Memory & RAG** — knowledge base and session memory
- **Cross-platform** — Windows, macOS, Linux, web, iOS, Android targets

## What Chaeboxi is not

- Not a rebranded commercial SaaS client
- Not affiliated with any third-party “AI license” marketplace
- Does **not** include or sell a first-party hosted LLM subscription

Use providers you already have (or run Ollama locally).

## Privacy

- Conversation data is stored on-device (or platform storage you choose)
- API keys you enter are used only to call the providers you configure
- First-party analytics/Sentry stay **off** until you configure Chaeboxi-owned accounts
- Legal pages will move to the Chaeboxi domain when it is ready; until then see [Privacy](#privacy-placeholder) and [Terms](#terms-placeholder) below

### Privacy (placeholder)

Chaeboxi is open source under GPLv3. We do not sell your chats. Third-party providers process prompts according to **their** terms when you use your keys.

### Terms (placeholder)

Software is provided under the [GNU GPLv3](./LICENSE). Use at your own risk. You are responsible for compliance with each provider’s API terms.

## Development

Requirements: **Node 20.x–22.x**, **pnpm** ≥ 10.

```bash
pnpm install

# Desktop (Tauri)
pnpm dev

# Web only
pnpm dev:web

# Quality
pnpm test
pnpm check
pnpm lint
```

More detail for contributors: [AGENTS.md](./AGENTS.md).

## Attribution (license)

Chaeboxi is an independent project. Parts of the codebase are derived from an earlier open-source GPLv3 desktop client ([upstream source](https://github.com/chatboxai/chatbox)).

- Full license: [LICENSE](./LICENSE)
- Copyright / origin notice: [NOTICE](./NOTICE)

Upstream authors retain copyright in their contributions. Chaeboxi modifications are also GPLv3.

## License

[GNU General Public License v3.0](./LICENSE)
