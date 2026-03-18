# Svelte Migration Rescue Status

## Summary

The Svelte app in `src-svelte/` is a rescue-stage shell, not a finished migration. The current milestone restores a real chat shell on top of the existing app logic, removes demo behavior from navigable chat routes, and documents the remaining parity gaps honestly.

## Current Milestone

### Chat Shell Rescue

Implemented in this pass:

- `src-svelte/src/app.css` keeps the existing Chatbox visual language and baseline app behavior.
- `/` is the real new-chat entry point.
- `/session/[id]` is the real session route.
- Sidebar state, sidebar width, theme state, session selection, and session list are wired to real persisted state.
- Model selection is wired to real provider/model state.
- New chat submission uses the existing session creation and message submission flow.
- Session pages load real messages and preserve generating state.
- Markdown rendering is recursive again and preserves nested inline formatting for paragraphs, lists, blockquotes, and tables.
- Unsupported message parts degrade to explicit placeholder cards instead of throwing.

### Explicitly Incomplete Routes

These routes remain visible only because they clearly state that they are incomplete:

- `/settings`
- `/settings/provider`
- `/image-creator`
- `/about`

They should not be treated as parity-complete feature ports.

## What Is No Longer True

The earlier migration plan overstated completion. The following are not complete in the Svelte app:

- Full settings management
- Provider setup flows
- Image creator
- Knowledge base UI
- MCP management UI
- Search dialog
- Thread/fork management
- Full toolbar/message action parity
- Full route parity with the React app

## Runtime Architecture

The rescue pass keeps the React app as the source of truth for chat behavior and persistence:

- The Svelte shell uses local Svelte stores for shell state.
- Real chat/session/model behavior is loaded from the existing runtime modules.
- No backend or Tauri command contracts were changed.
- No public `src/shared` type contracts were changed.

## Validation

Validated in this pass:

- `pnpm --dir src-svelte check`
- `pnpm --dir src-svelte build`

Build notes:

- The build still emits large-chunk and third-party module warnings from the imported React/runtime dependency graph.
- Those warnings are upstream/runtime-size issues, not new Svelte type or syntax failures in touched files.

## Remaining Parity Gaps

High-priority next steps:

1. Replace the React-runtime dependency bridge for chat/session logic with native Svelte-side runtime modules to reduce bundle size and remove React/Mantine/MUI baggage from the build.
2. Port real provider management UI so `/settings/provider` stops being an incomplete-state route.
3. Port session/thread actions beyond copy and generating-state handling.
4. Audit the remaining visible routes and either finish them or keep them explicitly incomplete.
5. Run a browser-level visual pass against the React app for spacing, header density, sidebar density, and empty-state parity.

## Status Call

This migration is not ready to be called “complete.” The Svelte branch now has a stable, real chat rescue baseline that can be iterated toward parity without shipping fake behavior.
