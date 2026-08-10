# Storage Architecture

Cross-platform storage and version migration for Chaeboxi (cross-platform storage patterns).

## Storage backends

- **DESKTOP_FILE**: Desktop file storage (via IPC)
- **INDEXEDDB**: IndexedDB (via localforage)
- **LOCAL_STORAGE**: localStorage (deprecated)
- **MOBILE_SQLITE**: SQLite (via Capacitor)

### Current scheme (v1.17.0+)

| Platform | Settings / Configs | Sessions | Notes |
|----------|--------------------|----------|-------|
| **Desktop** | File storage | IndexedDB | Settings easy to back up; sessions need capacity |
| **Mobile** | SQLite | SQLite | Unified store, better performance |
| **Web** | IndexedDB | IndexedDB | Large async storage |

## Version history (summary)

| Version | Config version | Desktop | Mobile | Main change |
|---------|----------------|---------|--------|-------------|
| v1.9.8–v1.9.10 | 0–5 | All file | localStorage | Initial |
| v1.9.11 | 6–7 | — | → SQLite | Mobile capacity |
| v1.12.0 | 7–8 | — | — | sessions → session-list format |
| v1.13.1 | 9–10 | — | — | Provider / session settings refactor |
| v1.16.1 | 11–12 | Sessions → IndexedDB | → IndexedDB | Split desktop storage |
| **v1.17.0** | **12–13** | Sessions IndexedDB, configs file | → SQLite | Mobile performance |

### Historical facts

- Desktop `configVersion` / `settings` / `configs` were **never** stored in IndexedDB.
- From v1.16.1, desktop only moved **sessions** to IndexedDB.
- Desktop storage strategy did not change from v1.16.1 → v1.17.0.
- Mobile path: localStorage → SQLite → IndexedDB → SQLite.

## Migration

Migrations run on startup via `src/renderer/stores/migration.ts`. Always preserve user data; never rename storage DB names without a data migration plan.

See also: `src/renderer/storage/`, `AGENTS.md`.
