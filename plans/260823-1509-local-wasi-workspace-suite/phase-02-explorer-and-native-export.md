---
phase: 2
title: "Explorer and Native Export"
status: pending
priority: P1
dependencies: [1]
effort: "5-7 days"
---

# Phase 2: Explorer and Native Export

## Context Links

- [Plan](./plan.md)
- [`ProjectContextPanel.tsx`](../../src/renderer/components/project/ProjectContextPanel.tsx)
- [`ProjectExplorerTree.tsx`](../../src/renderer/components/project/ProjectExplorerTree.tsx)
- [`interfaces.ts`](../../src/renderer/platform/interfaces.ts)

## Overview

Make Project Explorer usable for large folders and add explicit native export outside the authorized root. “All files” means all eligible files under the selected root, subject to hard-deny, ignore, symlink, type, and resource policies.

## Requirements

### Explorer

- Lazy paged tree with loading/error/empty states.
- Search cancellation and stale-response suppression.
- File activation selects/previews; explicit control attaches/removes one-send context.
- Keyboard-accessible WAI-ARIA tree.
- Display binary/large-file metadata without reading full content.

### Export

- Export selected eligible files or an eligible Project snapshot ZIP.
- Export app-private artifacts registered by trusted native producers through opaque artifact IDs; renderer cannot register paths.
- Native save picker owns destination; renderer receives no destination path.
- Manifest preview: included/excluded count, total bytes, sensitive exclusions, truncation warnings.
- `.git`, hard-denied paths, symlinks, special files, and ignored files excluded by default.
- Platform-defined overwrite behavior; existing destination preserved on cancel/error/ENOSPC.
- Atomic final rename where supported; cancellation distinct from success/failure.
- Desktop only; web/mobile explicitly unsupported for Project export.

## Architecture

```text
ExportSource
  ├─ ProjectSelection(capability, relative paths | snapshot)
  └─ AppArtifact(opaque artifactId issued by native producer)
   → export:prepare(source)
   → native manifest + expiry token
   → user confirmation + native Save As
   → export:save(token)
   → stream directly to destination temp file
   → fsync/rename → saved | cancelled | error
```

Use existing desktop `zip` and `rfd` dependencies. Do not stream archives through renderer memory.

## File Inventory

| Action | File | Change | Test impact |
|---|---|---|---|
| Create | `src/shared/types/workspace-export.ts` | Manifest/result/error schemas | Schema tests |
| Create | `src-tauri/src/workspace/export.rs` | Manifest, picker, ZIP streaming, atomic finalize | Rust export tests |
| Create | `src/renderer/components/project/ProjectExportDialog.tsx` | Review/confirm UX | Component tests |
| Create | `src/renderer/components/project/ProjectExportDialog.test.tsx` | Cancel/success/a11y | Vitest |
| Modify | `src-tauri/src/workspace/mod.rs` | Prepare/export/discard channels | IPC tests |
| Modify | `src-tauri/src/workspace/authority.rs` | Export lease and snapshot validation | Rust tests |
| Modify | `src/renderer/platform/interfaces.ts` | Typed export methods | Platform tests |
| Modify | `src/renderer/platform/desktop_platform.ts` | Narrow native export adapter | Platform tests |
| Modify | `src/renderer/platform/web_platform.ts` | Explicit unsupported | Platform tests |
| Modify | `src/renderer/platform/test_platform.ts` | Deterministic fixtures | UI tests |
| Modify | `src/renderer/components/project/ProjectContextPanel.tsx` | Paging, cancellation, selection, export entry | UI tests |
| Modify | `src/renderer/components/project/ProjectExplorerTree.tsx` | Tree semantics and explicit attach | UI tests |
| Modify | `src/renderer/static/globals.css` | Tree/export states | Visual/manual |
| Modify | `test/integration/project-workspace/project-workspace.test.ts` | Paging, attach, export lifecycle | Integration |

## Interface Checklist

- [ ] `prepareWorkspaceExport(capabilityId, selection)` returns opaque manifest ID.
- [ ] `prepareAppArtifactExport(artifactId)` accepts only native-issued artifact IDs and never renderer paths.
- [ ] Manifest binds project, root generation, revisions, exclusions, counts, bytes, expiry.
- [ ] `exportWorkspace(manifestId)` opens native Save As and returns `saved | cancelled | conflict | error`.
- [ ] `discardWorkspaceExport(manifestId)` releases retained state.
- [ ] Explorer uses generation-bound last-name cursors (not mutable offset cursors), detects invalidation, and cancels stale operations.
- [ ] File row selection and context attachment are independent actions.

## Implementation Steps

1. Add paging/cancellation tests before changing Explorer behavior.
2. Replace offset pagination with generation-bound last-name cursors; invalidate on directory mutation and drop stale responses.
3. Add accessible tree navigation: arrows, Enter select, Space attach/remove.
4. Define export selection and manifest schemas with strict quotas.
5. Implement native manifest walk using the same authority/ignore policy as Explorer.
6. Present manifest before opening Save As; require exact user confirmation for snapshot export.
7. Stream through retained no-follow source handles into a same-directory destination temp file; hash/revalidate while reading.
8. Add an app-private artifact registry interface for native producers (later WASI runs); artifact IDs bind owner, bytes/hash, filename, MIME, expiry, and cleanup.
9. Define Windows/macOS/Linux collision and atomic-replacement behavior; preserve existing destination on cancellation, ENOSPC, or crash.
10. Detect revision/root-generation changes during prepare and streaming; require prepare again.
11. Normalize archive entry names losslessly/safely, including non-UTF source names; reject duplicates after normalization.
12. Update UI copy to “Project Files,” “Export selected,” and “Export safe snapshot.”

## Test Scenario Matrix

| Priority | Scenario | Expected |
|---|---|---|
| Critical | Renderer provides destination or app-artifact source path | API has no such parameter; opaque native ID only |
| Critical | Symlink/special file in selection | Excluded/rejected, never followed |
| Critical | `.git` or `.env` selected indirectly | Hard denied |
| High | Destination under source root | Rejected to prevent recursive export |
| High | Source revision changes after manifest | Conflict; no stale export |
| High | Export cancelled | No success toast; manifest disposable |
| High | Huge/deep folder | Quotas stop manifest/export cleanly |
| Medium | Insert/delete between pages or exactly 200 entries | Cursor invalidates or returns stable non-duplicated pages |
| High | Source mutates during ZIP stream | Abort; destination preserved |
| High | Existing destination, ENOSPC, crash | Existing file preserved; temp recoverable/cleaned |
| Medium | Non-UTF/colliding archive names | Safe deterministic representation or explicit rejection |
| Medium | Keyboard-only attach/export | Fully operable with visible focus |

## Dependency Map

- Depends on Phase 1 budgets, leases, and error contracts.
- Independent of Phase 3 after Phase 1.
- Export result model reused by Phase 5 run artifacts.

## Success Criteria

- [ ] User can browse every eligible file without first-page truncation.
- [ ] Clicking a file no longer silently attaches it.
- [ ] Native export never exposes destination paths to renderer/model.
- [ ] Export manifest clearly reports exclusions and size.
- [ ] ZIP memory stays bounded and partial files are cleaned.
- [ ] Explorer meets keyboard and screen-reader acceptance cases.

## Risk Assessment

- **User expects literally every file:** copy states that protected/ignored files are excluded.
- **ZIP bomb/resource use:** enforce count, size, depth, time, and compression limits.
- **TOCTOU:** bind manifests to generation and file revisions; abort on mismatch.

## Security Considerations

Export is a new write authority outside the Project root. Only the native picker grants the one-time destination; no reusable broad destination capability is returned to renderer.
