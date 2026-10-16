---
okf_version: "0.2"
---
# Chaeboxi docs

Start here. [log.md](log.md) lists what changed, newest first. Work items and ideas live on the board in [`backlog/`](../backlog/).

# Decisions

* [0001-user-approved-knowledge-authority](adr/0001-user-approved-knowledge-authority.md) - User-approved knowledge authority (stable)
* [0002-project-scoped-knowledge](adr/0002-project-scoped-knowledge.md) - Project-scoped knowledge (stable)
* [0003-explicit-knowledge-source-connections](adr/0003-explicit-knowledge-source-connections.md) - Explicit knowledge source connections (stable)
* [0004-personal-assistant-capability-boundaries](adr/0004-personal-assistant-capability-boundaries.md) - Personal assistant capability boundaries (stable)
* [0005-independent-mobile-quick-chat](adr/0005-independent-mobile-quick-chat.md) - Independent mobile Quick Chat (stable)
* [0006-optional-hosted-sync-service](adr/0006-optional-hosted-sync-service.md) - Optional hosted sync service (stable)
* [0007-automatic-method-learning](adr/0007-automatic-method-learning.md) - Automatic method learning within existing authority (stable)
* [0008-central-hosted-knowledge-authority](adr/0008-central-hosted-knowledge-authority.md) - Central authority for hosted knowledge (stable)
* [0009-user-held-sync-recovery-key](adr/0009-user-held-sync-recovery-key.md) - User-held recovery key for encrypted sync (stable)
* [0010-pm-pilot-first-user](adr/0010-pm-pilot-first-user.md) - Small-agency PM as first external user (stable)
* [0011-maintainer-first-shared-core](adr/0011-maintainer-first-shared-core.md) - Maintainer first on a shared knowledge core; PM pilot as the next source (stable)
* [continuity/](adr/continuity/) - Continuity import ADRs 001–005 from the August growth discovery

# Specs

* [2026-09-05-daily-copilot-design](specs/2026-09-05-daily-copilot-design.md) - Dependable Daily Copilot — Proposed Technical Design (draft)
* [2026-09-06-product-refinement](specs/2026-09-06-product-refinement.md) - Personal assistant product refinement (draft)
* [2026-10-05-personal-assistant-design](specs/2026-10-05-personal-assistant-design.md) - Chaeboxi personal assistant design (draft)
* [2026-10-13-pm-pilot-design](specs/2026-10-13-pm-pilot-design.md) - Chaeboxi PM pilot design (stable)
* [2026-10-14-pm-pilot-phase-1-client-memory](specs/2026-10-14-pm-pilot-phase-1-client-memory.md) - PM Pilot Phase 1: Client Memory Implementation Plan (draft)
* [260905-daily-copilot/](specs/260905-daily-copilot/) - Daily copilot roadmap, phases and evaluation

# Research

* [2026-08-11-computer-use-industry-parity](research/2026-08-11-computer-use-industry-parity.md) - Research Report: Computer Use Parity (Claude / GPT / Perplexity → Chaeboxi)
* [2026-10-05-copilotkit-reference-review](research/2026-10-05-copilotkit-reference-review.md) - CopilotKit reference review for Chaeboxi
* [2026-10-13-work-source-access](research/2026-10-13-work-source-access.md) - Work source access feasibility
* [feature-gap-synthesis](research/feature-gap-synthesis.md) - Chaeboxi Feature Gap Synthesis (v2 — Evidence-Based)
* [provider-usage-adapter-spikes](research/provider-usage-adapter-spikes.md) - Provider usage adapter spikes (v1)
* [research-agent-video-url-reader-2026-08-10](research/research-agent-video-url-reader-2026-08-10.md) - Research Report: Agent Tool for Reading YouTube / Vimeo / TikTok / Facebook Video URLs
* [research-openclaw](research/research-openclaw.md) - OpenClaw Research Report
* [research-perplexity-scraping](research/research-perplexity-scraping.md) - Research Report: Perplexity-like Web Search & Scraping for AI Chat Apps
* [research-use-browser-use-computer-2026-08-11](research/research-use-browser-use-computer-2026-08-11.md) - Research Report: Use Browser & Use Computer for Chaeboxi

# Reference

Feature and architecture docs for the code as it is today:

* [adding-new-provider](adding-new-provider.md) - Adding a New Provider (Registry Architecture)
* [adding-provider](adding-provider.md) - Adding a New Provider to Chaeboxi
* [agents-multi-agent-rooms](agents-multi-agent-rooms.md) - Agents & multi-agent team rooms
* [browser-agent](browser-agent.md) - Browser Agent (use_browser)
* [code-standards](code-standards.md) - Code Standards
* [codebase-summary](codebase-summary.md) - Codebase Summary
* [computer-use](computer-use.md) - Computer Use (use_computer)
* [deployment-guide](deployment-guide.md) - Deployment Guide
* [design-guidelines](design-guidelines.md) - Chaeboxi Design Guidelines
* [hooks-and-commands](hooks-and-commands.md) - Commands and Hooks
* [integrations](integrations.md) - Integrations (Connected Accounts)
* [memory](memory.md) - Long-term Memory
* [new-session-mechanism](new-session-mechanism.md) - New Session Mechanism
* [openclaw-remote-setup](openclaw-remote-setup.md) - OpenClaw Remote Access via Cloudflare Tunnel
* [project-overview-pdr](project-overview-pdr.md) - Chaeboxi — Project Overview & Product Development Requirements
* [project-workspaces](project-workspaces.md) - Project Workspaces
* [provider-usage-status](provider-usage-status.md) - Provider Usage Status
* [rag](rag.md) - RAG / Knowledge Base
* [session-module-split-plan](session-module-split-plan.md) - Session Module Split Plan
* [skills](skills.md) - Skills
* [storage](storage.md) - Storage Architecture
* [system-architecture](system-architecture.md) - System Architecture
* [system-notifications](system-notifications.md) - System Notifications
* [testing](testing.md) - Testing Strategy and Implementation
* [token-estimation](token-estimation.md) - Token Estimation
* [video-url-reader](video-url-reader.md) - Video URL Reader (Agent Tool)

# Archive

* [archive/](archive/) - Finished plans and notes from earlier tools (plans/, claudedocs/, tasks/, superpowers). Read-only history.
