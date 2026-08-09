# Personal Memory Sync Design

Date: 2026-08-09
Status: Draft, updated after latest codebase audit on rebased `main` including `origin/main`
Scope: Sync for the upstream long-term memory bank; knowledge-base sync/search is deferred

## 1. Goal

Add multi-machine synchronization for the long-term memory system introduced in upstream commit `aa27f813` (`feat(memory): add long-term memory with scale-ready recall`, merged into `origin/main` via PR #28). The codebase audit confirmed the memory system is complete and local-only, and no memory sync code exists yet.

That system already provides:

- global memory bank and per-agent memory banks
- user/auto/tool memory entries
- pinned entries
- soft-archive entries
- profile summary and optional profile slots
- memory settings: retrieval mode, budgets, auto-save, host pre-search, semantic fusion
- memory injection into model system prompts
- Settings → Memory UI and message-level Save to memory

This design does **not** replace that memory system. It adds:

1. Encrypted sync of memory settings and banks across devices using the existing self-hosted sync-server direction.
2. A small upgrade to entry metadata so merge and tombstone behavior can work safely.
3. A conflict/merge policy that keeps local memory usable offline.

Knowledge-base central storage/search remains deferred.

## 2. Non-Goals

- Replacing or redesigning the upstream memory bank.
- Adding new retrieval modes, recall algorithms, or prompt injection logic beyond what upstream already has.
- Automatic memory extraction improvements.
- Mnemopi-style graph memory.
- Semantic memory retrieval improvements.
- Centralized knowledge-base storage or server-side KB search.
- Chaeboxi-hosted SaaS account sync.

## 3. Relationship To Upstream Memory Commit

The upstream memory system uses these storage keys:

- `memory-settings`
- `memory-bank-global`
- `memory:agent:{agentId}`

And these types:

```ts
MemorySettings
MemoryBank
MemoryEntry
```

Sync v1 treats those local keys as the source of truth on each device and adds a separate encrypted remote memory sync domain. The remote domain stores a normalized snapshot of:

```ts
type MemorySyncSnapshot = {
  schemaVersion: number
  settings: MemorySettings
  globalBank: MemoryBank
  agentBanks: AgentBankRecord[]
}

type AgentBankRecord = {
  agentId: string
  bank: MemoryBank
}
```

The server stores only an opaque encrypted payload plus revision metadata.

Important audit finding: the current app has no API for listing agent banks. Sync snapshot creation must introduce a helper that enumerates `memory:agent:*` storage keys so inactive-agent banks are not lost.

## 4. Required Memory Model Upgrade

The upstream `MemoryEntry` needs small additive fields for sync:

```ts
type MemoryEntry = {
  id: string
  content: string
  tags: string[]
  scope: 'global' | 'agent'
  agentId?: string
  source: 'user' | 'auto' | 'tool' | 'migrated'
  sourceSessionId?: string
  sourceMessageId?: string
  enabled: boolean
  pinned: boolean
  createdAt: number
  updatedAt: number
  lastAccessedAt?: number
  archived?: boolean

  // sync additions
  revision?: number
  deleted?: boolean
}
```

`MemoryBank` also gains a bank-level revision:

```ts
type MemoryBank = {
  scope: 'global' | 'agent'
  agentId?: string
  entries: MemoryEntry[]
  profileSummary: string
  profileUpdatedAt?: number
  profileSlots?: MemoryProfileSlots
  version: number

  // sync addition
  revision?: number
}
```

Rules:

- Existing local entries without `revision` are treated as `revision = 0`.
- Any local retain/update/delete increments both entry `revision` and bank `revision`.
- `deleted: true` marks a tombstone.
- Tombstones remain in banks for 30 days after `updatedAt`, then may be purged during local or sync normalization.
- `archived` remains an upstream local/quality feature and is synced as part of the entry.

### 4.1 Zod Persistence Constraint

The audit found that upstream persistence normalizes banks through Zod schemas in `normalizeBank` / `normalizeSettings`. Because the current schemas are bare `z.object()` types, unknown fields are stripped on every read/write cycle.

Therefore, sync fields must be added to the Zod schemas themselves:

- `MemoryEntrySchema` must include optional `revision` and `deleted`.
- `MemoryBankSchema` must include optional `revision`.
- Sync credentials must **not** be added to `MemorySettingsSchema`. They belong in a separate local sync config, similar to `extension.historySync`.

### 4.2 Write-Path Constraint

The audit found that most bank writes are coalesced through a 200 ms pending-write queue. Sync must call the existing memory flush path before building a snapshot. Push operations must use the store/repository save paths so in-memory recall indexes are rebuilt; they must not bypass them by writing storage directly.

### 4.3 Agent Bank Enumeration

Upstream code has no `listAgentBankIds()` API. Sync snapshot creation must add an enumeration helper over `memory:agent:*` storage keys, including inactive agents.

### 4.4 Delete Semantics

Upstream `remove()` currently hard-deletes entries. For sync, delete must become a tombstone write through the same entry update path. Hard purge happens only after tombstone TTL or explicit local clear/reset.

## 5. User-Facing Behavior

### 5.1 Sync Settings

Add a Memory Sync section under Settings → Memory → Advanced, or a separate Memory Sync subsection:

- Enable memory sync.
- Sync server endpoint (default: reuse history sync endpoint).
- Sync token (default: reuse history sync token if the user wants one combined credential; allow override).
- Sync passphrase input/generation.
- Test connection.
- Sync now.
- Pull from server.
- Push to server.
- Show last sync time and last error.

Default: memory sync disabled.

### 5.2 Warning UX

When enabling memory sync, show:

- Memory data is encrypted before leaving the device.
- The sync server cannot read memory content.
- The passphrase cannot be recovered.
- Losing the passphrase makes remote synced memories unrecoverable on other devices.
- Local memories remain usable on the current device.

### 5.3 No Change To Core Memory UX

The upstream Memory UI remains the management surface:

- Global bank
- Agent banks
- Advanced settings
- Entry add/edit/pin/disable/archive/delete
- Export/import bank JSON

Sync only adds remote state reconciliation.

## 6. Sync Architecture

### 6.1 Server Endpoint

Extend `scripts/history-sync-server` with memory endpoints:

- `GET /api/sync/memory`
- `PUT /api/sync/memory`

Behavior mirrors the existing history endpoint:

- bearer token required
- JSON body only
- revision compare-and-swap
- 409 with current remote snapshot on revision mismatch
- max body size enforced

The server stores:

```ts
type RemoteMemoryState = {
  revision: number
  payload: string       // encrypted base64 payload
  alg: string           // encryption algorithm identifier
  kdf: string           // KDF identifier
  salt: string          // base64 KDF salt
  updatedAt: string
}
```

The server never receives decrypted memory content.

### 6.2 Encryption

Client-side encryption before upload:

1. User enables memory sync and provides a passphrase.
2. Client generates a random salt.
3. Client derives a key with PBKDF2-HMAC-SHA-256 via WebCrypto, minimum 310,000 iterations.
4. Client serializes `MemorySyncSnapshot` to canonical JSON.
5. Client encrypts with AES-GCM using a fresh random IV.
6. Client uploads base64 payload, algorithm metadata, salt, and expected server revision.
7. Client never stores the passphrase permanently.
8. Derived key is kept only in memory during active sync operations.

The existing bearer token remains transport authorization only.

### 6.3 Passphrase Loss

Default v1 policy: no recovery.

If the passphrase is lost:

- Remote encrypted payload is unrecoverable.
- Other devices that only have the remote payload cannot restore memories.
- Local memory on the current device remains usable.
- User can reset remote memory data with an explicit destructive action: **Reset remote memory**.

The setup UI must warn clearly before first enabling sync.

## 7. Merge Policy

Sync is snapshot-based, but merge is entry-aware.

### 7.1 Snapshot Merge

Given local snapshot L and remote snapshot R:

1. Merge `settings` by field, preferring local changes when remote field equals the previous synced field; otherwise choose remote if only remote changed.
2. If both settings changed, local wins for settings conflicts in v1, with a manual “Pull server settings” action.
3. Merge `globalBank` entry by entry.
4. Merge each agent bank entry by entry by `agentId`.
5. Rebuild local indexes through repository save paths after merge; do not write merged storage blobs directly.
6. Rebuild `profileSummary`, `profileSlots`, and `profileUpdatedAt` after entry merge using bank-level merge rules.

### 7.2 Entry Merge

For each entry ID present in local and/or remote:

| State | Result |
|---|---|
| only local | keep local |
| only remote | add remote |
| unchanged both | keep current |
| only local changed | keep local |
| only remote changed | take remote |
| both changed | latest `updatedAt` wins; tie uses higher `revision`; tie uses remote |
| local tombstone newer | deleted wins |
| remote tombstone newer | deleted wins |

An entry is considered changed if any synced field changed:

- `content`
- `tags`
- `enabled`
- `pinned`
- `archived`
- `updatedAt`
- `revision`
- `deleted`

`lastAccessedAt` is device-local usage metadata. It may be preserved locally, but it is not a synced conflict driver and should not cause remote churn.

### 7.3 Profile Merge

Because profile summaries are generated from entries:

1. Merge entries first.
2. Rebuild local profile locally using upstream `rebuildProfileLocal`.
3. If LLM auto-consolidation is enabled, existing upstream lazy consolidation may later update profile.
4. Do not blindly take remote `profileSummary` if local entries changed.

This avoids profile text drifting away from merged entries.

### 7.4 Agent Bank Handling

Agent banks sync by `agentId`.

If an agent exists only on one device:

- The bank still syncs as long as its `memory:agent:*` storage key exists locally or remotely.
- If local agent no longer exists, the bank remains stored but inactive.
- Users can clear unwanted agent banks from Settings.

## 8. Client Sync Flow

### 8.1 Push

1. Flush pending memory writes using upstream `flushPersistence()`.
2. Load local settings and banks.
3. Build `MemorySyncSnapshot`.
4. Encrypt snapshot.
5. PUT with local known remote revision.
6. On 200, store new remote revision.
7. On 409, pull, merge, re-encrypt, retry push with bounded retries, default 3.

### 8.2 Pull

1. GET remote state.
2. Decrypt payload.
3. Merge into local memory store using merge policy.
4. Rebuild indexes via upstream repository save paths.
5. Flush persistence.
6. Store remote revision.

### 8.3 Auto Sync

When enabled:

- Pull+push on app startup, after history-sync bootstrap where applicable.
- Pull+push after memory settings or bank writes, debounced.
- Optional interval sync reuses history-sync interval concept.

Default recommended cadence:

- startup sync
- debounced post-write sync after 5 seconds of quiet
- manual Sync Now button

Because upstream bank writes are coalesced by 200 ms, any push must first call `flushPersistence()` to avoid snapshotting stale local state.
## 9. Error Handling

- Missing endpoint/token: sync disabled with explanatory message.
- Invalid passphrase: decryption fails; show clear error and do not overwrite remote data.
- Corrupt payload: show error and offer Pull/Push/Reset actions.
- 409 conflict: automatic re-pull, merge, retry push up to 3 times.
- Oversized payload: enforce max body limit from server; show guidance to prune/archived memories.
- Offline: queue local changes only; sync when connection returns.

## 10. Security Model

Addressed:

- Server operator reading memory: prevented by client-side encryption.
- Network observer: payload encryption plus HTTPS if configured.
- Token leakage: token masked in UI, not logged.
- Passphrase brute force: PBKDF2 high iterations and passphrase warning.
- Cross-device compromise: same passphrase across devices means one compromised passphrase exposes remote memory domain.

Known limitations:

- No recovery for lost passphrase.
- Sync metadata such as salt and KDF params are visible to server but not secret.
- Memory injection may reveal facts to selected model/provider; existing upstream privacy model applies.

## 11. Migration Plan

Local `main` has been rebased onto the latest `origin/main`, so PR #28 memory commit `aa27f813`, PR #29, and PR #30 are present locally.

Implementation order:

1. Extend memory schemas with sync fields and ensure `normalizeBank` preserves them.
2. Change memory delete paths to tombstones where sync is enabled or preserve hard delete when sync is disabled; choose one behavior consistently in implementation. Recommended v1: always tombstone, purge later.
3. Add agent-bank enumeration helper.
4. Add encrypted snapshot serializer/deserializer.
5. Add `memorySync` client modeled on `historySync.ts`, including sync lock, state key, 409 retry, and flush-before-snapshot.
6. Add `/api/sync/memory` endpoint to `scripts/history-sync-server/server.mjs` with a separate `memory_snapshot` table.
7. Add settings config under `extension.memorySync`, not inside `MemorySettings`.
8. Add Settings → Memory sync UI based on the general history-sync section pattern.
9. Keep existing personal-info-to-memory migration intact.
10. Add tests around merge/tombstone/encryption, not duplicate upstream recall tests.

## 12. Testing Strategy

Unit tests:

- snapshot serialization roundtrip
- entry merge cases: local-only, remote-only, both-changed, tombstones, tie-breakers
- settings conflict default behavior
- profile rebuild after entry merge
- encryption/decryption roundtrip using test passphrase
- corrupt payload handling

Integration tests:

- mock memory sync server
- push/pull cycle
- 409 conflict retry cycle
- disabled sync does not contact server
- local banks remain usable when sync disabled

Manual QA:

- two devices sharing same server/passphrase
- edit same memory on both devices
- delete memory on one device, verify tombstone propagation
- invalid passphrase does not corrupt local data
- agent bank sync with per-agent edits

## 13. Future Work

1. Per-device sync cursors and incremental record upload instead of full encrypted snapshot.
2. Memory export/import tied to sync identity.
3. Optional account-based or cloud-storage sync adapters.
4. Knowledge-base central storage and search.
5. More granular settings field merge.
6. Encrypted conflict history for auditability.
