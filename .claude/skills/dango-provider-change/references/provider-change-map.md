# Provider change map

## Required touchpoints (new provider)

| Piece | Path |
|-------|------|
| Enum | `src/shared/types/provider.ts` |
| Model class | `src/shared/providers/definitions/models/<provider>.ts` |
| Definition | `src/shared/providers/definitions/<provider>.ts` |
| Registration | `src/shared/providers/index.ts` side-effect import |
| Registry core | `src/shared/providers/registry.ts`, `types.ts` |
| Base models | `src/shared/models/abstract-ai-sdk.ts`, `openai-compatible.ts` |

## Optional touchpoints

| Piece | Path |
|-------|------|
| OAuth helpers | `src/shared/providers/oauth/` |
| Auth UI | `src/renderer/components/settings/*AuthSection.tsx` |
| Token refresh | `src/renderer/utils/*-auth-refresh.ts` (generation + model-tester) |
| Icons | `src/renderer/components/icons/ProviderIcon.tsx` |
| Settings route | `src/renderer/routes/settings/provider/` |
| Usage adapter | `src/renderer/packages/usage-tracking/adapters/` |
| Model tester | `src/renderer/utils/model-tester.ts` |

## createModel config fields

From registry: `settings`, `globalSettings`, `config`, `dependencies`, `providerSetting`, `formattedApiHost`, `formattedApiPath`, `model`.

## Capability values

| Capability | Meaning |
|------------|---------|
| `vision` | Image inputs |
| `tool_use` | Tools / function calling |
| `reasoning` | Thinking/reasoner models |

## Doc caution

- Prefer neighboring live definitions (`deepseek.ts`, `openai.ts`, `gemini.ts`) over prose guides.
- `docs/adding-provider.md` is legacy pre-registry.
- Package manager is **pnpm**, not npm.
