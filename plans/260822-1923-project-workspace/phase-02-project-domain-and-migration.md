---
phase: 2
title: "Project Domain and Migration"
status: pending
priority: P1
dependencies: [1]
effort: "5-7 engineering days"
---

# Phase 2: Project Domain and Migration

## Overview

Rename and evolve chat folders into Projects while separating portable Project metadata from desktop-local native bindings. Migrate IDs, order, emoji compatibility and default agents. Legacy session roots are never auto-authorized: affected users receive an explicit reconnect flow through the native picker.

## Requirements

### Functional

- Introduce `ProjectSchema` and `Session.projectId` with dual-read/write compatibility.
- Preserve existing chat-only Project behavior and all Folder data.
- Keep desktop root path, filesystem identity, capability and trust outside shared/exported Project metadata.
- Detect legacy sessions with `workspaceRoot` lazily when loaded and mark `legacy-reconnect-required`.
- Add category-specific repository trust, invalidated on identity/relink change.

### Non-Functional

- Idempotent, journaled metadata migration.
- No startup scan/deserialization of all message bodies.
- Explicit `projectId` suppresses legacy-root fallback.
- One compatibility release supports in-version feature rollback and legacy chat grouping; directory bindings are not promised to older binaries.

## Authoritative State Model

### Portable Renderer Project Metadata

```ts
const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  emoji: z.string().optional(),
  defaultCopilotId: z.string().optional(), // migration read only
  defaultAgentId: z.string().optional(),
  order: z.number(),
})
```

No `kind` or root path is needed: a Project is directory-backed on this device only when the native binding registry has a valid binding.

### Native Device-Local Binding

```text
ProjectBinding
  projectId
  displayPath
  filesystemIdentity
  rootGeneration
  status
  lastOpenedAt
  trust:
    files: allowed|denied|unset
    instructions: allowed|denied|unset
    skillsCommands: allowed|denied|unset
    hooks: allowed|denied|unset
```

Shell hooks remain disabled in MVP even if `hooks` trust is granted.

### Resolver Truth Table

| Session state | Project state | Effective result |
|---|---|---|
| `projectId` set | Valid native binding | Ready descriptor |
| `projectId` set | No/missing binding | No filesystem context; never fall back to session root |
| `projectId` set | Relink/permission state | Explicit unavailable state |
| No `projectId`, legacy `workspaceRoot` | Any | `legacy-reconnect-required`; no capability |
| No project/root | — | Chat only |

On move, unbind, or successful reconnect, clear/tombstone `workspaceRoot` so stale authority cannot resurrect.

## Migration and Compatibility Strategy

1. Journal states: `not-started -> projects-written -> sessions-dual-written -> committed`.
2. Convert each Folder to Project with same ID/name/emoji/order/default fields.
3. Dual-write `MyProjects` and `MyFolders` metadata for one compatibility release.
4. When a session is next created/updated/loaded, set `projectId = folderId` and dual-write `folderId = projectId`.
5. Do not scan all sessions for roots. A loaded legacy root produces reconnect UX; user picks/authorizes a folder natively.
6. Reconnect may bind the current Project or create/select another Project only after explicit confirmation.
7. New directory binding exists only in native storage; older binaries see chat grouping but no directory capability.
8. Migration commit marker is written last. Rerun repairs incomplete stages deterministically.
9. Do not delete old keys/fields in this plan.

## File Inventory

| Action | File | Purpose | Test impact |
|---|---|---|---|
| Modify | `src/shared/types/session.ts` | Project schema, compatibility Folder alias, `projectId`, meta | Schema/type tests |
| Modify | `src/renderer/storage/StoreStorage.ts` | `MyProjects` and migration journal keys | Storage tests |
| Modify | `src/renderer/platform/storages.ts` | Valid keys and cross-window persistence decision | Storage migration |
| Modify | `src/renderer/platform/desktop_platform.ts` | Store Projects in shared desktop file storage if required | Main/Quick tests |
| Create | `src/renderer/hooks/useProjects.ts` | Project CRUD plus compatibility dual-write | Unit |
| Modify | `src/renderer/hooks/useFolders.ts` | Compatibility adapter during release | Existing UI |
| Create | `src/renderer/projects/project-migration.ts` | Journaled metadata transform | Unit |
| Create | `src/renderer/projects/project-migration.test.ts` | Crash-stage/idempotency fixtures | Unit |
| Create | `src/renderer/projects/project-context.ts` | Resolver truth table and reconnect state | Unit |
| Create | `src/renderer/projects/project-context.test.ts` | Stale fallback regression | Unit |
| Modify | `src/renderer/stores/migration.ts` | Run journaled migration | Existing suite |
| Modify | `src/renderer/stores/migration.test.ts` | Dual-write/crash/rerun tests | Regression |
| Modify | `src/renderer/stores/session/crud.ts` | Dual-write session assignment | Session tests |
| Modify | `src/renderer/stores/sessionHelpers.ts` | `projectId` metadata projection | Rail/search |
| Modify | `src/renderer/stores/chatStore.ts` | Lazy loaded-session migration/reconnect marker | Store tests |
| Modify | `src/renderer/stores/historyTransfer.ts` | Project/root privacy and compatibility | Transfer tests |
| Modify | `src/renderer/components/session/SessionList.tsx` | Project APIs and dual-read | UI |
| Modify | `src/renderer/components/session/SessionItem.tsx` | Move/assignment uses Project IDs | UI |
| Modify | `src/renderer/components/session/FolderItem.tsx` | Compatibility rename path | UI |
| Modify | `src/renderer/components/session/session-list-helpers.ts` | Project DnD IDs/names | Unit |
| Modify | `src/renderer/components/session/session-list-helpers.test.ts` | DnD compatibility | Unit |
| Modify | `src/shared/room-pack.ts` | Privacy invariant | Unit |
| Modify | `src/shared/room-pack.test.ts` | Root/binding/capability absence | Unit |

## Function and Interface Checklist

- [ ] `ProjectSchema` preserves existing Folder fields.
- [ ] Compatibility `Folder` type/export strategy documented.
- [ ] `SessionSchema.projectId`, `SessionMetaSchema.projectId`.
- [ ] `getEffectiveProjectId` dual-read.
- [ ] `resolveProjectContext` implements truth table exactly.
- [ ] `useProjects` dual-writes Project/Folder metadata for compatibility window.
- [ ] Session create/move dual-writes project/folder IDs.
- [ ] Native trust categories persist by filesystem identity and reset on relink/identity change.
- [ ] Main and Quick read the same Project metadata store; Quick receives no privileged capability.
- [ ] History transfer/room pack never export native binding/trust/capability.

## Test Scenario Matrix

| Priority | Scenario | Expected result |
|---|---|---|
| Critical | Explicit Project with stale legacy root | No fallback/no capability |
| Critical | Tampered renderer Project metadata | Cannot create native binding |
| Critical | Crash at each migration journal stage | Rerun reaches one deterministic state |
| High | Folder-only install | IDs/order/emoji/defaults preserved |
| High | Legacy root session loaded | Reconnect required; no silent grant |
| High | Move/unbind | Legacy root tombstoned; selected context/trust/capability cleared |
| High | Main/Quick windows | Same Project metadata, Quick unprivileged |
| High | History export/import/room pack | No native binding/capability; legacy root handled by existing privacy policy |
| Medium | Deprecated default copilot | Preserved/migrated to default agent |
| Medium | Older binary opens data | Chat grouping remains; directory capability unavailable |

## Dependency Map

- Requires Phase 1 native binding/trust registry.
- Blocks Phase 3 UX and all Project context.
- Preserves implemented Projects/Recents navigation.
- Does not need full session scans, semantic indexing, or root canonicalization in renderer.

## Implementation Steps

1. Write current Folder/session serialization and cross-window regression tests.
2. Add portable `ProjectSchema`, compatibility aliases and session/meta fields.
3. Decide/implement shared desktop file persistence for Project metadata across main/Quick.
4. Implement journaled Folder-to-Project metadata migration and dual-write adapters.
5. Implement lazy loaded-session assignment and `legacy-reconnect-required` without auto-root conversion.
6. Implement resolver truth table and stale-root tombstoning on move/unbind/reconnect.
7. Add native trust category contracts and invalidation rules.
8. Update DnD, history transfer, room pack and privacy tests.
9. Run migration from each intermediate journal state twice.

## Success Criteria

- [ ] Existing Project metadata and chat assignments are preserved.
- [ ] Project metadata is shared across main/Quick without granting Quick capability.
- [ ] Legacy roots never auto-authorize or resurrect after explicit Project assignment.
- [ ] Migration is crash-recoverable and idempotent.
- [ ] Chat grouping dual-write supports one compatibility release.
- [ ] Native bindings/trust/capabilities never export or sync.
- [ ] Trust resets on root identity change.

## Risk Assessment

- **High:** multi-store crash consistency. Journal, commit ordering, rerun tests.
- **High:** legacy-root product friction. Clear reconnect UX; prioritize safety.
- **Medium:** dual-write drift. One repository API owns all writes and invariant tests.

## Security Considerations

Reading instructions, enabling skills/commands, and trusting hooks are independent categories. Trust is native device-local state bound to root identity; global settings do not trust a newly selected repository.

## Rollback Strategy

Same-version flags can use dual-written chat metadata and disable native bindings. Older binaries retain chat grouping only. No promise that newly authorized directory bindings work after binary downgrade.
