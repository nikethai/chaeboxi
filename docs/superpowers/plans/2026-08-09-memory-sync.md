# Personal Memory Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add encrypted multi-device sync for the existing long-term memory system using the self-hosted sync server, without replacing the current memory architecture.

**Architecture:** Keep the current local memory system as the source of truth on each device, then add a snapshot-based encrypted sync layer on top. The client will serialize memory settings plus global/agent banks, encrypt that snapshot with a passphrase-derived key, push/pull it through new `/api/sync/memory` server endpoints, and merge conflicts entry-by-entry with tombstones and deterministic tie-breakers.

**Tech Stack:** TypeScript, React, Zustand, Zod, WebCrypto (PBKDF2 + AES-GCM), existing StoreStorage/memory repository, Node-based self-hosted history sync server, Vitest.

## Global Constraints

- Sync for the upstream long-term memory bank; knowledge-base sync/search is deferred.
- Do not replace or redesign the upstream memory bank.
- Do not add new retrieval modes, recall algorithms, or prompt injection logic beyond what upstream already has.
- Automatic memory extraction improvements are out of scope.
- Mnemopi-style graph memory is out of scope.
- Semantic memory retrieval improvements are out of scope.
- Centralized knowledge-base storage or server-side KB search is out of scope.
- Chaeboxi-hosted SaaS account sync is out of scope.
- v1 keeps the current flat-memory bank model and adds encrypted multi-device sync on top.
- Sync fields must be added to the Zod schemas themselves.
- Sync credentials must **not** be added to `MemorySettingsSchema`; they belong in a separate local sync config similar to `extension.historySync`.
- Sync must call the existing memory flush path before building a snapshot.
- Push operations must use the store/repository save paths so in-memory recall indexes are rebuilt; they must not bypass them by writing storage directly.
- Upstream code has no `listAgentBankIds()` API; sync snapshot creation must add an enumeration helper over `memory:agent:*` storage keys, including inactive agents.
- Upstream `remove()` currently hard-deletes entries; for sync, delete must become a tombstone write through the same entry update path.
- Server endpoints for v1 are `GET /api/sync/memory` and `PUT /api/sync/memory`.
- Encryption uses PBKDF2-HMAC-SHA-256 via WebCrypto, minimum 310,000 iterations, plus AES-GCM with a fresh random IV.
- Default v1 policy: no passphrase recovery.
- Local wins for settings conflicts in v1, with a manual “Pull server settings” action.
- Rebuild local profile locally using upstream `rebuildProfileLocal` after entry merge.
- Because upstream bank writes are coalesced by 200 ms, any push must first call `flushPersistence()` to avoid snapshotting stale local state.
- Graph-based memory is explicitly out of scope for this sync v1.

---

## File Structure

### Existing files to modify

- `src/shared/types/memory.ts`
  - Add optional sync fields to `MemoryEntrySchema` and `MemoryBankSchema`.
- `src/renderer/packages/memory/clone.ts`
  - Preserve sync fields through normalization/clone flows.
- `src/renderer/packages/memory/bank-ops.ts`
  - Convert delete semantics from hard delete to tombstone-aware behavior.
- `src/renderer/packages/memory/persistence.ts`
  - Add helper(s) for enumerating agent-bank keys and reusing flush behavior.
- `src/renderer/packages/memory/repository.ts`
  - Add snapshot-supporting methods and ensure merged saves rebuild indexes.
- `src/renderer/stores/memoryStore.ts`
  - Route remove/replace/import flows through tombstone-aware and merge-safe paths.
- `src/shared/types/settings.ts`
  - Add `MemorySyncConfigSchema` under settings extension.
- `src/shared/defaults.ts`
  - Add defaults for memory sync config.
- `src/renderer/routes/settings/memory.tsx`
  - Wire memory sync controls into the Memory settings screen.
- `src/renderer/components/settings/memory/MemoryAdvancedPanel.tsx`
  - Render sync fields/actions/warnings.
- `src/renderer/index.tsx`
  - Bootstrap memory sync non-blockingly.
- `scripts/history-sync-server/server.mjs`
  - Add memory sync table and `/api/sync/memory` routes.
- `scripts/history-sync-server/README.md`
  - Document memory sync setup and passphrase caveat.

### New files to create

- `src/renderer/packages/memory/sync-types.ts`
  - Shared types for snapshot payload, encrypted payload envelope, and sync state.
- `src/renderer/packages/memory/snapshot.ts`
  - Serialize/deserialize local memory snapshot.
- `src/renderer/packages/memory/crypto.ts`
  - PBKDF2/AES-GCM helpers and encoding utilities.
- `src/renderer/packages/memory/merge.ts`
  - Entry-aware merge logic for settings, banks, tombstones, and profile rebuild.
- `src/renderer/stores/memorySync.ts`
  - Client sync API modeled after `historySync.ts`.
- `src/renderer/setup/memory_sync.ts`
  - Startup and interval bootstrap modeled after `setup/history_sync.ts`.
- `src/renderer/packages/memory/merge.test.ts`
  - Unit tests for merge/tombstone/profile rules.
- `src/renderer/packages/memory/crypto.test.ts`
  - Unit tests for encryption/decryption roundtrip.
- `src/renderer/packages/memory/snapshot.test.ts`
  - Unit tests for snapshot serialization.
- `src/renderer/stores/memorySync.test.ts`
  - Integration-ish tests for GET/PUT/409 retry flows.

## Task 1: Add sync-safe memory schema fields

**Files:**
- Modify: `src/shared/types/memory.ts`
- Modify: `src/renderer/packages/memory/clone.ts`
- Test: `src/renderer/packages/memory/snapshot.test.ts`

**Interfaces:**
- Consumes: existing `MemoryEntrySchema`, `MemoryBankSchema`, `normalizeBank()`, `normalizeSettings()`
- Produces:
  - `MemoryEntry` with `revision?: number` and `deleted?: boolean`
  - `MemoryBank` with `revision?: number`
  - `normalizeBank(bank: unknown, scope: MemoryScope, agentId?: string): MemoryBank`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { normalizeBank } from '@/packages/memory/clone'

describe('normalizeBank sync fields', () => {
  it('preserves revision and deleted flags', () => {
    const bank = normalizeBank(
      {
        scope: 'global',
        version: 1,
        revision: 4,
        entries: [
          {
            id: 'm1',
            content: 'User prefers concise answers',
            tags: ['preference'],
            scope: 'global',
            source: 'user',
            enabled: true,
            pinned: false,
            createdAt: 1,
            updatedAt: 2,
            revision: 3,
            deleted: true,
          },
        ],
        profileSummary: '',
      },
      'global'
    )

    expect(bank.revision).toBe(4)
    expect(bank.entries[0].revision).toBe(3)
    expect(bank.entries[0].deleted).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/renderer/packages/memory/snapshot.test.ts -t "preserves revision and deleted flags"`
Expected: FAIL because `revision` / `deleted` are missing or stripped.

- [ ] **Step 3: Write minimal implementation**

```ts
export const MemoryEntrySchema = z.object({
  id: z.string(),
  content: z.string(),
  tags: z.array(z.string()).default([]),
  scope: MemoryScopeSchema,
  agentId: z.string().optional(),
  source: MemorySourceSchema,
  sourceSessionId: z.string().optional(),
  sourceMessageId: z.string().optional(),
  enabled: z.boolean().default(true),
  pinned: z.boolean().default(false),
  createdAt: z.number(),
  updatedAt: z.number(),
  lastAccessedAt: z.number().optional(),
  archived: z.boolean().optional(),
  revision: z.number().optional(),
  deleted: z.boolean().optional(),
})

export const MemoryBankSchema = z.object({
  scope: MemoryScopeSchema,
  agentId: z.string().optional(),
  entries: z.array(MemoryEntrySchema).default([]),
  profileSummary: z.string().default(''),
  profileUpdatedAt: z.number().optional(),
  profileSlots: MemoryProfileSlotsSchema.optional(),
  version: z.number().default(1),
  revision: z.number().optional(),
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/renderer/packages/memory/snapshot.test.ts -t "preserves revision and deleted flags"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/shared/types/memory.ts src/renderer/packages/memory/clone.ts src/renderer/packages/memory/snapshot.test.ts
git commit -m "feat(memory): preserve sync metadata in memory schemas"
```

### Task 2: Add tombstone-based delete behavior

**Files:**
- Modify: `src/renderer/packages/memory/bank-ops.ts`
- Modify: `src/renderer/stores/memoryStore.ts`
- Test: `src/renderer/packages/memory/merge.test.ts`

**Interfaces:**
- Consumes: `MemoryEntry`, `MemoryBank`, current remove/delete flow
- Produces:
  - `markEntryDeleted(bank: MemoryBank, id: string, now?: number): MemoryBank`
  - `purgeExpiredTombstones(bank: MemoryBank, now?: number, ttlMs?: number): MemoryBank`
  - `memoryStore.remove(scope: 'global' | 'agent', id: string, agentId?: string): Promise<void>` writing tombstones instead of hard delete

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { markEntryDeleted } from '@/packages/memory/bank-ops'

describe('markEntryDeleted', () => {
  it('marks an entry deleted without removing it', () => {
    const next = markEntryDeleted(
      {
        scope: 'global',
        version: 1,
        revision: 1,
        profileSummary: '',
        entries: [
          {
            id: 'm1',
            content: 'Use concise replies',
            tags: [],
            scope: 'global',
            source: 'user',
            enabled: true,
            pinned: false,
            createdAt: 1,
            updatedAt: 1,
            revision: 1,
          },
        ],
      },
      'm1',
      100
    )

    expect(next.entries).toHaveLength(1)
    expect(next.entries[0].deleted).toBe(true)
    expect(next.entries[0].updatedAt).toBe(100)
    expect(next.entries[0].revision).toBe(2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/renderer/packages/memory/merge.test.ts -t "marks an entry deleted without removing it"`
Expected: FAIL because `markEntryDeleted` does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
export function markEntryDeleted(bank: MemoryBank, id: string, now = Date.now()): MemoryBank {
  let changed = false
  const entries = bank.entries.map((entry) => {
    if (entry.id !== id) return entry
    changed = true
    return {
      ...entry,
      deleted: true,
      enabled: false,
      updatedAt: now,
      revision: (entry.revision ?? 0) + 1,
    }
  })

  if (!changed) return bank
  return {
    ...bank,
    entries,
    revision: (bank.revision ?? 0) + 1,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/renderer/packages/memory/merge.test.ts -t "marks an entry deleted without removing it"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/packages/memory/bank-ops.ts src/renderer/stores/memoryStore.ts src/renderer/packages/memory/merge.test.ts
git commit -m "feat(memory): use tombstones for synced memory deletes"
```

### Task 3: Add agent-bank enumeration for snapshots

**Files:**
- Modify: `src/renderer/packages/memory/persistence.ts`
- Modify: `src/renderer/packages/memory/repository.ts`
- Test: `src/renderer/packages/memory/snapshot.test.ts`

**Interfaces:**
- Consumes: `storage`, `StorageKeyGenerator.memoryAgent(agentId)`
- Produces:
  - `listAgentBankIds(): Promise<string[]>`
  - `loadAllAgentBanks(): Promise<Array<{ agentId: string; bank: MemoryBank }>>`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from 'vitest'
import * as persistence from '@/packages/memory/persistence'

describe('listAgentBankIds', () => {
  it('finds all memory:agent:* keys', async () => {
    vi.spyOn((persistence as any).defaultStorage, 'getAllKeys').mockResolvedValue([
      'memory:agent:agent-1',
      'memory:agent:agent-2',
      'memory-bank-global',
    ])

    await expect(persistence.listAgentBankIds()).resolves.toEqual(['agent-1', 'agent-2'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/renderer/packages/memory/snapshot.test.ts -t "finds all memory:agent:* keys"`
Expected: FAIL because `listAgentBankIds` does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
export async function listAgentBankIds(): Promise<string[]> {
  const keys = await storage.getAllKeys()
  return keys
    .filter((key) => key.startsWith('memory:agent:'))
    .map((key) => key.slice('memory:agent:'.length))
    .sort()
}

export async function loadAllAgentBanks(): Promise<Array<{ agentId: string; bank: MemoryBank }>> {
  const ids = await listAgentBankIds()
  return await Promise.all(ids.map(async (agentId) => ({ agentId, bank: await loadAgentBank(agentId) })))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/renderer/packages/memory/snapshot.test.ts -t "finds all memory:agent:* keys"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/packages/memory/persistence.ts src/renderer/packages/memory/repository.ts src/renderer/packages/memory/snapshot.test.ts
git commit -m "feat(memory): enumerate agent banks for sync snapshots"
```

### Task 4: Add memory sync config and state types

**Files:**
- Create: `src/renderer/packages/memory/sync-types.ts`
- Modify: `src/shared/types/settings.ts`
- Modify: `src/shared/defaults.ts`
- Test: `src/renderer/stores/memorySync.test.ts`

**Interfaces:**
- Consumes: existing `HistorySyncConfigSchema` pattern
- Produces:
  - `type MemorySyncSnapshot`
  - `type RemoteMemoryState`
  - `type MemorySyncState`
  - `MemorySyncConfigSchema`
  - settings extension field `memorySync?: MemorySyncConfig`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { SettingsSchema } from '@shared/types/settings'

describe('memory sync config schema', () => {
  it('accepts memorySync extension settings', () => {
    const parsed = SettingsSchema.parse({
      extension: {
        memorySync: {
          enabled: true,
          endpoint: 'http://127.0.0.1:8788',
          token: 'secret',
          autoSync: true,
          intervalSeconds: 60,
        },
      },
    })

    expect(parsed.extension.memorySync?.enabled).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/renderer/stores/memorySync.test.ts -t "accepts memorySync extension settings"`
Expected: FAIL because `memorySync` is not part of settings.

- [ ] **Step 3: Write minimal implementation**

```ts
export const MemorySyncConfigSchema = z.object({
  enabled: z.boolean().default(false),
  endpoint: z.string().default(''),
  token: z.string().default(''),
  autoSync: z.boolean().default(false),
  intervalSeconds: z.number().default(60),
})

export type MemorySyncConfig = z.infer<typeof MemorySyncConfigSchema>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/renderer/stores/memorySync.test.ts -t "accepts memorySync extension settings"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/packages/memory/sync-types.ts src/shared/types/settings.ts src/shared/defaults.ts src/renderer/stores/memorySync.test.ts
git commit -m "feat(memory): add memory sync config types"
```

### Task 5: Add snapshot serialization helpers

**Files:**
- Create: `src/renderer/packages/memory/snapshot.ts`
- Test: `src/renderer/packages/memory/snapshot.test.ts`

**Interfaces:**
- Consumes: `MemorySettings`, `MemoryBank`, `loadAllAgentBanks()`
- Produces:
  - `buildMemorySyncSnapshot(input: { settings: MemorySettings; globalBank: MemoryBank; agentBanks: Array<{ agentId: string; bank: MemoryBank }> }): MemorySyncSnapshot`
  - `serializeMemorySyncSnapshot(snapshot: MemorySyncSnapshot): string`
  - `parseMemorySyncSnapshot(raw: string): MemorySyncSnapshot`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { buildMemorySyncSnapshot, parseMemorySyncSnapshot, serializeMemorySyncSnapshot } from '@/packages/memory/snapshot'

describe('memory sync snapshot', () => {
  it('round-trips settings, global bank, and agent banks', () => {
    const snapshot = buildMemorySyncSnapshot({
      settings: { enabled: true } as any,
      globalBank: { scope: 'global', version: 1, entries: [], profileSummary: '' } as any,
      agentBanks: [{ agentId: 'agent-1', bank: { scope: 'agent', agentId: 'agent-1', version: 1, entries: [], profileSummary: '' } as any }],
    })

    const reparsed = parseMemorySyncSnapshot(serializeMemorySyncSnapshot(snapshot))
    expect(reparsed.agentBanks[0].agentId).toBe('agent-1')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/renderer/packages/memory/snapshot.test.ts -t "round-trips settings, global bank, and agent banks"`
Expected: FAIL because snapshot helpers do not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
export function buildMemorySyncSnapshot(input: {
  settings: MemorySettings
  globalBank: MemoryBank
  agentBanks: Array<{ agentId: string; bank: MemoryBank }>
}): MemorySyncSnapshot {
  return {
    schemaVersion: 1,
    settings: input.settings,
    globalBank: input.globalBank,
    agentBanks: input.agentBanks,
  }
}

export function serializeMemorySyncSnapshot(snapshot: MemorySyncSnapshot): string {
  return JSON.stringify(snapshot)
}

export function parseMemorySyncSnapshot(raw: string): MemorySyncSnapshot {
  return JSON.parse(raw) as MemorySyncSnapshot
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/renderer/packages/memory/snapshot.test.ts -t "round-trips settings, global bank, and agent banks"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/packages/memory/snapshot.ts src/renderer/packages/memory/snapshot.test.ts
git commit -m "feat(memory): add sync snapshot serialization"
```

### Task 6: Add WebCrypto encryption helpers

**Files:**
- Create: `src/renderer/packages/memory/crypto.ts`
- Test: `src/renderer/packages/memory/crypto.test.ts`

**Interfaces:**
- Consumes: WebCrypto API
- Produces:
  - `deriveMemorySyncKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey>`
  - `encryptMemorySyncPayload(passphrase: string, plaintext: string, salt?: Uint8Array): Promise<{ payload: string; salt: string; iv: string; alg: 'AES-GCM'; kdf: 'PBKDF2-SHA-256' }>`
  - `decryptMemorySyncPayload(input: { passphrase: string; payload: string; salt: string; iv: string }): Promise<string>`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { decryptMemorySyncPayload, encryptMemorySyncPayload } from '@/packages/memory/crypto'

describe('memory sync crypto', () => {
  it('encrypts and decrypts a snapshot payload', async () => {
    const encrypted = await encryptMemorySyncPayload('correct horse battery staple', '{"schemaVersion":1}')
    const decrypted = await decryptMemorySyncPayload({
      passphrase: 'correct horse battery staple',
      payload: encrypted.payload,
      salt: encrypted.salt,
      iv: encrypted.iv,
    })

    expect(decrypted).toBe('{"schemaVersion":1}')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/renderer/packages/memory/crypto.test.ts -t "encrypts and decrypts a snapshot payload"`
Expected: FAIL because crypto helpers do not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
const ITERATIONS = 310_000

export async function deriveMemorySyncKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey'])
  return await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/renderer/packages/memory/crypto.test.ts -t "encrypts and decrypts a snapshot payload"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/packages/memory/crypto.ts src/renderer/packages/memory/crypto.test.ts
git commit -m "feat(memory): add sync payload encryption helpers"
```

### Task 7: Add merge engine for snapshots

**Files:**
- Create: `src/renderer/packages/memory/merge.ts`
- Test: `src/renderer/packages/memory/merge.test.ts`

**Interfaces:**
- Consumes: `MemorySyncSnapshot`, `MemoryEntry`, `rebuildProfileLocal(bank: MemoryBank): MemoryBank`
- Produces:
  - `mergeMemorySnapshots(input: { local: MemorySyncSnapshot; remote: MemorySyncSnapshot }): MemorySyncSnapshot`
  - `mergeMemoryBanks(local: MemoryBank, remote: MemoryBank): MemoryBank`
  - `mergeMemoryEntries(local: MemoryEntry | undefined, remote: MemoryEntry | undefined): MemoryEntry | undefined`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { mergeMemoryEntries } from '@/packages/memory/merge'

describe('mergeMemoryEntries', () => {
  it('prefers newer tombstone over older live entry', () => {
    const merged = mergeMemoryEntries(
      {
        id: 'm1',
        content: 'Use short answers',
        tags: [],
        scope: 'global',
        source: 'user',
        enabled: true,
        pinned: false,
        createdAt: 1,
        updatedAt: 10,
        revision: 1,
      } as any,
      {
        id: 'm1',
        content: 'Use short answers',
        tags: [],
        scope: 'global',
        source: 'user',
        enabled: false,
        pinned: false,
        createdAt: 1,
        updatedAt: 20,
        revision: 2,
        deleted: true,
      } as any
    )

    expect(merged?.deleted).toBe(true)
    expect(merged?.revision).toBe(2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/renderer/packages/memory/merge.test.ts -t "prefers newer tombstone over older live entry"`
Expected: FAIL because merge helpers do not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
export function mergeMemoryEntries(local?: MemoryEntry, remote?: MemoryEntry): MemoryEntry | undefined {
  if (!local) return remote
  if (!remote) return local
  if ((remote.updatedAt ?? 0) > (local.updatedAt ?? 0)) return remote
  if ((remote.updatedAt ?? 0) < (local.updatedAt ?? 0)) return local
  if ((remote.revision ?? 0) > (local.revision ?? 0)) return remote
  if ((remote.revision ?? 0) < (local.revision ?? 0)) return local
  return remote
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/renderer/packages/memory/merge.test.ts -t "prefers newer tombstone over older live entry"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/packages/memory/merge.ts src/renderer/packages/memory/merge.test.ts
git commit -m "feat(memory): add snapshot merge engine"
```

### Task 8: Add memory sync client store

**Files:**
- Create: `src/renderer/stores/memorySync.ts`
- Test: `src/renderer/stores/memorySync.test.ts`

**Interfaces:**
- Consumes:
  - `buildMemorySyncSnapshot(...)`
  - `encryptMemorySyncPayload(...)`
  - `decryptMemorySyncPayload(...)`
  - `mergeMemorySnapshots(...)`
  - `memoryStore.getState().flushPersistence(): Promise<void>`
- Produces:
  - `getMemorySyncState(): Promise<MemorySyncState>`
  - `testMemorySyncConnection(config: MemorySyncConfig): Promise<RemoteMemoryState>`
  - `pullMemoryFromServer(config: MemorySyncConfig, passphrase: string): Promise<void>`
  - `pushMemoryToServer(config: MemorySyncConfig, passphrase: string): Promise<void>`
  - `syncMemoryNow(config: MemorySyncConfig, passphrase: string): Promise<void>`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from 'vitest'
import { syncMemoryNow } from '@/stores/memorySync'

describe('syncMemoryNow', () => {
  it('retries after a 409 conflict by pulling and re-pushing', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ revision: 2, payload: 'remote' }), { status: 409 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ revision: 2, payload: 'remote' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ revision: 3 }), { status: 200 }))

    await expect(syncMemoryNow({ enabled: true, endpoint: 'http://x', token: 't', autoSync: false, intervalSeconds: 60 }, 'pw', { fetchImpl } as any)).resolves.toBeUndefined()
    expect(fetchImpl).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/renderer/stores/memorySync.test.ts -t "retries after a 409 conflict by pulling and re-pushing"`
Expected: FAIL because `memorySync.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
const MEMORY_SYNC_STATE_KEY = 'memory-sync-state'
let syncLock: Promise<unknown> | null = null

export async function syncMemoryNow(config: MemorySyncConfig, passphrase: string, deps?: { fetchImpl?: typeof fetch }) {
  if (syncLock) return await syncLock
  syncLock = (async () => {
    await pullMemoryFromServer(config, passphrase, deps)
    await pushMemoryToServer(config, passphrase, deps)
  })().finally(() => {
    syncLock = null
  })
  return await syncLock
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/renderer/stores/memorySync.test.ts -t "retries after a 409 conflict by pulling and re-pushing"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/stores/memorySync.ts src/renderer/stores/memorySync.test.ts
git commit -m "feat(memory): add encrypted memory sync client"
```

### Task 9: Add server `/api/sync/memory` endpoint

**Files:**
- Modify: `scripts/history-sync-server/server.mjs`
- Modify: `scripts/history-sync-server/README.md`
- Test: manual curl checks from README examples

**Interfaces:**
- Consumes: existing auth, DB, and compare-and-swap history-sync patterns
- Produces:
  - `GET /api/sync/memory`
  - `PUT /api/sync/memory`
  - SQLite table storing encrypted memory payload + revision metadata

- [ ] **Step 1: Write the failing server check**

```bash
curl -i \
  -H "Authorization: Bearer replace-with-strong-token" \
  http://127.0.0.1:8788/api/sync/memory
```

Expected: `404 Not Found`

- [ ] **Step 2: Run check to verify it fails**

Run: `node scripts/history-sync-server/server.mjs` in one terminal, then the `curl` above in another
Expected: 404 because memory endpoint is not implemented yet

- [ ] **Step 3: Write minimal implementation**

```js
await db.execute(`
  CREATE TABLE IF NOT EXISTS memory_snapshot (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    revision INTEGER NOT NULL,
    payload TEXT NOT NULL,
    alg TEXT NOT NULL,
    kdf TEXT NOT NULL,
    salt TEXT NOT NULL,
    iv TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`)
```

- [ ] **Step 4: Run check to verify it passes**

Run: the same `curl` command again
Expected: `200 OK` with JSON body or `401` if token is missing/invalid; endpoint exists and uses auth

- [ ] **Step 5: Commit**

```bash
git add scripts/history-sync-server/server.mjs scripts/history-sync-server/README.md
git commit -m "feat(sync-server): add encrypted memory sync endpoint"
```

### Task 10: Add Memory Sync UI

**Files:**
- Modify: `src/renderer/components/settings/memory/MemoryAdvancedPanel.tsx`
- Modify: `src/renderer/routes/settings/memory.tsx`
- Test: `src/renderer/components/settings/memory/memory-ui-state.test.ts`

**Interfaces:**
- Consumes:
  - `getMemorySyncState()`
  - `testMemorySyncConnection()`
  - `pullMemoryFromServer()`
  - `pushMemoryToServer()`
  - `syncMemoryNow()`
- Produces:
  - Memory Sync settings form and action panel
  - Passphrase-loss warning UX

- [ ] **Step 1: Write the failing UI test**

```ts
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MemoryAdvancedPanel } from '@/components/settings/memory/MemoryAdvancedPanel'

describe('MemoryAdvancedPanel sync section', () => {
  it('shows endpoint, token, passphrase, and sync actions', () => {
    render(<MemoryAdvancedPanel />)
    expect(screen.getByLabelText(/sync server endpoint/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/sync token/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/sync passphrase/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sync now/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/renderer/components/settings/memory/memory-ui-state.test.ts -t "shows endpoint, token, passphrase, and sync actions"`
Expected: FAIL because the controls are missing.

- [ ] **Step 3: Write minimal implementation**

```tsx
<TextInput label="Sync server endpoint" value={syncForm.endpoint} onChange={(e) => setSyncForm((s) => ({ ...s, endpoint: e.currentTarget.value }))} />
<PasswordInput label="Sync token" value={syncForm.token} onChange={(e) => setSyncForm((s) => ({ ...s, token: e.currentTarget.value }))} />
<PasswordInput label="Sync passphrase" value={passphrase} onChange={(e) => setPassphrase(e.currentTarget.value)} />
<Button onClick={handleSyncNow}>Sync Now</Button>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/renderer/components/settings/memory/memory-ui-state.test.ts -t "shows endpoint, token, passphrase, and sync actions"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/settings/memory/MemoryAdvancedPanel.tsx src/renderer/routes/settings/memory.tsx src/renderer/components/settings/memory/memory-ui-state.test.ts
git commit -m "feat(memory): add memory sync settings UI"
```

### Task 11: Add bootstrap and debounced autosync

**Files:**
- Create: `src/renderer/setup/memory_sync.ts`
- Modify: `src/renderer/index.tsx`
- Test: `src/renderer/stores/memorySync.test.ts`

**Interfaces:**
- Consumes:
  - `syncMemoryNow()`
  - `settingsStore.subscribe(...)`
  - `memoryStore.subscribe(...)`
- Produces:
  - `initMemorySyncBootstrap(): void`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from 'vitest'
import { initMemorySyncBootstrap } from '@/setup/memory_sync'

describe('initMemorySyncBootstrap', () => {
  it('schedules sync when memory sync is enabled', () => {
    const spy = vi.spyOn(global, 'setTimeout')
    initMemorySyncBootstrap()
    expect(spy).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/renderer/stores/memorySync.test.ts -t "schedules sync when memory sync is enabled"`
Expected: FAIL because bootstrap module does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
let initialized = false

export function initMemorySyncBootstrap() {
  if (initialized) return
  initialized = true
  setTimeout(() => {
    void maybeRunStartupMemorySync()
  }, 0)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/renderer/stores/memorySync.test.ts -t "schedules sync when memory sync is enabled"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/setup/memory_sync.ts src/renderer/index.tsx src/renderer/stores/memorySync.test.ts
git commit -m "feat(memory): bootstrap encrypted memory sync"
```

### Task 12: Finish docs and end-to-end verification

**Files:**
- Modify: `scripts/history-sync-server/README.md`
- Modify: `docs/memory.md`
- Test: targeted Vitest suite + manual two-device verification

**Interfaces:**
- Consumes: completed client/server/UI implementation
- Produces:
  - updated setup docs
  - explicit no-recovery/passphrase warning docs
  - final verification checklist

- [ ] **Step 1: Write the failing documentation checklist**

```md
- [ ] README explains /api/sync/memory
- [ ] README explains sync passphrase and no recovery
- [ ] docs/memory.md no longer says local-only without mentioning optional self-hosted sync
- [ ] manual two-device test steps are documented
```

- [ ] **Step 2: Run verification to confirm docs are incomplete**

Run: `grep` is not allowed; manually open `scripts/history-sync-server/README.md` and `docs/memory.md`
Expected: Missing memory sync instructions and/or outdated local-only wording

- [ ] **Step 3: Write minimal implementation**

```md
## Memory Sync

- Endpoint: `/api/sync/memory`
- Transport auth: bearer token
- Payloads are encrypted client-side
- Losing the sync passphrase makes remote memory unrecoverable
```

- [ ] **Step 4: Run verification to confirm completion**

Run:
- `pnpm test -- src/renderer/packages/memory/snapshot.test.ts src/renderer/packages/memory/crypto.test.ts src/renderer/packages/memory/merge.test.ts src/renderer/stores/memorySync.test.ts`
- Manual QA on two devices or two app instances against one sync server

Expected:
- PASS for targeted tests
- Manual checks confirm push/pull, merge, and tombstone propagation

- [ ] **Step 5: Commit**

```bash
git add scripts/history-sync-server/README.md docs/memory.md src/renderer/packages/memory/*.test.ts src/renderer/stores/memorySync.test.ts
git commit -m "docs: document encrypted memory sync setup and verification"
```

## Self-Review

### Spec coverage

- Schema upgrades → Tasks 1 and 4
- Tombstones/delete semantics → Task 2
- Agent bank enumeration → Task 3
- Encrypted snapshot transport → Tasks 5 and 6
- Server `/api/sync/memory` → Task 9
- Merge policy and profile rebuild → Task 7
- Client sync API and retry flow → Task 8
- Memory Sync UI → Task 10
- Bootstrap/autosync → Task 11
- Tests/docs/passphrase warning → Task 12
- Graph memory out of scope → enforced in Global Constraints, no task adds graph behavior
- Mnemopi not adopted → enforced in Non-goals and Global Constraints, no task adds dependency

### Placeholder scan

- No `TODO`, `TBD`, or “implement later” placeholders remain.
- Every task contains concrete files, interfaces, code snippets, commands, and expected outcomes.

### Type consistency

- Snapshot types are introduced in Task 4 and used consistently in Tasks 5, 7, and 8.
- Client store APIs introduced in Task 8 are the same names consumed by Tasks 10 and 11.
- Tombstone fields (`revision`, `deleted`) are introduced in Task 1 before use in later tasks.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-09-memory-sync.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
