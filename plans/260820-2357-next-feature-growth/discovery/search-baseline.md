# Linear history-search baseline

**Date:** 2026-08-21  
**Code:** `src/renderer/packages/history-search/linear-scan.ts`  
**Caller:** `searchSessions` in `src/renderer/stores/sessionHelpers.ts`

## Algorithm

```text
escape metacharacters → case-insensitive RegExp
if current-session: load one session:* key, match, emit
else:
  load chat-sessions-list
  for each meta (sorted, hidden skipped):
    await storage.getItem(session:id)
    match messages newest-first, then threads newest-first
    emit session clone with matching messages only
    stop when matching message count ≥ 50
```

Desktop `session:*` keys are file-backed (`needStoreInFile`). Search is therefore **serial IPC**, not a hot in-memory index.

## What is not searched

- `messageForksHash` (forks)
- tool-call / image parts (`getMessageText` is text + optional `[image]`)
- imported vendor archives (do not exist yet)
- session **names** (titles are not searched)
- **hidden** sessions (skipped via `sortSessions`)
- **archived** sessions **are** searched today

## UI bug (do not "fix" as an index)

`SearchDialog.onSearchClick` fires `searchSessions` without `await` and clears `loading` immediately. Perceived search time ≠ scan time.

## Measurements

Unit test `linear-scan.test.ts` builds 10k messages in one session and asserts match &lt; 200 ms. Full-file run (2026-08-21, this machine): that test file **32 ms** including Unicode/fork/tool cases.

This is **CPU-only**. It does **not** include:

- hundreds of `getStoreValue` IPC calls
- JSON parse of large sessions
- renderer batching

Until a volunteer desktop profile is timed, treat **I/O + parse** as the unknown. Candidate: if 2k sessions make warm search p95 &gt; 200 ms, Phase 2 may add a disposable FTS index. If not, keep the linear scan.

## Unicode / ranking

- JS `RegExp` + `i` flag; no NFC normalization today
- No ranking: emission order is session-list order (pinned first via `sortSessions`) then newest matching messages inside a session
- v1 filters (provider/date) are **not** implemented; do not add them until discovery shows they are used

## Index decision

**Do not choose FTS5 / KB SQLite / memory inverted index in Phase 0.** See ADR 003.
