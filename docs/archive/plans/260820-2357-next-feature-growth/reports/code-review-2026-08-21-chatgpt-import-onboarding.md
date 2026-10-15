# Code Review — ChatGPT import onboarding (copy/UX slice)

**Date:** 2026-08-21
**Score:** 7/10
**critical_count:** 0
**Reviewer focus:** correctness, UX regressions, i18n misuse, scope creep
**Slice:** copy/UX only; no new IPC; no ZIP parser changes
**Plan:** [../plan.md](../plan.md) (no dedicated onboarding phase file)

## Code Review Summary

### Scope
- Files reviewed:
  - `src/renderer/modals/ImportChatGptArchive.tsx`
  - `src/renderer/packages/imported-history/import-user-errors.ts`
  - `src/renderer/packages/imported-history/import-user-errors.test.ts`
  - `src/renderer/packages/imported-history/index.ts`
  - `src/renderer/packages/imported-history/import-archive.ts`
  - `src/renderer/pages/SearchDialog.tsx` (Import ChatGPT command item)
  - `src/renderer/components/common/AdaptiveModal.tsx`
  - Mapper contract (read-only): `src-tauri/src/imported_archive.rs`, `src/shared/imported-history/zip-bytes.ts`, `src/renderer/i18n/index.ts`
- Lines of code analyzed: ~250 (modal + mapper + tests + search item)
- Review focus: ChatGPT import onboarding copy/UX slice
- Updated plans: none (no slice plan file; Phase 1 still gated in `plan.md`)

### Overall Assessment

Onboarding copy and entry path match the slice. Modal coaches official Settings → Data controls → Export, opens chatgpt.com + OpenAI help via `platform.openLink`, stays open after pick/success/error, Choose ZIP still calls `importChatGptArchiveUsingPicker(platform)`. Search subtitle is exact. No login/scraper, no unzipped JSON ingest, no new Tauri commands in these files.

Must-fix: mapper tests synthetic codes (`oversize:…`, `too_many_entries`) but inspect throws `message`, not `code`. Archive-level oversize / too-many-entries therefore leak internals. i18n wraps that runtime string in `t()`.

### Spec compliance

| # | Requirement | Status | Evidence |
|---|-------------|--------|----------|
| 1 | Coach official OpenAI export (chatgpt.com Settings → Data controls → Export) | PASS | `ImportChatGptArchive.tsx:48-53` |
| 2 | Open ChatGPT + help via `platform.openLink`; modal stays open | PASS | `ImportChatGptArchive.tsx:9-10,29-41,59-64` — no `modal.hide()` on pick/link |
| 3 | Choose ZIP uses `importChatGptArchiveUsingPicker(platform)` | PASS | `ImportChatGptArchive.tsx:29` |
| 4 | Map not_zip / missing conversations.json / oversize / zip_slip / nested_archive to one-sentence copy | FAIL | oversize archive-level + too_many_entries actual messages unmapped; others map |
| 5 | Search command subtitle `Needs an OpenAI data-export ZIP` | PASS | `SearchDialog.tsx:111` |
| 6 | No ChatGPT login/scraper, no unzipped JSON ingest, no new Tauri commands | PASS | listed files only; picker + existing inspect |

### Critical Issues

None (no security break, data loss, or new privileged IPC).

### High Priority Findings

1. **Oversize / too-many-entries user copy misses real inspect messages** — must-fix
   - `import-user-errors.ts:28-29` matches `oversize` / `too_many_entries`
   - Inspect throws `inspected.message` (`import-archive.ts:21-22`), not `code`
   - Desktop/JS archive-level oversize message is `compressed archive exceeds limit` (`imported_archive.rs:41`, `zip-bytes.ts:162`)
   - too-many-entries message is `too many zip entries` (`imported_archive.rs:46`, `zip-bytes.ts:173`)
   - Entry-level `oversize:{name}` still maps; the 200MB compressed-archive path (real ChatGPT exports) does not
   - Tests only cover synthetic strings (`import-user-errors.test.ts:16-20`)
   - Fix: match those messages (and/or `code` / `too many zip` / `exceeds limit`). Prefer throwing `code` plus message, or map `{ok:false,code}` if present. Add tests with the real inspect strings.

2. **`t(describeImportedArchiveError(error))` is i18n misuse** — must-fix for unknown path
   - `ImportChatGptArchive.tsx:39`
   - Mapped copy lives in consts, not `t('…')`, so i18next-parser will not extract (`i18next-parser.config.mjs` only sees static `t()`; `for-key-scan.ts` exists for this exact case)
   - Unknown inspect errors (`inspect failed`, `stat failed:…`, `truncated central directory`) become i18n keys
   - `src/renderer/i18n/index.ts:70-72` sets `interpolation.escapeValue: false`
   - Fix: mapper returns a kind; modal uses static `t('This is not a ZIP…')` etc. Unknown → `t('Import failed')`. Register keys in `for-key-scan.ts` if kinds stay dynamic.

3. **Success copy uses message count, no unit**
   - `ImportChatGptArchive.tsx:33-37` interpolates `result.source.importedCount`
   - That field is user+assistant **messages**, not conversations (`chatgpt-normalize.ts:161`)
   - User sees `Imported 12847.` then “search for a conversation title”
   - Fix: `result.source.conversations.length` + noun, e.g. `Imported {{count}} conversations. Search (⌘K)…`

### Medium Priority Improvements

4. **Error vs success share one unstyled `<Text>`** — `ImportChatGptArchive.tsx:66`. No color, role, or `aria-live`. Easy to miss failure after a long picker.

5. **Unmapped inspect failures leak internals** — truncated / stat / open / path-not-file. Slice listed five codes; remaining should still be one user sentence, not rust/js text.

6. **Substring matcher is order-fragile** — `not_zip` before `nested_archive`, so `nested_archive:not_zip.zip` would get the ZIP copy. Prefer code tokens / prefixes.

7. **No modal/openLink/stay-open test.** Mapper unit tests only. Slice is UX; no proof modal stays open or that links do not `hide()`.

### Low Priority Suggestions

8. Intro “OpenAI emails you a ZIP” omits SMS; step 2 includes it (`ImportChatGptArchive.tsx:48` vs `:51`). Help article: email or SMS, up to 7 days.

9. Success/search chrome hardcodes `⌘K` (matches Sidebar; Windows is Ctrl+K / `mod+k`).

10. Import command sits in the Search group between current-session and all-conversations (`SearchDialog.tsx:178`). Subtitle helps; group is still “Search”.

11. `AdaptiveModal.CloseButton` is null on small layout (`AdaptiveModal.tsx:122-124`). Capability is desktop; a narrow window becomes a drawer without footer Close. Overlay still closes.

12. Reopen keeps prior `status` (NiceModal `hide`, not remount). Stale error on next open. Reset on open if that is unwanted.

### Positive Observations

- Official help URL `https://help.openai.com/en/articles/7260999-exporting-your-chatgpt-history-and-data` matches current OpenAI article (profile → Settings → Data controls → Export → Confirm export).
- Links are `platform.openLink`, not `<a href>` / `window.open`. Same pattern as Codex settings.
- Native picker filter remains ZIP (`lib.rs` `pickImportedArchive`); modal does not add JSON ingest.
- Desktop gate: Search item + `onPick` check `supportsImportedArchives` (`capabilities.ts:49`).
- Cancelled picker: `importChatGptArchiveUsingPicker` returns `null`; modal stays open, busy cleared.
- Work/Team/Enterprise note matches export-feasibility (no Export on Business/Enterprise). Extra coaching, not scope creep.
- `zip_slip` / `nested_archive` share one safe sentence; filenames not shown. Good.
- Scope held: no new IPC, no zip-bytes/policy edits in this slice; picker API unchanged.

### Recommended Actions

1. Map real inspect messages `compressed archive exceeds limit` and `too many zip entries` (and `not a zip archive` already covered) in `describeImportedArchiveError`. Test those strings.
2. Stop `t()` on unknown inspect text. Static `t()` keys for the four user sentences; generic `Import failed` else.
3. Success line: conversation count + noun, not raw `importedCount`.
4. Style status as error vs success; `aria-live="polite"`.
5. Optional: reset status when modal opens; map truncated/stat to generic fail.

### Task completeness

- [x] Official export coaching
- [x] Open ChatGPT + How to export via `platform.openLink`; modal stays open
- [x] Choose ZIP → `importChatGptArchiveUsingPicker(platform)`
- [ ] All listed errors → one-sentence user copy (**oversize archive-level miss**)
- [x] Search subtitle
- [x] No scraper / unzipped JSON / new Tauri commands
- [x] `import-user-errors` exported from package index
- Remaining TODOs in these files: none

### Next steps

1. Fix mapper + tests against rust/JS `message` values (must).
2. Fix `t()` dynamic keys (must).
3. Fix success count noun (should).
4. Re-run `pnpm test -- src/renderer/packages/imported-history/import-user-errors.test.ts`.
5. Do not open Phase 1 in `plan.md` from this slice; field-work gate unchanged.

### Metrics
- Type Coverage: not measured (`pnpm check` not run this session)
- Test Coverage: mapper 5 cases; 0 modal/i18n/openLink tests; oversize archive-level untested
- Linting Issues: not run this session

### Verification

| Gate | Status |
|------|--------|
| Read listed files + inspect message contract | Passed |
| `pnpm test -- src/renderer/packages/imported-history/import-user-errors.test.ts` | Not run |
| `pnpm lint` / `pnpm check` | Not run |
| Git diff / IPC rust change audit | Not run (no shell); listed files show no new commands |

### Unresolved questions

- None that block the review. Confirm whether success copy should count conversations or messages (recommend conversations).
