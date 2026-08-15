## Project Overview

Chaeboxi is a multi-platform AI copilot (desktop/web/mobile) supporting 16+ LLM providers. Built with **Tauri 2 + React 18 + TypeScript**, it targets Windows, macOS, Linux, iOS, Android, and Web from a single codebase.

**Independence note**: Chaeboxi is an independent GPLv3 product (derived from an earlier open-source client; see `NOTICE`). Hosted third-party cloud is disabled (`CHATBOX_CLOUD_ENABLED`). Settings still strip legacy paid-cloud keys via `stripChatboxPaidFeatures()` for migration stability.

**Language policy**: Repository docs, code comments, and default product copy are **English**. Optional UI locales (including Chinese) remain for end-user preference, but first-run language is always English.

## Build & Development Commands

```bash
# Install dependencies (pnpm required, Node 20.x-22.x)
pnpm install

# Development
pnpm dev                # Tauri desktop dev (hot reload)
pnpm dev:web            # Web-only dev mode (no Tauri/Rust needed)
pnpm start:renderer     # Vite dev server only (port 1212)

# Build
pnpm build              # Production Tauri build
pnpm build:renderer     # Frontend only
pnpm build:web          # Web version

# Testing
pnpm test                                    # All tests (vitest run)
pnpm test:watch                              # Watch mode
pnpm test -- src/path/to/file.test.ts        # Single test file
pnpm test:integration                        # Integration tests (300s timeout)
pnpm test:coverage                           # Coverage report

# Code Quality
pnpm lint               # Biome linter
pnpm lint:fix           # Auto-fix lint issues
pnpm format             # Biome format
pnpm check              # TypeScript type-check (tsc --noEmit)
```

## Code Style

- **Formatter/Linter**: Biome 2.0 (`biome.json`) — 2-space indent, single quotes, no semicolons, 120-char lines, ES5 trailing commas
- Components/pages: `PascalCase.tsx`; utilities/stores: `camelCase.ts`
- Domain folders expose `index.ts` barrel files
- Pre-commit hook (Husky + lint-staged) runs `biome format --write` on staged `.{js,jsx,ts,tsx}` files
- Commit style: `feat:`, `fix:`, `chore:`, `build:` with optional scope, e.g. `feat(chat): add streaming`

## Path Aliases

Defined in `tsconfig.json`, mirrored in `vite.renderer.config.mts` and `vitest.config.mts`:
- `@/*` → `src/renderer/*`
- `@shared/*` → `src/shared/*`

## Architecture

### Three-Layer Structure

```
src/renderer/     # React frontend (UI, state, routing)
src/shared/       # Cross-process types, model/provider logic, utilities
src-tauri/        # Tauri/Rust backend (native APIs, MCP client, IPC)
```

### Frontend (`src/renderer/`)

**Routing**: TanStack Router with auto code-splitting. Routes in `src/renderer/routes/`, route tree auto-generated to `routeTree.gen.ts`. Uses hash history for desktop/mobile, browser history for web (see `router.tsx`).

**State Management** — three complementary systems:
- **Jotai** (atoms in `stores/atoms/`) — fine-grained reactive state for UI (session atoms, settings atoms, UI atoms)
- **Zustand** (`stores/settingsStore.ts`, `stores/uiStore.ts`) — persisted application settings with `immer` middleware and `subscribeWithSelector`
- **React Query** (`stores/chatStore.ts`) — session list and session data caching with `queryClient.fetchQuery` / `useQuery`

**Modals**: `@ebay/nice-modal-react` for declarative modal management. Modals registered in `src/renderer/modals/`.

**Key packages** (`src/renderer/packages/`):
- `model-calls/` — LLM API wrapper layer (sends requests to providers); toolsets under `model-calls/toolsets/`
- `model-context/` — Conversation context assembly
- `mcp/` — MCP client integration (IPC-based transport to Rust backend)
- `token-estimation/` — Token counting for context management
- `context-management/` — Context window management
- `web-search/` — Web search integration
- `video-url/` — Public video URL reader (YouTube/Vimeo/TikTok/Facebook); agent tool `read_video_url` — see `docs/video-url-reader.md`
- `tools/` — Tool execution framework
- `model-setting-utils/` — Provider settings helpers

**UI Stack**: Mantine 7 + Tailwind CSS + Emotion + some MUI components (legacy). Icons from Lucide React and Tabler Icons.

**Storage Layer** (`src/renderer/storage/`): `StoreStorage` wraps a `BaseStorage` with debounced writes for non-critical keys (sessions) and immediate writes for startup-critical keys (Settings, Configs). Storage keys defined in `StorageKey` enum. Key generators in `StorageKeyGenerator` produce namespaced keys like `session:{id}`, `file:{sessionId}:{msgId}:{uuid}`.

### Platform Abstraction (`src/renderer/platform/`)

Runtime platform detection in `platform/index.ts`: selects `DesktopPlatform` (Tauri IPC), `WebPlatform`, or `TestPlatform` based on environment. The `Platform` interface (`interfaces.ts`) defines the cross-platform contract for storage, system APIs, blob storage, knowledge base, and export capabilities. All platform-dependent code goes through this abstraction.

### Shared Layer (`src/shared/`)

**Provider Registry** (`providers/registry.ts`): `defineProvider()` registers providers into a `Map<string, ProviderDefinition>`. Each definition includes `id`, `name`, `type`, `createModel` factory, and `defaultSettings`. Provider definitions live in `providers/definitions/` with model classes in `providers/definitions/models/`.

**Model Abstraction** (`models/`): `ModelInterface` defines `chat()`, `paint()`, and capability checks (`isSupportVision`, `isSupportToolUse`). `abstract-ai-sdk.ts` is the base class using Vercel AI SDK's `streamText()` with exponential backoff retry (5 attempts). `openai-compatible.ts` extends it for OpenAI-compatible providers.

**Type System** (`types/`): Types are split across files to prevent circular deps:
- `types/provider.ts` — `ModelProviderEnum`, `ModelProviderType` enums
- `types/session.ts` — `Session`, `Message`, `SessionThread` with Zod schemas
- `types/settings.ts` — `Settings`, `ProviderSettings`, `SessionSettings` with Zod schemas
- `types/adapters.ts` — `ModelDependencies` platform bridge
- `types.ts` — Re-exports and utility types

**Zod Validation**: Settings and session types use Zod schemas (`SettingsSchema`, `SessionSettingsSchema`, `ProviderSettingsSchema`) for runtime validation with `.catch()` fallbacks for backward compatibility during migrations.

### Backend (`src-tauri/src/`)

`lib.rs` is the Tauri IPC multiplexer. Feature modules live beside it (`desktop_shell.rs`, `kb/`, …):
- **MCP Client**: `rmcp` crate for stdio and HTTP transports. Connect-per-operation tool list / invoke.
- **Knowledge Base (desktop v1)**: `src-tauri/src/kb/` — SQLite `chaeboxi_kb.db`, overlapping chunks, local `multilingual-e5-small` (download-once ONNX, not bundled), hybrid keyword + cosine + RRF search. Mobile stays keyword/in-memory. **Not** Mastra / `@mastra/rag`.
- **Process Management**: Child process spawning for MCP stdio servers
- **IPC Bridge**: `window.desktopAPI` adapter created by `tauri_ipc_adapter.ts`

### Build Variants

Controlled by environment variables defined in `vite.renderer.config.mts`:
- `CHATBOX_BUILD_PLATFORM` — `web`, `ios`, `android`, or `unknown` (desktop)
- `CHATBOX_BUILD_TARGET` — `mobile_app` or `unknown`
- `USE_LOCAL_API` — connects to local API in development

### Initialization Flow

`src/renderer/index.tsx` orchestrates startup:
1. Sentry + global error handlers + GA4 init (via `setup/` modules)
2. Data migration (`stores/migration.ts`)
3. Settings store + last-used model store init → i18n language set
4. React render: ErrorBoundary → QueryClientProvider → RouterProvider
5. MCP bootstrap + history sync (non-blocking, via dynamic imports)

### Adding a New LLM Provider

1. Create definition in `src/shared/providers/definitions/your-provider.ts`
2. Create model class in `src/shared/providers/definitions/models/your-provider.ts` extending `AbstractAISDKModel`
3. Use `defineProvider()` with id (from `ModelProviderEnum`), name, type, `createModel` factory
4. Export and register in `src/shared/providers/definitions/index.ts`
5. Add provider enum value in `src/shared/types/provider.ts` if new
6. Add UI settings page in `src/renderer/routes/settings/provider/`

### Testing

- Vitest with Node environment, globals enabled, 10s default timeout
- Test files: `*.test.ts` / `*.test.tsx` colocated with source or in `test/integration/`
- Integration tests have 300s timeout; file/model-provider subtests have 120s timeout
- Path aliases (`@/`, `@shared/`) work in tests via `vitest.config.mts`
- Console output suppressed in tests (`silent: true`)
- Desktop KB / RAG: `cargo test --lib kb::` in `src-tauri` (or `cargo test --manifest-path src-tauri/kb-tests/Cargo.toml` without GTK)

### Mobile

Capacitor 7 bridges for iOS and Android. Build with `pnpm mobile:ios` or `pnpm mobile:android`. Platform detection in `src/renderer/platform/`. Safe area handling for iOS notch screens loaded conditionally.
