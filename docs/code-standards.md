# Code Standards

| | |
| --- | --- |
| **Product** | Chaeboxi 1.6.0 |
| **Last updated** | 2026-08-11 |

Standards for contributors editing TypeScript, Rust (Tauri), tests, and docs. Prefer existing patterns over new abstractions (YAGNI, KISS, DRY — in that order).

## Tooling & environment

| Requirement | Value |
| --- | --- |
| Node | **20.x–22.x** (`package.json` engines) |
| Package manager | **pnpm ≥ 10** |
| Formatter / linter | **Biome 2.0** (`biome.json`) |
| Types | `pnpm check` (`tsc --noEmit`) |
| Tests | Vitest (`pnpm test`, `pnpm test:integration`) |
| Pre-commit | Husky + lint-staged → `biome format --write` on staged `.{js,jsx,ts,tsx}` |

### Biome style

- 2-space indent
- Single quotes
- Semicolons **as needed** (typically none)
- ES5 trailing commas
- 120-character line width
- LF line endings

```bash
pnpm lint
pnpm lint:fix
pnpm format
pnpm check
pnpm test
```

GitHub Actions runs quality gates on PR/`main` (`.github/workflows/ci.yml`). Local `pnpm lint` / `check` / `test` remain the day-to-day loop. Desktop installers ship via `.github/workflows/release.yml` (see [deployment-guide.md](./deployment-guide.md)).

## Language policy

- **English** for repository docs, code comments, commit messages, and default product copy.
- Optional UI locales may exist for end users; first-run / default language remains English.

## Naming

| Kind | Convention | Examples |
| --- | --- | --- |
| React components / pages | `PascalCase.tsx` | `SessionList.tsx` |
| Utilities, stores, hooks modules | `camelCase.ts` | `settingsStore.ts` |
| New multi-word files (when no stronger local convention) | descriptive **kebab-case** | `system-notifications-web.ts` |
| Domain barrels | `index.ts` | package `index.ts` exports |
| Storage / IPC string keys | as defined in enums / channel tables | `StorageKey`, `mcp:server:call-tool` |

## Path aliases

Defined in `tsconfig.json`, mirrored in Vite and Vitest configs:

| Alias | Maps to |
| --- | --- |
| `@/*` | `src/renderer/*` |
| `@shared/*` | `src/shared/*` |

Use aliases consistently; avoid deep relative climbs across layer boundaries.

## Three-layer architecture rules

```text
src/renderer  →  may import  →  src/shared
src/shared    →  must NOT import  →  src/renderer
src-tauri     →  no TS imports; IPC only
```

1. **Shared stays pure** — no React, no DOM, no Tauri globals in `src/shared`. Platform behavior enters via **`ModelDependencies`** / adapter types (`src/shared/types/adapters.ts`).
2. **Renderer owns UI and platform** — all native capability goes through `src/renderer/platform` (`DesktopPlatform` / `WebPlatform` / `TestPlatform`).
3. **Rust owns privileged desktop ops** — store, secrets, MCP, KB search, FS, OpenClaw WS, shell. Renderer talks via multiplexed `ipc_invoke`.
4. **Prefer injection over static platform reach** in model/provider code so tests can use `TestPlatform`.

## State management — when to use which

| System | Use for |
| --- | --- |
| **Zustand** (`settingsStore`, `uiStore`, etc.) | Persisted application settings and durable UI prefs; immer + subscribeWithSelector patterns already in tree |
| **React Query** (`chatStore` / session queries) | Session list and session document cache; `fetchQuery` / `useQuery` |
| **Jotai** (`stores/atoms/`) | Fine-grained ephemeral UI reactivity (selection, local session UI atoms) |

Do not introduce a fourth global state library. Keep session writes on the established storage + query invalidation paths.

## Provider extension pattern

To add an LLM provider:

1. Add enum value in `src/shared/types/provider.ts` if new.
2. Implement model class under `src/shared/providers/definitions/models/` (usually extend `AbstractAISDKModel` / OpenAI-compatible base).
3. `defineProvider({ id, name, type, createModel, defaultSettings })` in `src/shared/providers/definitions/`.
4. Register export/import in `src/shared/providers/definitions/index.ts` (side-effect registration).
5. Add settings UI under `src/renderer/routes/settings/provider/`.

Details: [adding-provider.md](./adding-provider.md), [adding-new-provider.md](./adding-new-provider.md).

## Testing conventions

- **Colocate** unit tests: `foo.ts` + `foo.test.ts`.
- Integration tests live under `test/integration/` (long timeouts).
- Use Vitest; path aliases work in tests.
- Prefer real behavior over mocks when the unit is pure (`src/shared` agent-room / swarm-plan tests are good models).
- Do not hide failing tests, type errors, or lint failures.
- Narrowest useful test first; broaden when public contracts change.

See [testing.md](./testing.md).

## Commits

Conventional Commits, no AI co-author noise:

```text
feat(chat): add streaming cancel
fix(mcp): handle tool list timeout
build: bump tauri deps
```

- Optional scope: `feat(chat): …`
- Do **not** commit secrets, dotenv files, tokens, private keys, or personal data.
- Prefer focused commits over mixed feature/refactor dumps.

## Security

| Rule | Detail |
| --- | --- |
| No secrets in git | API keys, OAuth tokens, keychain material stay local |
| Integrations secrets | Desktop: OS keychain via `secrets:*` IPC; never put tokens in plain settings blobs when keychain path exists |
| Agent tools | Treat tools as high risk; respect tool access flags, agent mode, and user approval UX |
| Cloud flags | Do not re-enable `CHATBOX_CLOUD_ENABLED` / `TELEMETRY_ENABLED` without explicit product decision and owned infrastructure |
| Desktop trust | Local app has high privileges (FS, command exec, MCP stdio); prefer least privilege in new channels |

## Modularization

- Prefer editing existing modules that own the concern.
- When a **code** file exceeds ~**200 LOC** and has clear separation boundaries, split into descriptive kebab-case modules.
- Do **not** modularize for its own sake: Markdown, plain config, env samples, and simple scripts can stay long if clearer that way.
- Keep public contracts stable unless the change intentionally updates them.

## Documentation

- User-visible behavior, architecture, setup, or public contracts → update the relevant `docs/` file (and AGENTS.md if architecture claims change).
- Feature-specific docs already exist for agents, skills, memory, RAG, storage, video URL, integrations, OpenClaw, notifications — **extend those** rather than duplicating.
- Core docs: [project-overview-pdr.md](./project-overview-pdr.md), [system-architecture.md](./system-architecture.md), [codebase-summary.md](./codebase-summary.md).

## Related

- [AGENTS.md](../AGENTS.md) — architecture overview for agents/contributors
- [system-architecture.md](./system-architecture.md) — runtime structure
