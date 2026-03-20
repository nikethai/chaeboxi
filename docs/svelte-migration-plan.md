# Svelte Migration Status

## Summary

The Svelte app in `src-svelte/` is still an in-progress migration, but the highest-traffic surfaces now run on real persisted state instead of prototype behavior. The current milestone is `Real Settings Hub + Core Settings Parity`, with the React app still acting as the visual and behavioral source of truth.

## Current Milestone

### Real Settings Hub + Core Settings Parity

This pass focuses on making settings genuinely usable inside the Svelte app while also correcting the oversized control/text baseline that made the shell feel looser than React.

Implemented in the current state:

- `/` is the real new-chat route and `/session/[id]` is the real session route.
- Chat UI remains store-backed, session-aware, and visually aligned with the denser React shell.
- `/settings` is now the real routed settings shell rather than a placeholder landing page.
- Real Svelte settings routes now exist for:
  - `/settings/provider`
  - `/settings/general`
  - `/settings/default-models`
  - `/settings/chat`
  - `/settings/web-search`
- `/image-creator` is a real Svelte route backed by the existing image-generation storage and actions.
- Navigation now distinguishes between real routes and explicit partial-state routes instead of presenting faux-complete cards.

## Core Parity That Is Real Today

The Svelte app currently supports these behaviors without demo data or fake handlers:

- `/` creates a real session and routes into `/session/[id]`
- `/session/[id]` loads real messages and keeps real assistant generation flow
- Header model selection updates the real draft/session model state
- Sidebar visibility, width, and session switching use real persisted UI state
- Session rename from the header updates the real session
- Provider settings persist real credentials, endpoints, model lists, and custom providers
- Core settings pages persist real shared settings for theme, language, font size, startup page, chat behavior, default models, and web-search provider credentials
- `/image-creator` creates and loads real image-generation records with real history
- Markdown, code blocks, KaTeX, Mermaid, tables, and unsupported-part fallback render without demo behavior

## Still Partial

These areas are still explicitly partial in the Svelte app and should remain visibly labeled as such:

- About/release metadata surfaces
- Document parser settings UI
- Keyboard shortcut editor
- MCP management UI
- Knowledge base UI
- Search dialog and advanced shell actions
- Full advanced chat toolbar/message-action parity
- Thread/fork management and deeper conversation controls

Incomplete routes should stay visible only when they clearly label themselves as partial or unavailable.

## Runtime Architecture

The Svelte app still reuses selected renderer runtime modules where that preserves correctness and persistence behavior:

- Svelte owns route composition, shell presentation, and route-local UI state
- Chat, provider, settings, and image-generation flows can still lean on existing renderer-side persistence and action modules
- No backend, Tauri command, or `src/shared` public contracts have changed in this migration pass

This is still acceptable for the current milestone. Full bridge reduction remains later cleanup work rather than finished parity.

## Validation

Validation for the current milestone should include:

- `pnpm --dir src-svelte check`
- `pnpm --dir src-svelte build`

## Next High-Value Work

1. Port the next honest settings slices that are still partial, starting with document parser and desktop hotkeys.
2. Continue visual parity cleanup where the Svelte shell still feels looser than React.
3. Replace more bridge-heavy renderer dependencies with native Svelte orchestration where it meaningfully reduces runtime drag.
4. Keep incomplete routes explicit and honest instead of hiding broken or missing product surfaces behind generic placeholders.
