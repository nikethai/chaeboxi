---
phase: 4
title: "Project Context Explorer"
status: pending
priority: P2
dependencies: [3]
effort: "6-8 engineering days"
---

# Phase 4: Project Context Explorer

## Overview

Add a read-only Project Context surface: lazy tree, filename and bounded literal search, text preview, one-send explicit context selection, and visible project instruction discovery. No persistent semantic index or background whole-repository ingestion.

## Requirements

### Functional

- Lazy paged listing and bounded filename/literal content search.
- Text metadata/preview with revision, encoding and truncation state.
- One-send file/excerpt draft; successful send records copied excerpt plus provenance in message history.
- Detect supported instruction sources but activate only after instructions-category trust.
- Native request IDs support cancel, timeout and stale-result rejection.

### Non-Functional

- Renderer never recursively walks the filesystem.
- Hard exclusions and `.gitignore` apply consistently.
- No absolute host path where relative path suffices.
- Aggregate selected context: max 20 entries and 512 KiB before normal token limits; show provider disclosure before send.
- Artifact preview remains separate.

## Architecture

```text
ProjectContextPanel
  -> React Query {projectId, rootGeneration, relativePath, cursor}
  -> workspace request {requestId, capabilityId, limits}
  -> native handle-relative list/read/search
  -> cancelWorkspaceRequest(requestId)
```

### Selected Context Lifecycle

1. Selection creates ephemeral per-session composer draft, scoped to one send.
2. Draft stores project ID, root generation, relative path, revision, selected range and bounded copied excerpt.
3. On pre-send revision mismatch: prompt Refresh or Remove; never silently send stale content.
4. Before remote provider call, show aggregate bytes/tokens and “selected local content will be sent to {provider}.”
5. After successful send, clear draft and persist the copied excerpt/provenance in message content so history is stable.
6. Project switch/unbind clears the draft.
7. Invalid UTF-8/binary files cannot preview or attach as text.

### Instruction Trust

- Discover `AGENTS.md`, `CLAUDE.md`, and supported Cursor rule files as visible sources.
- “Read instructions” trust is independent from skills/commands and hooks.
- Enabled instruction text enters bounded model context; it cannot override host/system safety or enable automation.
- Relink/root identity change resets trust and caches.

### Implementable Ignore Policy

Hard deny for explorer/search/context:

- `.git/` contents, `.env`, `.env.*`.
- `*.pem`, `*.key`, `id_rsa*`, `id_ed25519*`.
- `.ssh/`, `.gnupg/`, `.aws/`, `.kube/`, `.docker/`, `.config/gcloud/`.
- sockets, devices, non-regular files, and directory symlinks.

Then honor nested `.gitignore`. For non-git repositories, default-skip `node_modules/`, `dist/`, `build/`, `.next/`, `coverage/`, common caches. User-defined exclusions are deferred; no include override in this plan.

## File Inventory

| Action | File | Purpose | Test impact |
|---|---|---|---|
| Modify | `src-tauri/Cargo.toml` | Add `ignore` crate after bounded traversal spike | Cargo build |
| Modify | `src-tauri/src/workspace.rs` | List/read/search, limits, cancellation, ignore policy | Rust tests |
| Modify | `src-tauri/src/lib.rs` | Dispatch context/cancel APIs | IPC tests |
| Modify | `src/renderer/platform/interfaces.ts` | Relative contracts, cursors, request IDs | Type-check |
| Modify | `src/renderer/platform/desktop_platform.ts` | Context/cancel adapter | Unit |
| Modify | `src/renderer/platform/test_platform.ts` | Tree/search/revision fixtures | Component tests |
| Modify | `src/renderer/platform/web_platform.ts` | Unsupported behavior | Regression |
| Create | `src/renderer/components/project/ProjectContextPanel.tsx` | Context shell/states | Component tests |
| Create | `src/renderer/components/project/ProjectFileTree.tsx` | Flattened lazy tree | Component tests |
| Create | `src/renderer/components/project/ProjectFilePreview.tsx` | Preview/range selection | Component tests |
| Create | `src/renderer/components/project/ProjectContextSearch.tsx` | Filename/content search | Component tests |
| Create | `src/renderer/components/project/project-context.test.tsx` | UI/lifecycle matrix | Unit |
| Modify | `src/renderer/routes/session/$sessionId.tsx` | Mount distinct Project Context surface | Route tests |
| Modify | `src/renderer/stores/uiStore.ts` | Ephemeral per-session context drafts and separate artifact state | Store tests |
| Modify | `src/renderer/components/Artifact.tsx` | Preserve artifact panel behavior/terminology | Artifact tests |
| Modify | `src/renderer/pages/PictureDialog.tsx` | Preserve Mermaid/artifact references | Visual regression |
| Modify | `src/renderer/packages/model-context/index.ts` | Add bounded explicit excerpt and provenance | Context tests |
| Modify | `src/renderer/components/InputBox/InputBox.tsx` | Draft chips, size/provider disclosure | Input tests |
| Modify | `src/shared/types/session.ts` | Message provenance shape only if existing attachments cannot represent it | Schema tests |

## Function and Interface Checklist

- [ ] Opaque paging cursor bound to capability/root generation/query.
- [ ] `listWorkspaceChildren`, `searchWorkspace`, `readWorkspaceText`, `cancelWorkspaceRequest`.
- [ ] Native timeout owns recursive work; renderer abort sends cancel request.
- [ ] Stale results ignored when request, capability or generation changes.
- [ ] One shared ignore evaluator for list/search/instruction discovery.
- [ ] Binary/encoding sniff and strict file/aggregate limits.
- [ ] `ProjectContextDraft` one-send lifecycle and revision preflight.
- [ ] Message provenance records project ID, relative path, revision/range, not absolute path.
- [ ] Artifact `WorkspacePanel` visible copy becomes “Artifact Studio”; internal rename is optional and must be atomic if chosen.

## Test Scenario Matrix

| Priority | Scenario | Expected result |
|---|---|---|
| Critical | Hard-denied credential file | Never listed/searched/read/attached |
| Critical | Symlink directory outside root | Never traversed |
| High | Search cancelled/timed out | Native work stops; stale page ignored |
| High | Revision changes before send | Refresh/remove prompt |
| High | Project switch/unbind | Draft/caches clear |
| High | Remote/local provider disclosure | Correct destination shown before send |
| High | 21 files or >512 KiB | Selection blocked with clear limit |
| High | Invalid UTF-8/binary/oversized | Metadata only, no text context |
| Medium | Artifact and Project panels coexist | No state/name collision/regression |

## Performance Budgets

- Project shell from metadata p95 <100 ms.
- Root restore/validation p95 <250 ms.
- First normal directory page p95 <500 ms.
- Search produces page/progress within 1 second.
- Preview max 1 MiB; searchable text file max 5 MiB; default results 100.

## Dependency Map

- Requires Phase 3 UI and Phase 1 authority.
- Supplies revision-bearing reads to Phase 5.
- No KB/RAG, watcher, Git or worktree dependency.

## Implementation Steps

1. Write native policy, encoding, paging, cancellation and stale-generation tests.
2. Add request/cursor/error schemas and native timeout/cancel registry.
3. Implement handle-relative lazy listing and bounded ignore-aware search.
4. Build panel/tree/search/preview with explicit states.
5. Implement one-send draft, token/byte limits, revision preflight and provider disclosure.
6. Persist sent excerpt provenance without absolute roots.
7. Add instruction discovery and independent trust enablement.
8. Rename visible artifact terminology; avoid unnecessary internal file rename unless all callers move in one commit.
9. Validate large fixtures and panel coexistence.

## Success Criteria

- [ ] Browse/search works without persistent repository indexing.
- [ ] Hard-denied secrets cannot enter context.
- [ ] Selected context is explicit, bounded, one-send and provider-disclosed.
- [ ] Revision mismatch cannot silently send stale text.
- [ ] Cancellation stops native work and stale results cannot render.
- [ ] Instructions require separate trust and cannot enable hooks.
- [ ] Artifact behavior remains unchanged.

## Risk Assessment

- **High:** secret exposure. Hard deny and native policy tests.
- **High:** stale/local content sent remotely. Revision preflight and disclosure.
- **High:** recursive work leak. Native request cancellation/timeouts.
- **Medium:** instruction injection. Category trust and host-policy precedence.

## Security Considerations

Treat filenames/content/instructions as untrusted. Escape UI text. Never allow instruction trust to imply command/hook trust. Absolute roots remain local-only.

## Rollback Strategy

Disable explorer/context flags and cancel outstanding native requests. Preserve secure Project bindings and chat-only behavior.
