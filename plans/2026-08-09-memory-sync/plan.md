# Plan: Personal Memory Sync

**Status:** planned  
**Date:** 2026-08-09  
**Spec:** [`docs/superpowers/specs/2026-08-08-personal-memory-sync-design.md`](../../docs/superpowers/specs/2026-08-08-personal-memory-sync-design.md)

## Goal

Add encrypted multi-device sync for the existing long-term memory system without replacing the upstream memory architecture.

This plan assumes the current codebase already includes:

- global and agent memory banks
- auto-save and profile rebuild
- hybrid/always/on-demand inject modes
- host pre-search and memory tools
- Settings → Memory UI
- local-only persistence

The work in this plan is specifically to add:

1. schema-safe sync metadata
2. tombstone-based deletes
3. encrypted snapshot sync client
4. self-hosted server endpoint support
5. memory sync settings UI
6. merge/retry/bootstrap behavior

## Non-goals

- Rebuilding the memory feature
- Graph memory
- Mnemopi integration or backend replacement
- Knowledge-base sync/search
- Chaeboxi-hosted SaaS sync
- Reworking memory recall/ranking logic beyond what sync requires

## Product model

```text
Local memory system (existing)
  ├─ memory-settings
  ├─ memory-bank-global
  └─ memory:agent:{id}
           │
           ▼
Encrypted snapshot sync layer (new)
  ├─ serialize local settings + banks
  ├─ encrypt with passphrase-derived key
  ├─ push/pull via self-hosted sync server
  ├─ merge on conflict
  └─ rebuild local indexes through repository/store paths
```

## Delivery phases

### Phase 0 — Foundations and invariants

**Goal:** make the current memory model safe for sync.

**Deliver:**

- Extend `MemoryEntrySchema` with optional:
  - `revision`
  - `deleted`
- Extend `MemoryBankSchema` with optional:
  - `revision`
- Update normalize/clone flows so those fields survive round-trips
- Add helper utilities for:
  - incrementing entry revision
  - incrementing bank revision
  - tombstone TTL checks
- Add a clear sync-state type for remote revision and local sync bookkeeping

**Primary files:**

- `src/shared/types/memory.ts`
- `src/renderer/packages/memory/clone.ts`
- `src/renderer/packages/memory/bank-ops.ts`
- new `src/renderer/packages/memory/sync-types.ts` or equivalent

**Acceptance:**

- Memory entries keep `revision` and `deleted` after load/save cycles
- Memory banks keep `revision` after normalize/clone
- Existing local memory data still loads without migration failures

---

### Phase 1 — Delete semantics and agent-bank enumeration

**Goal:** make local state representable across devices.

**Deliver:**

- Replace hard-delete memory entry flow with tombstone behavior
- Keep tombstones in banks for 30 days before purge eligibility
- Ensure archived and deleted are treated differently:
  - `archived` = soft-hidden but still live memory state
  - `deleted` = sync tombstone
- Add storage/repository helper to enumerate all `memory:agent:*` banks
- Preserve inactive agent banks in snapshots

**Primary files:**

- `src/renderer/packages/memory/bank-ops.ts`
- `src/renderer/stores/memoryStore.ts`
- `src/renderer/packages/memory/repository.ts`
- `src/renderer/storage/StoreStorage.ts`
- maybe new storage helper in `src/renderer/packages/memory/persistence.ts`

**Acceptance:**

- Deleting a memory no longer removes it immediately from persisted bank data
- Agent bank snapshot builder can list all banks, not only loaded ones
- Existing recall/inject paths ignore deleted entries

---

### Phase 2 — Local memory sync state and crypto primitives

**Goal:** build the local client-side sync engine before wiring transport.

**Deliver:**

- Add separate local config for memory sync, likely under settings extension:
  - enabled
  - endpoint
  - token
  - autoSync
  - intervalSeconds
- Add separate local-only passphrase session handling and sync metadata:
  - salt
  - KDF metadata
  - remote revision
  - last sync time/error
- Implement snapshot serializer/deserializer for:
  - `MemorySettings`
  - global bank
  - agent banks
- Implement WebCrypto helpers:
  - PBKDF2-HMAC-SHA-256
  - AES-GCM encrypt/decrypt
- Implement flush-before-snapshot behavior using existing memory flush path

**Primary files:**

- `src/shared/types/settings.ts`
- `src/shared/defaults.ts`
- new `src/renderer/stores/memorySync.ts`
- new `src/renderer/packages/memory/snapshot.ts`
- new `src/renderer/packages/memory/crypto.ts`
- `src/renderer/packages/memory/persistence.ts`

**Acceptance:**

- A local snapshot can be serialized, encrypted, decrypted, and restored losslessly
- Passphrase is not persisted as plaintext
- Snapshot is built only after pending memory writes are flushed

---

### Phase 3 — Sync server extension

**Goal:** add a dedicated memory sync endpoint to the existing self-hosted server.

**Deliver:**

- Add storage table for encrypted memory snapshot state
- Add endpoints:
  - `GET /api/sync/memory`
  - `PUT /api/sync/memory`
- Reuse bearer auth and compare-and-swap revision pattern
- Return `409` with current remote state on revision mismatch
- Enforce request size limits and payload validation

**Primary files:**

- `scripts/history-sync-server/server.mjs`
- optionally `scripts/history-sync-server/README.md`

**Acceptance:**

- Server can store/retrieve encrypted memory payloads independently of chat history
- 409 conflict handling behaves like history sync
- No decrypted memory content is stored server-side

---

### Phase 4 — Merge engine and client transport

**Goal:** sync local memory state with remote encrypted state reliably.

**Deliver:**

- Implement `testMemorySyncConnection`
- Implement `pullMemoryFromServer`
- Implement `pushMemoryToServer`
- Implement `syncMemoryNow`
- Add sync lock to prevent concurrent memory sync races
- Add merge logic for:
  - settings: local wins in v1 conflicts
  - global bank entries
  - agent bank entries by `agentId`
  - tombstones
  - profile rebuild after entry merge
- Rebuild repository indexes after successful merge
- Persist sync state with last error / last synced timestamp / remote revision

**Primary files:**

- new `src/renderer/stores/memorySync.ts`
- new `src/renderer/packages/memory/merge.ts`
- `src/renderer/packages/memory/repository.ts`
- `src/renderer/stores/memoryStore.ts`

**Acceptance:**

- Two devices editing different entries converge after sync
- 409 conflict triggers pull → merge → retry flow
- Deleted entries propagate as tombstones
- Local memory remains usable when server is unavailable

---

### Phase 5 — UI and bootstrap integration

**Goal:** expose sync controls and integrate sync into app lifecycle.

**Deliver:**

- Add Memory Sync controls to Settings → Memory → Advanced or a sync subsection
- Add fields/actions:
  - enable
  - endpoint
  - token
  - passphrase
  - test connection
  - sync now
  - pull
  - push
  - reset remote memory
  - last sync/error status
- Show passphrase-loss warning during enable/setup
- Add memory sync bootstrap:
  - startup sync
  - debounced post-write sync
  - optional interval sync
- Keep bootstrap conservative on unsupported platforms if needed, following history-sync patterns

**Primary files:**

- `src/renderer/routes/settings/memory.tsx`
- `src/renderer/components/settings/memory/MemoryAdvancedPanel.tsx`
- maybe shared UI helpers from `src/renderer/routes/settings/general.tsx`
- new `src/renderer/setup/memory_sync.ts`
- `src/renderer/index.tsx`

**Acceptance:**

- User can configure and manually operate memory sync from the UI
- Clear warning is shown about unrecoverable passphrase loss
- Startup/manual sync updates status correctly

---

### Phase 6 — Tests and polish

**Goal:** make the feature safe to ship.

**Deliver:**

- Unit tests for:
  - schema round-trip with sync fields
  - tombstone behavior
  - merge tie-breakers
  - profile rebuild after merge
  - encryption/decryption roundtrip
  - corrupt payload handling
- Integration tests for:
  - mock memory sync server GET/PUT
  - push/pull cycle
  - 409 retry flow
  - disabled sync does not call server
  - agent bank snapshot enumeration
- Manual QA checklist across two devices
- Update docs for self-hosted memory sync setup

**Primary files:**

- new `src/renderer/stores/memorySync.test.ts`
- new `src/renderer/packages/memory/merge.test.ts`
- new `src/renderer/packages/memory/crypto.test.ts`
- updates to server test coverage if present
- `scripts/history-sync-server/README.md`

**Acceptance:**

- Critical merge/encryption paths are covered by tests
- Manual QA confirms multi-device convergence
- Docs explain setup and passphrase consequences

## Technical decisions

### 1. Snapshot sync vs per-record sync
Use **encrypted full snapshot sync** for v1.

Why:
- simpler server shape
- matches current history-sync pattern
- easier to ship with encrypted payloads
- good enough for current memory sizes

Defer per-record/incremental sync to later.

### 2. Credentials placement
Do **not** put endpoint/token/passphrase into `MemorySettings`.

Why:
- `MemorySettings` is part of synced user memory behavior
- credentials are device-local configuration
- sync config should mirror `extension.historySync`

### 3. Delete behavior
Recommended v1: **always tombstone** for memory entry removal, then purge later.

Why:
- simpler and more predictable across devices
- avoids special-case semantics when sync is disabled vs enabled

### 4. Profile handling
Do not treat profile summary as canonical.

Why:
- entries are the source of truth
- profile is derived and should be rebuilt after merge

### 5. Graph memory
Explicitly out of scope.

### 6. Mnemopi
Use as reference only, not as runtime dependency or replacement.

## Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Sync fields get stripped by normalization | Update Zod schemas first and test round-trips |
| Snapshot misses pending writes | Always call `flushPersistence()` before snapshot |
| Agent banks are lost | Add `memory:agent:*` enumeration helper |
| Deletes do not converge | Use tombstones with TTL |
| In-memory recall indexes go stale | Route merge results through repository/store save paths |
| Passphrase loss causes bad UX | Explicit warning, no-recovery policy, reset-remote action |
| Snapshot size grows | Enforce server max body, surface pruning/archive guidance |
| Settings conflict confusion | Local-wins v1 with explicit pull/reset actions |

## Suggested task breakdown

1. Schema + normalize preservation
2. Tombstone delete + purge rules
3. Agent bank enumeration
4. Snapshot + crypto helpers
5. Memory sync store/client
6. Server `/api/sync/memory`
7. Memory sync UI
8. Bootstrap/autosync
9. Tests + docs

## Success criteria

- Existing memory behavior remains intact for local-only users
- Two devices can share encrypted memory state through self-hosted sync
- Conflicting edits converge deterministically
- Deleted memories propagate across devices
- Server never stores plaintext memory content
- Passphrase loss behavior is clearly communicated

## Next actions

1. Implement Phase 0 and Phase 1 first in one branch
2. Add failing tests for schema round-trip and tombstone merge before transport work
3. Build the client snapshot/crypto path before server changes are finalized
4. Add server endpoint and end-to-end sync tests
5. Finish with UI/bootstrap wiring and manual QA
