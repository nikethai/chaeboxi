# Validation matrix

## Change class → minimum gates

| Change class | Minimum evidence |
|--------------|------------------|
| Docs only | Source-check claims; no false “tests passed” |
| Pure shared TS | Targeted Vitest → `pnpm check` → `pnpm lint` |
| Renderer/React | Targeted test (jsdom if DOM) → check → lint |
| Route/build config | Targeted tests → `pnpm build:renderer` when sensitive |
| Provider | Registry/model/oauth tests → check → lint |
| Storage/migration | Migration + store tests; old/missing data cases |
| Platform capability | `capabilities.test.ts` + affected platform path |
| Rust/IPC | `cargo check` (+ fmt) + paired TS adapter/capability tests |
| Chat/tools/generation | Targeted model-calls/tools/hooks/session tests |
| Cross-platform claim | Explicit per-target matrix; never one-host inference |
| Mobile release | Host-specific Capacitor/Tauri Android tooling |
| Integration | `pnpm test:integration` only when environment ready |

## Tooling facts

| Gate | Command | Notes |
|------|---------|-------|
| Unit/integration | `pnpm test` / `pnpm test -- path` | Vitest; default node env |
| Integration long | `pnpm test:integration` | 300s timeout |
| Types | `pnpm check` | `tsc --noEmit` |
| Lint | `pnpm lint` | Biome |
| Format | `pnpm format` | Pre-commit formats staged TS/JS |
| Web build | `pnpm build:web` | |
| Renderer build | `pnpm build:renderer` | |
| Rust check | `cargo check --manifest-path src-tauri/Cargo.toml` | Not wrapped in package.json |
| CI | **None in-repo** | Do not claim CI green |

## Test placement

- Colocate: `foo.ts` + `foo.test.ts`
- Integration: `test/integration/`
- Prefer real pure-logic tests over heavy mocks (`src/shared` patterns)

## Handoff template

```markdown
## Verification
### Passed
- ...
### Failed
- ...
### Not run
- ...
### Unavailable
- ...
### Platforms
| Target | Affected | Evidence |
|--------|----------|----------|
| Desktop | | |
| Web | | |
| Mobile | | |
```
