---
phase: 3
title: "Desktop Project Experience"
status: pending
priority: P1
dependencies: [2]
effort: "5-7 engineering days"
---

# Phase 3: Desktop Project Experience

## Overview

Make Project context visible and easy: native Open Folder using Phase 1 picker authority, recent bound Projects from native `lastOpenedAt`, inherited chats, legacy reconnect, status/relink actions, and persistent Project identity. Keep one Projects rail; remove manual path entry from normal desktop flow.

## Requirements

### Functional

- Create a portable Project, then optionally authorize a native directory binding.
- Pick, bind, reveal, unlink, and relink through native authority only.
- New chat inherits `projectId`; runtime descriptor comes from native binding restore.
- Display ready/missing/permission/relink state.
- Desktop gets filesystem controls; web/mobile retain chat grouping only.

### Non-Functional

- Keyboard accessible and aligned with `docs/design-guidelines.md`.
- No second Workspace navigation hierarchy.
- No absolute path required or sent to model.
- Project removal never deletes the directory.

## User Flows

### Create from folder

```text
Projects + -> create/select portable Project -> native picker authorizes binding
  -> native descriptor ready -> expand row -> New Chat
```

### Missing root

```text
Project row warning -> Locate Folder | Unbind | Remove Project
Locate -> picker -> identity warning if different -> register -> ready
```

### Session

```text
Project row / header badge / composer context chip
  -> same identity and status
  -> Agent Mode independently controls mutations
```

## File Inventory

| Action | File | Purpose | Test impact |
|---|---|---|---|
| Modify | `src-tauri/src/lib.rs` | Add reveal operation; reuse Phase 1 picker/binding dispatch | Rust/manual |
| Modify | `src/renderer/platform/interfaces.ts` | Add reveal/status UX; reuse Phase 1 picker contracts | Type-check |
| Modify | `src/renderer/platform/desktop_platform.ts` | Desktop reveal/status orchestration | Platform tests |
| Modify | `src/renderer/platform/web_platform.ts` | Unsupported behavior | Regression |
| Modify | `src/renderer/platform/test_platform.ts` | Picker fixtures | Unit |
| Create | `src/renderer/components/project/ProjectDialog.tsx` | New chat-only/open-folder flow | Component tests |
| Create | `src/renderer/components/project/ProjectBadge.tsx` | Shared status identity | Component tests |
| Create | `src/renderer/components/project/ProjectMenu.tsx` | Bind/relink/reveal/unbind/remove actions | Component tests |
| Modify | `src/renderer/components/session/FolderItem.tsx` | Render Project status and new actions | UI regression |
| Modify | `src/renderer/components/session/SessionList.tsx` | Use Project source and inherited chat creation | DnD/grouping tests |
| Modify | `src/renderer/components/InputBox/ComposerToolsMenu.tsx` | Remove normal pasted-path modal; show project actions | Component tests |
| Modify | `src/renderer/components/InputBox/InputBox.tsx` | Project badge/context props, empty-state hint | Input tests |
| Modify | `src/renderer/routes/session/$sessionId.tsx` | Resolve project context once and pass descriptor | Route tests |
| Modify | `src/renderer/routes/index.tsx` | New-chat project inheritance | Route tests |
| Modify | `src/renderer/routes/quick.tsx` | Reflect project safely; no duplicate authority | Quick regression |
| Modify | `src/renderer/i18n/locales/en/translation.json` | English source copy | i18n checks |

## Function and Interface Checklist

- [ ] UI calls Phase 1 `pickAndBindProject`/`relinkProject`; it never submits a path.
- [ ] `unbindProject` revokes native binding and tombstones legacy session roots.
- [ ] Shared `ProjectBadge` state vocabulary.
- [ ] Project row actions do not duplicate business logic.
- [ ] New session helper accepts `projectId` and resolves defaults/root.
- [ ] Capability revoked before root replacement/unbind.
- [ ] Web/mobile controls hidden by platform capability, not fragile build-string checks.
- [ ] Quick shows Project metadata/status but cannot use privileged capability.
- [ ] Recent bound Projects sort from native `lastOpenedAt` without portable root storage.

## UX State Matrix

| State | Rail | Header/composer | Available actions |
|---|---|---|---|
| Chat-only | Neutral Project | “No folder” | Open Folder |
| Ready | Folder/repo status | Project name, ready | Reveal, Change, Unbind |
| Missing | Warning | Tools unavailable | Locate, Unbind, Remove |
| Permission denied | Warning | Read/write unavailable | Retry, Locate |
| Relink differs | Confirmation | No capability yet | Confirm or cancel |
| Picker cancelled | No mutation | Previous state retained | Retry |

## Test Scenario Matrix

| Priority | Scenario | Expected result |
|---|---|---|
| Critical | Change/unbind root during agent session | Old capability revoked immediately |
| High | Create directory Project/cancel picker | Correct creation/no mutation |
| High | New chat from Project | Inherits `projectId` and defaults |
| High | Move chat between Projects | Effective context updates for future turns |
| High | Missing root on restart | Explicit offline state, no tools |
| Medium | Quick window opens Project chat | Same identity, no separate stored root |
| Medium | Web/mobile | Chat-only Projects; no filesystem CTA |
| Medium | Keyboard/screen reader | All actions reachable and labelled |

## Dependency Map

- Requires Phase 2 Project repository and Phase 1 native authority.
- Blocks Phase 4 explorer discovery.
- Reuses current Projects/Recents rail; must not regress drag/drop or empty states.
- Artifact panel remains separate and unchanged.

## Implementation Steps

1. Add component tests for current New Project and Project chat inheritance.
2. Reuse Phase 1 picker/binding APIs; add reveal/status orchestration only.
3. Build unified Project create/edit/reconnect dialog and status components.
4. Migrate rail and session creation from Folder APIs to Project APIs.
5. Replace pasted path modal with Choose/Relink/Unbind actions and legacy reconnect prompt.
6. Add persistent identity to session header/composer without noisy chrome; show that shell is unavailable.
7. Implement missing, permission, and relink states.
8. Verify quick window and platform degradation.
9. Run accessibility keyboard checks and visual QA in dark/light desktop themes.

## Success Criteria

- [ ] Existing Projects section is sole navigator.
- [ ] Normal desktop flow never requires pasted absolute path.
- [ ] New Project chats inherit Project context.
- [ ] Missing/relinked roots have honest recovery.
- [ ] Root removal disables tools without deleting chats/files.
- [ ] Artifact preview is not labelled as filesystem Project context.
- [ ] Web/mobile regressions pass.

## Risk Assessment

- **High:** revocation race while generation is active. Phase 1 cancellation must finish before unbind/relink reports success.
- **Medium:** rail density regression. Reuse locked design tokens and current hierarchy.
- **Medium:** hidden platform mismatch. Centralize capability checks.

## Security Considerations

First bind shows concise disclosure: selected repository content may be sent to the chosen provider. Project-local instructions, skills/commands, and hooks use independent trust. Generic Project shell is unavailable in this MVP.

## Rollback Strategy

Disable native binding controls while retaining portable Projects and existing rail behavior. Legacy path is shown only as a reconnect hint; it never authorizes access.
