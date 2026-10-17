# Storage change map

## Core paths

| Concern | Path |
|---------|------|
| Keys / debounce | `src/renderer/storage/StoreStorage.ts` |
| Platform write facade | `src/renderer/storage/BaseStorage.ts` |
| Storage singleton | `src/renderer/storage/index.ts` |
| Startup migrate | `src/renderer/stores/migration.ts` |
| Migration tests | `src/renderer/stores/migration.test.ts` |
| Desktop file vs IDB | `src/renderer/platform/desktop_platform.ts` (`needStoreInFile`) |
| Legacy backends | `src/renderer/platform/storages.ts` |
| Settings schema | `src/shared/types/settings.ts` + `settingsStore.ts` |
| Session schema | `src/shared/types/session.ts` |
| Init order | `src/renderer/index.tsx` |

## StorageKey highlights

| Key | Role |
|-----|------|
| `settings` / `configs` / `configVersion` | Startup-critical |
| `chat-sessions-list` | Session index (desktop file) |
| `session:{id}` | Session document (desktop file) |
| `session:{id}:tasks` | Session task checklist |
| `skills` / `commands` / `hookOverrides` | Extensibility overrides |
| `memory-settings` / `memory-bank-global` / `memory:agent:*` | Memory |
| `integrations` | Connector metadata only (not secrets) |
| `usage-*` | Usage rollup / quota cache |

## Desktop `needStoreInFile` (source)

```text
configs | settings | configVersion | chat-sessions-list | session:*
```

Everything else on desktop uses IndexedDB via localforage-style store.

## Write semantics (`StoreStorage`)

**Immediate** (`setItemNow`): Settings, Configs, ConfigVersion, MemorySettings, MemoryBankGlobal, UsageBudgetNotify, Integrations, keys starting `memory:agent:`.

**Debounced** (`setItem`): other keys — 500ms debounce, maxWait 2000ms.

## Doc drift warning

`docs/storage.md` may still say desktop sessions use IndexedDB. **Current code** stores sessions + list in the Tauri file store for multi-window sync. Trust `desktop_platform.ts`.
