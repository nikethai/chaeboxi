---
id: TASK-12
title: 'AI home base and trusted secretary: cross-app memory and continuity'
status: Ideas
assignee: []
created_date: '2026-10-17 16:11'
labels: []
dependencies: []
documentation:
  - docs/memory.md
  - docs/adr/0014-okf-knowledge-document-format.md
ordinal: 30000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Dango should be the main AI home users return to, not the only AI app they can use. Users still value specialized consumer-product experiences such as Claude Design and Gemini research; selecting their API models is not equivalent and does not carry website memories. Today the user manually moves a personalized ChatGPT brief into another product for research, brings findings back for explanation, and seeks an Opus second opinion. Explore after the revamp: user-reviewed import of available memories and selected conversations into existing Dango memory/knowledge infrastructure; reviewable context briefs for external AI apps; and incorporation of returned results, sources, decisions, and open questions. Continue inside Dango or spawn an explanation/review using approved context. Memory migration is the entry point; ongoing continuity is the value. Build on existing memory-bank import/export concepts and the curated-knowledge direction in ADR 0014, not a separate greenfield memory system. Start with available exports and manual handoffs; investigate supported integrations without promising universal sync or automatic access to private platform memory. Preserve originals and disclose context omitted or summarized. Idea only; no implementation commitment.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Users can review, edit, and approve externally supplied memory or conversation context before it becomes lasting Dango knowledge.
- [ ] #2 Users can preview and select the context shared in an external-app handoff, with summaries and omissions made explicit.
- [ ] #3 Returned work retains source attribution and can be continued, explained, or reviewed through a spawn workflow without silently becoming approved memory.
- [ ] #4 The experience distinguishes consumer AI-product capabilities from API-model access and clearly states import and integration limitations.
<!-- AC:END -->
