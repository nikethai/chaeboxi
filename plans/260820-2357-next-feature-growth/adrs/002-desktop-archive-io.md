# ADR 002 — Desktop archive I/O and staged publication

**Status:** Accepted (discovery)  
**Date:** 2026-08-21

## Decision

Large/archive-unsafe work runs behind `Platform` on desktop:

```text
native file picker (existing Tauri dialog)
  → ipc inspectImportedArchive(path)
  → size/type/entry validation
  → staging dir (app data / import-staging / {jobId})
  → adapter.normalize (pure TS or Rust, streaming)
  → reconciliation report (counts only in UI logs)
  → ipc publishImportedArchive(jobId)   # atomic
  → delete staging
```

Cancel deletes staging. Crash leaves `status=staging` which is invisible to search.

## Platform surface (Phase 1)

Add capability `importedArchives` (desktop true, web/mobile false).

Commands stay on the existing `ipc_invoke` multiplexer. Do not add a second IPC bus.

Renderer owns progress UI and the report. Renderer must not use JS zip libraries on the user-selected path.

## Limits (candidate envelope; tune after a real ZIP)

- Compressed ≤ 200 MB
- Expanded ≤ 2 GB
- Amplification ≤ 20×
- Entry count cap
- No nested archives
- `conversations.json` byte cap
- Disk-space check before extract (headroom 2× expanded + 1 GB)

## Adapters

Pure detection/normalization: `chatgpt-conversations-vN`. Input is already-validated entry bytes or a streaming reader from Rust. Output is Imported* records + skip/fail reasons.

## Rejected

- Unzip in the renderer
- Parse `chat.html` as the source of truth (XSS, incomplete)
- Auto-import on file drop of arbitrary zip
