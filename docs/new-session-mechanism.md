# New Session Mechanism

How new chats / sessions are created and initialized.

## Goals

- Fast empty-state → ready chat
- Correct default provider/model from last-used or global settings
- No fallback to removed legacy cloud service cloud provider

## Flow (summary)

1. User clicks **New chat** (or deep-link / empty home action).
2. Session store creates a session record with defaults from settings / last-used model.
3. UI navigates to `/session/$sessionId`.
4. Optional: attach initial message, files, or copilot/agent context.

## Implementation

- Session list & creation: `src/renderer/stores/chatStore.ts`, session helpers
- Last-used model: `src/renderer/stores/lastUsedModelStore.ts` (strips `chatbox-ai` if present)
- Settings defaults: `src/shared/defaults.ts`

## Rules

- Default provider must never be legacy cloud service in Chaeboxi builds.
- Session IDs and storage keys remain stable across migrations.
