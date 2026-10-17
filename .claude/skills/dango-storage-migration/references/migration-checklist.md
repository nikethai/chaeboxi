# Migration checklist

## When a migration step is required

- Shape of persisted settings/session objects changes incompatibly
- Storage key renamed or split
- Data moves between backends (file ↔ IDB, legacy mobile stores)
- Default data must be rewritten for existing installs

Not every new optional Zod field needs a migration if `.optional()` / `.catch()` accepts old payloads.

## Step pattern

1. Read `CurrentVersion` in `src/renderer/stores/migration.ts` (source of truth; do not hardcode from docs).
2. Implement `migrate_N_to_N+1(dataStore: MigrateStore)`.
3. Register function at index `N` in `migrateFunctions` array.
4. Set `CurrentVersion` to `N+1`.
5. Use `dataStore.getData` / `setData` (backed by `setItemNow` in production migrate path).
6. Prefer transform-in-place; write new keys before removing old.
7. Log progress; return `true` only if relaunch required.
8. Add/extend tests in `migration.test.ts` covering:
   - already at latest version (no-op)
   - from version N with representative old payload
   - missing/null fields
   - partial/interrupted where feasible

## Runtime order

```text
migrateStorage()   // backend/legacy store copy if needed
migrateOnData()    // versioned semantic steps 0→CurrentVersion
settings hydrate
React render
```

## Commands

```bash
pnpm test -- src/renderer/stores/migration.test.ts
pnpm check
pnpm lint
```

## Multi-window / cache

- Desktop main + quick chat share file-backed session keys.
- Window-local React Query still needs invalidation/broadcast after structural session changes.
- Do not assume IDB alone syncs windows.

## Secrets

- Never put integration OAuth tokens into `StorageKey.Settings` or `Integrations` metadata blobs when keychain/`secrets:*` exists.
- Redact storage dumps in reports.
