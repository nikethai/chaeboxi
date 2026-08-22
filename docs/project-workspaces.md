# Project Workspaces

Chaeboxi Projects group chats and, on desktop, may bind to one user-authorized directory.

## Authority

- Portable Project metadata (`MyProjects`) has no filesystem root.
- Directory access is granted only by the native folder picker or restore of a private native binding record.
- Runtime capabilities are bound to project ID, owner window (`main` only), and root generation.
- Quick, web, and mobile cannot use privileged bind/read/mutate APIs.
- Broad renderer `fs:*` and `execute_command` channels are unavailable. Generic Project shell is disabled.

## Context

- Explorer listing, search, and attach are ignore-aware and hard-deny secrets (`.env`, keys, `.git/`, etc.).
- On desktop, a Project chat may show a full-height file tree beside chat. Unfiled Recents chats do not get an explorer column. It is not a chip above the composer.
- Selected context is a one-send draft: max 20 entries and 512 KiB, with revision preflight and provider disclosure.
- Artifact Studio is a separate right-hand preview pane and is not filesystem Project context.

## Mutation

- Create/edit/delete require an expected revision and concrete per-operation approval.
- Native replacement rejects 0 or >1 `oldString` matches.
- Failed writes leave the original file intact.
- Mutation can be disabled independently of explorer and directory UX.

## Trust

Instructions (`AGENTS.md`, `CLAUDE.md`, supported Cursor rules), skills/commands, and hooks are independent trust categories. Instruction trust never enables skills, commands, or hooks. Project shell hooks stay disabled.

## Migration

Existing chat folders keep IDs, names, emoji, order, and default agent. `projectId` dual-writes with `folderId` for one compatibility release. Legacy `workspaceRoot` is a reconnect hint only and never auto-authorizes.

Removing a Project never deletes its directory.
