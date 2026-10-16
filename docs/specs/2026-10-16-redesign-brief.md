---
type: spec
status: draft
description: "Total redesign brief: structure first, then a new look"
generated: { by: claude/opus-5.5, at: 2026-10-16T21:40:00+07:00 }
---
# Chaeboxi redesign brief

Status: draft for the maintainer's review. Nothing here is approved or built.

## Why

The product changed direction three times (dev chat client → personal assistant → PM pilot, now [ADR 0011](../adr/0011-maintainer-first-shared-core.md)), but the app kept every feature from every phase. The maintainer named four problems on 2026-10-16: it does not fit the new direction, it is cluttered, it looks dated, and a non-technical PM must be able to find their way around.

## Order

1. **Structure**: decide which surfaces exist, using this brief.
2. **Wireframes** of the main screens.
3. **New look**: a new version of the Studio design system.
4. **Build** in small PRs. The settings split and rail come first; scope pages arrive with the shared core.

Structure comes before look so styling effort goes only to surfaces that survive.

## What exists today

- **Rail:** Search, New chat, Imagine (image studio), Projects, Chats; user menu with Image studio (Beta), Settings, About, Dev tools.
- **Settings:** 21 sections, all at one level: Model provider, Default models, Usage, Web search, Video URL, Browser agent, Computer use, Voice, Integrations (MCP, Knowledge base), Document parser, Chat settings, Skills, Commands, Hooks, Memory, Sync, Agents, Keyboard shortcuts, General.
- **Composer tools menu:** Attach (image, file, link), Improve writing, Memory, Tools (web search, browser, computer use), Extensions, Knowledge, Mode (agent mode, project folder), Chat (undo, new thread, chat settings, share room pack).
- **In-thread chrome:** agent room strip and speaker headers, skill activations bar, task progress, plan approval, tool audit, memory dock, compaction status, session status bar.
- **Other routes:** Quick Chat overlay, Copilots, Image creator, About, Dev tools.

## Proposed structure

### Main surfaces

| Surface | Purpose | Replaces or absorbs |
| --- | --- | --- |
| **Quick Chat** | A question or idea from anywhere via hotkey. | Unchanged. |
| **Chat** | Conversations, each optionally tied to a scope. | Main chat; Copilots become new-chat starters. |
| **Scopes** | One page per project or client: since you last looked, what's open, approved knowledge, proposals to review, connected sources, its chats. | Projects, Memory dock, Knowledge base picker, project folder. |
| **Search** | Find anything across chats and scopes. | Unchanged. |

A scope's sources include a folder (this repo for the maintainer) and, later, Gmail and the work tracker (the PM). The current project-folder binding becomes a scope source rather than a separate concept.

### Composer

Kept visible: attach, scope picker, Improve writing, send. Behind one Tools button: web search, browser, computer use, Swarm (a visible per-conversation toggle, per ADR 0004). Moved to Advanced or chat settings: agent mode switch, extensions picker, share room pack.

### Settings

**Top level (5):** Models and keys (provider, default models) · Sources (integrations, knowledge base, folders) · Memory and privacy (memory, sync) · Voice · General (appearance, language, keyboard shortcuts).

**Advanced:** Usage, Web search providers, Video URL, Browser agent, Computer use, Document parser, Chat settings, Skills, Commands, Hooks, Agents, MCP, Dev tools. Nothing is removed (ADR 0010); it is moved.

## Open decisions

1. **Image studio**: keep in the rail, move to Advanced, or remove?
2. **Project folder as a scope source**: accept merging the folder binding into Scopes?
3. **Multi-agent rooms**: keep only as the Swarm toggle, or keep the room strip and speaker headers as they are?
4. **Look**: evolve Studio (same void, indigo, Satoshi; new density and components) or start a new direction? Explored after the structure is approved.

## Acceptance

The maintainer can name every top-level surface and settings section from memory. A first-time PM reaches "connect Gmail" and "ask about a client" without opening Advanced.
