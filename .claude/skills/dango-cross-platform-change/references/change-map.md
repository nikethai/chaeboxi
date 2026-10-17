# Cross-platform change map

## Layer rules

```text
src/renderer  → may import → src/shared
src/shared    → must NOT import → src/renderer / DOM / Tauri
src-tauri     → no TS imports; IPC only
```

## Native path (paired edits)

| Step | Path |
|------|------|
| Contract | `src/renderer/platform/interfaces.ts` |
| Capability | `src/renderer/platform/capabilities.ts` (+ test) |
| Desktop | `src/renderer/platform/desktop_platform.ts` |
| Web / mobile | `src/renderer/platform/web_platform.ts` |
| Test | `src/renderer/platform/test_platform.ts` |
| IPC types | `src/shared/desktop-ipc-types.ts` |
| Adapter | `src/renderer/platform/tauri_ipc_adapter.ts` |
| Selection | `src/renderer/platform/index.ts` |
| Rust dispatch | `src-tauri/src/lib.rs` (`ipc_invoke`) |
| Shell extras | `src-tauri/src/desktop_shell.rs` |
| Capabilities ACL | `src-tauri/capabilities/` |

## Platform selection order

1. `NODE_ENV === 'test'` → `TestPlatform`
2. Desktop API / Tauri → `DesktopPlatform` (Android form factor when build is android)
3. Else → `WebPlatform`

## Commands

```bash
pnpm test -- src/renderer/platform/capabilities.test.ts
pnpm check
pnpm lint
cargo check --manifest-path src-tauri/Cargo.toml
pnpm dev:web          # web-only
pnpm build:renderer   # frontend build
pnpm build:web
```

## Security notes

- Desktop trust model is single-user local app (high privilege).
- Treat FS, `execute_command`, MCP stdio, browser/computer tools as high risk.
- Prefer least privilege for new channels.
