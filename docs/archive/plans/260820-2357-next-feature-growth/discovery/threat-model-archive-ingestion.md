# Threat model — archive ingestion

**Date:** 2026-08-21  
**Boundary:** desktop file picker → privileged ZIP inspect → staged normalized records → atomic publish  
**Out of scope here:** model handoff (see imported-context threat model)

Attacker: malicious ZIP the user is tricked into importing, or a compromised provider export.

| ID | Threat | Impact | Mitigation (v1) | Residual |
| --- | --- | --- | --- | --- |
| A1 | Zip bomb / nested archives | Disk/CPU exhaustion, UI freeze | Rust streaming unzip; max compressed 200 MB; max expanded 2 GB; max entries; **no nested zip**; abort on amplification &gt; 20× | User can still pick a large legal export; show size before extract |
| A2 | Path traversal / symlink / `..` | Write outside staging | Reject absolute paths, `..`, symlinks, Windows `\\`, NUL; force staging dir prefix | OS-specific oddities; test on Win/macOS/Linux |
| A3 | Unsafe names | Overwrite, odd UI | Allowlist `[A-Za-z0-9._-]` for stored entry names; ignore others as skipped | Some real exports may use spaces — map to hashed names, do not use raw |
| A4 | Huge / truncated JSON | Parser DoS, OOM | Cap `conversations.json` bytes; incremental JSON or chunked parse; time budget; cancel | Need a parser that does not load 2 GB as one string in JS |
| A5 | Huge single message | Renderer hang | Cap text per message (1 MB); skip + count | Truncation must be reported, never silent |
| A6 | HTML/SVG/remote resources | XSS if previewed as HTML | v1 is text-only in React text nodes; **no** `chat.html` viewer; no `dangerouslySetInnerHTML`; skip image/SVG bytes | Markdown renderer must not follow imported `javascript:` links if we ever render markdown from import |
| A7 | Search/index exhaustion | UI jank, huge DB | No index in v1 unless envelope fails; imported SQLite (if any) has size + FTS limits; incremental insert off renderer thread | Linear scan of huge imports can still hitch — import remains desktop background |
| A8 | Secrets in logs | API keys in Sentry/logs | Content-free errors (`format_invalid`, `entry_too_large`); no message body in `appLog` | User may still paste secrets into chat |
| A9 | Partial publish | Source looks complete while truncated | Staging + checksum + atomic rename/commit; crash leaves `status=staging` never `published` | Must test kill during extract |
| A10 | Re-import / clone flooding | Disk fill | Dedup by provider conversation id + checksum; user-visible quota | Malicious unique ids still fill disk up to envelope |
| A11 | Privilege confusion | Renderer unpacks ZIP | ZIP/FS only via Platform → IPC; Web/mobile capability false | Bypass if a future UI uses JS zip libs — forbid in review |
| A12 | Attachment binaries | Path traversal, codecs, preview RCE | Skip all attachments; record count only | User may want files later — Phase 2 needs a new review |
| A13 | Reuse history-transfer importer | Whole-file `JSON.parse`; merge-by-id can overwrite live sessions | Separate inspect/publish path; never call `importHistoryTransferFile` on a vendor ZIP | |
| A14 | Execute `chat.html` | XSS via scripts / remote beacons | Do not open or preview `chat.html`; text JSON only | |

## Research-data

Follow `consent-custody-protocol.md`. A malicious participant export is treated like A1–A8.

## Phase 1 exit

Red-team the Rust inspector with the adversarial fixtures listed in `export-feasibility.md` before enabling UI import.
