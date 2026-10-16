---
type: spec
status: draft
description: "Total redesign brief: structure first, then a new look"
generated: { by: claude/opus-5.5, at: 2026-10-16T21:40:00+07:00 }
---
# Chaeboxi redesign brief

Status: draft. The UX model and the four structure decisions were settled with the maintainer on 2026-10-16; the brief as a whole is not yet accepted. Nothing is built.

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

## UX model (maintainer and Claude, 2026-10-16 evening)

**One line.** Chaeboxi tells you what needs you, remembers what you approved, and answers from that. Chat is how you talk to it, not what it is.

**Three jobs, three places.**

| Job | Place | What happens |
| --- | --- | --- |
| Ask | Quick Chat (hotkey) | A question, an idea, "what changed". The daily entry point; most days the main window stays closed. |
| Review | Home | What needs you, across scopes: proposals, drafts, changes, finished background work. One list, newest first, one key per item. |
| Browse | Sidebar | Scopes, chats, search. For going somewhere specific. |

**The loop that matters.** Something arrives (a commit, an agent note, a client email, a finished review). Chaeboxi turns it into a Review item with a proposed action. You approve, edit or dismiss in seconds. What you approve becomes knowledge, and the next answer uses it.

**Trust level.** A setting with two positions; default **Auto**. It moves the line between *done* and *waiting*:

- Auto: safe, confident actions happen first and appear in Review as done, with Undo (labels, tags, Gmail drafts, low-risk knowledge).
- Ask: the same items appear as waiting, with Approve.
- Always asks, whatever the setting: sending anything, deleting, editing files, changing a decision.

This maps onto the pilot design's confidence tiers; the toggle sets the threshold.

**Review item types.** Proposal (knowledge to save) · Draft (a reply written into the user's Gmail thread; Chaeboxi never sends) · Change (something moved in a source) · Done (background work finished) · Needs you (a question the assistant cannot answer alone).

**The PM's behaviour.** The PM stays in Gmail and Asana. Chaeboxi labels threads and writes drafts into Gmail in the background. They open Chaeboxi to skim Review and to ask Quick Chat questions ("what did we promise Acme about the deadline?"). Chaeboxi is never their inbox.

**Principles (behaviour, not style).**

- One primary action per screen: Review → approve, Chat → send, Scope → ask.
- Progressive disclosure: sources, agent turns, tokens and cost stay behind a click.
- Sidebar, content, inspector. The inspector holds the current scope's sources and knowledge; it slides in on demand.
- Sheets, not modals, for approvals and tool permissions; Esc dismisses.
- Direct manipulation: one key approves; drop a folder on a scope to connect it; drag a chat onto a scope to move it.
- Undo everything for a few seconds after approve, dismiss, stop.
- Light by default, dark follows the system. Few lines, more space, short labels.

**Modes removed.** Agent mode on/off (the assistant always may use tools and asks before acting). Project folder as its own concept (it is a source). Team mode choice in the composer (Swarm is one toggle; Discuss and Work are how a Swarm run organises itself).

## Surfaces

- **Review** (home): the feed above, grouped by day, filterable by scope.
- **Scope**: one page per project or client: since you last looked, open items, background work, approved knowledge, chats. Sources and knowledge detail live in the inspector.
- **Chat**: a conversation, optionally in a scope. Composer: attach, scope, Improve writing, Tools (web, browser, computer use, Swarm), send. One answer per turn; a Swarm run collapses behind "Worked with N agents".
- **Quick Chat**: the overlay; "Continue in Chat" and "Open scope" hand off.
- **Settings** (5 top level): Models and keys · Sources · Memory and privacy (includes Trust level) · Voice · General. Advanced holds the rest, including Image studio. Nothing removed.

## Decisions (maintainer, 2026-10-16)

1. **Image studio** moves to Advanced. It leaves the rail and the user menu.
2. **Project folder** merges into Scopes: a folder is one kind of scope source. Projects stop being a separate concept.
3. **Multi-agent rooms** show only when Swarm is on. The room strip, speaker headers and agent bar are hidden otherwise.
4. **Look**: a new visual direction, not an evolution of Studio. A first "local workbench" exploration (dark, mono, status strip) was rejected on 2026-10-16: too much a developer tool. Next exploration follows the UX model above and leans toward native macOS conventions.

## Acceptance

The maintainer can name every top-level surface and settings section from memory. A first-time PM reaches "connect Gmail" and "ask about a client" without opening Advanced.
