# Personal Memory Storage, Sync, and Retrieval Design

Date: 2026-08-08
Status: Draft
Scope: Personal memory v1; document knowledge-base sync/search is deferred

## 1. Goal

Add a personal memory system to Chaeboxi that stores durable, user-reviewable facts such as preferences, identity details, projects, instructions, decisions, and environment details. The feature should improve future chat quality without large context overhead and should synchronize across machines through the existing self-hosted sync server direction.

This version intentionally focuses on personal memory only. Knowledge-base central serving, encrypted KB blob sync, central KB search, and queryable embedding indexes are out of scope for v1.

## 2. Non-Goals

The following are explicitly deferred:

- Automatic memory extraction from conversations in v1.
- Mnemopi-like suggestion extraction, deduplication, decay, or consolidation in v1.
- Semantic memory retrieval in v1.
- Centralized knowledge-base storage, document blob sync, or server-side KB search.
- Chaeboxi-hosted SaaS account sync.
- Mobile-specific background sync beyond what the app already schedules; memory bootstrap behavior follows existing history-sync platform constraints.

## 3. User-Facing Behavior

### 3.1 Memory Management UI

A Personal Memory settings page provides CRUD operations for memories:

- Create a memory manually.
- Edit memory text.
- Assign or change category.
- Add or remove tags.
- Pin or unpin memory.
- Enable or disable memory.
- Delete memory.
- Search/filter local memory list.

Deleting a memory creates a tombstone record for sync rather than immediately removing the synced record from all clients.

### 3.2 Save From Chat

A message-level action allows the user to save a selected chat message as a memory draft. The action opens the memory editor prefilled with the message text so the user can shorten it into an atomic fact before saving. This is an explicit save flow, not automatic extraction.

### 3.3 Memory Injection

Enabled memories are injected into outgoing chat requests before model invocation. The injection is deterministic and local. No additional model call is required in v1.

Injection order:

1. Pinned memories.
2. Recently updated enabled memories.
3. Older enabled memories.

The system stops adding memories once the configured token budget is reached.

Default token budget: 750 tokens. This should be configurable in developer or advanced settings, with sane min/max bounds such as 0 to 4000 tokens.

### 3.4 Privacy Controls

- Memory sync is disabled by default.
- Memory injection can be disabled globally.
- Per-session override can disable memory injection for sensitive sessions.
- Memory entries are visible and editable by the user in settings.
- Source metadata may reference session or message IDs, but the synced memory text should be intentionally saved by the user.

## 4. Data Model

Canonical memory record:

```ts
type MemoryCategory =
  | 'preference'
  | 'identity'
  | 'project'
  | 'instruction'
  | 'decision'
  | 'environment'
  | 'other'

type MemoryRecord = {
  id: string
  text: string
  category: MemoryCategory
  tags: string[]
  source: 'manual' | 'chat' | 'import'
  sourceSessionId?: string
  sourceMessageId?: string
  pinned: boolean
  enabled: boolean
  createdAt: string
  updatedAt: string
  revision: number
  deleted?: boolean
}
```

Rules:

- `id` is a stable UUID.
- `text` is the memory content shown to the model and user.
- `category` and `tags` support future filtering/retrieval but v1 injection uses deterministic order.
- `revision` increments on every local write and is used for sync conflict resolution.
- `deleted` marks a tombstone. Tombstones are retained for 30 days after `updatedAt`; after that, implementations may purge them locally and from encrypted sync payloads during merge/re-encrypt.

## 5. Storage Architecture

### 5.1 Local Storage

The renderer stores memory records through the existing storage abstraction. The memory store should expose pure logic separated from storage backend details:

- list memories
- create memory
- update memory
- delete memory as tombstone
- resolve merged remote records
- select injectable memories within token budget

Local data remains usable even when sync is disabled.

### 5.2 Sync Storage

The self-hosted sync server is extended with a dedicated memory domain separate from the chat-history snapshot.

Server responsibilities remain deliberately simple:

- authenticate with existing bearer token
- store opaque encrypted memory domain payload or record batch
- return latest revision
- compare-and-swap updates
- reject conflicting updates with current server state

The server does not decrypt memory content.

## 6. Synchronization Design

### 6.1 Transport

Extend the existing history sync server with a new endpoint pattern, conceptually:

- `GET /api/sync/memory`
- `PUT /api/sync/memory`

The implementation may keep one opaque encrypted JSON document with embedded record list and revision, or evolve to per-record server storage. For v1, an opaque encrypted payload with per-record merge metadata is acceptable and simpler.

### 6.2 Encryption

Memory sync payloads are encrypted on the client before leaving the device.

Recommended v1 key story:

1. User enables memory sync.
2. User enters or generates a sync passphrase.
3. Client derives an encryption key from the passphrase using PBKDF2-HMAC-SHA-256 via WebCrypto with at least 310,000 iterations. Argon2id may be considered later but is not required for v1.
4. Client generates a random salt and stores salt/KDF parameters as unencrypted sync metadata. This metadata is not secret; the passphrase is the secret.
5. Payloads are encrypted with authenticated encryption, for example AES-GCM or ChaCha20-Poly1305 via WebCrypto or platform crypto.
6. The derived key is never stored permanently; it is derived when needed and held only in memory for active sync operations.

The existing bearer token remains transport authorization. It is not the encryption key.

### 6.3 Passphrase Loss

If the user forgets the sync passphrase:

- Local memories on the current device remain readable because local storage is separate from sync encryption.
- Encrypted payloads on the sync server become unrecoverable.
- Other devices that only have synced encrypted data cannot recover those memories without the passphrase.
- v1 provides no passphrase recovery mechanism.
- The setup UI must display a clear warning: losing the passphrase makes synced memories unrecoverable on other devices.

Default policy: no recovery. Clear warning at setup. Local copies stay usable.

### 6.4 Merge Algorithm

Each sync cycle performs:

1. Read local records and local sync cursor.
2. Fetch remote encrypted payload.
3. Decrypt remote payload.
4. Merge remote records into local records by record `id`.
5. For each conflicting record:
   - if only one side changed since common ancestor, accept changed side;
   - if both sides changed, choose the record with later `updatedAt`;
   - if timestamps are equal or ambiguous, choose higher `revision`;
   - v1 does not expose manual conflict UI; latest-write wins and the merge result is shown in the memory list.
6. Re-encrypt merged result.
7. Push with compare-and-swap using server revision.
8. If push conflicts, re-pull and merge again.

Tombstones win over edits to the same record when the tombstone has the latest revision/timestamp.

## 7. Context Injection Design

### 7.1 Injection Location

Memories are injected into the assembled model context before request dispatch. The exact integration point is the existing context assembly layer, not individual provider model wrappers.

The injected block should be short and structured, for example:

```text
# Personal Memory
- Preference: User prefers concise technical answers.
- Project: User is improving Chaeboxi memory sync.
- Instruction: Always mention security tradeoffs.
```

### 7.2 Selection Rules

For v1, select memories deterministically:

1. Filter to `enabled === true` and `deleted !== true`.
2. Sort:
   - pinned first, then by `updatedAt` descending;
   - within pinned, by `updatedAt` descending;
   - within unpinned, by `updatedAt` descending.
3. Render memories as bullet lines.
4. Stop when token budget is exceeded.

### 7.3 Token Efficiency

- Memory text should be atomic, ideally under 40 words each.
- UI should discourage saving full messages verbatim.
- Injection renders compact bullet list, not JSON.
- Category labels may be omitted for tokens if budget is tight; v1 can include short category prefixes because they help model understanding.
- No reranking, no embedding, no extra LLM call in v1.

## 8. Security Model

Threats addressed in v1:

- Sync server operator reading memory content: prevented by client-side E2E encryption.
- Network observer reading sync payloads: prevented by HTTPS where configured and by payload encryption.
- Accidental token leakage: bearer token should not be logged; settings UI should mask it.
- Passphrase brute force: use strong KDF parameters and recommend long passphrases.
- Client compromise: out of scope; local app storage is already trusted.

Known tradeoffs:

- Server stores opaque encrypted payload; if user loses passphrase, remote data is unrecoverable.
- If the same passphrase is used across devices, compromise of one device/passphrase compromises synced memory domain.
- Memory injection may reveal user facts to the selected model/provider. The UI should make this explicit in privacy settings.

## 9. Error Handling

- Missing endpoint/token: sync disabled with explanatory error.
- Invalid passphrase: decryption fails; show clear error and do not overwrite remote data.
- Server 409 conflict: re-pull, merge, retry push with bounded retry count, for example 3 attempts.
- Corrupt remote payload: show error and offer manual pull/push/export/reset actions.
- Oversized payload: enforce a maximum serialized encrypted payload size, for example 1 MB, and surface memory-count guidance.
- Sync lock: reuse existing sync lock concept so concurrent pushes do not corrupt state.

## 10. Observability

Add non-sensitive debug logging and state:

- last memory sync time
- last sync error
- local memory count
- enabled memory count
- estimated injected memory tokens

Do not log memory text, passphrase, or derived keys.

## 11. Testing Strategy

Unit tests:

- memory CRUD and tombstone creation
- injection ordering and budget truncation
- merge algorithm for local-only, remote-only, both-changed, deletion, and timestamp conflicts
- passphrase encryption/decryption roundtrip using test keys
- payload validation and corrupt payload handling

Integration tests:

- sync against a mock memory server endpoint
- compare-and-swap conflict/retry cycle
- disabled sync does not contact server
- local memories remain usable when sync is disabled or passphrase is unavailable

Manual QA:

- create/edit/delete memory on two devices
- verify pinned memories appear first in model requests
- verify token budget truncation
- verify invalid passphrase does not corrupt local or remote data

## 12. Future Work

After v1:

1. Reviewable AI-extracted memory suggestions.
2. Semantic memory retrieval using local embeddings.
3. Mnemopi-style deduplication, importance scoring, decay, and consolidation.
4. Encrypted memory export/import.
5. Knowledge-base central storage and search.
6. Per-memory usage analytics, for example how often memory contributed to responses, only with local private metrics.
