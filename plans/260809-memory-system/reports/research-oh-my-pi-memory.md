# Research Report: oh-my-pi Memory → Chaeboxi Plan

**Date:** 2026-08-09  
**Scope:** How oh-my-pi implements agent memory; what Chaeboxi already has; recommended ship plan.

## Executive Summary

oh-my-pi treats memory as a **first-class backend** with tools (`retain` / `recall` / `reflect` / `memory_edit`) plus lifecycle automation (auto-retain, auto-recall). Compression is not "zip the chat" — it is **LLM extraction → consolidation into short durable facts + mental-model summaries** with hard token budgets (~5k inject).

Chaeboxi already has partial pieces: **manual personal info**, **session compaction**, **knowledge base RAG**. None of these is cross-session agent memory with auto-save + manage UI. Recommended path: **local-first fact store + compact profile summary**, not full vector graph on day 1.

## Research Methodology

- Sources: oh-my-pi docs (`docs/memory.md`, `docs/mnemosyne-memory-backend.md`), Hindsight integration writeup, omp.sh product copy, Chaeboxi codebase (storage, generation, personal info, KB, context-management)
- Recency: 2026 docs / public repo
- Key terms: retain, recall, reflect, mental model, consolidation, mnemopi, hindsight

## Key Findings — oh-my-pi

### Backends (pluggable)

| Backend | Storage | Behavior |
|---------|---------|----------|
| `off` | none | default |
| `local` | project files (`MEMORY.md`, `memory_summary.md`, `learned.md`) | 2-phase extract → consolidate at startup |
| `hindsight` | remote bank API | retain/recall/reflect + mental models |
| `mnemopi` | local SQLite (+ optional embeddings) | retain/recall/reflect/memory_edit |

### Lifecycle (the pattern that works)

```text
session start  → auto-recall / inject mental model (token-capped)
mid-turn       → model may call retain / recall (debounced queue)
every N turns  → auto-retain completed turns
session end    → flush retain queue; optional consolidate
```

### Compression strategy (lightweight)

1. **Do not inject raw history as memory.**
2. Extract **durable facts** only (prefs, decisions, constraints).
3. Consolidate into:
   - full curated doc (`MEMORY.md`)
   - **compact inject text** (`memory_summary.md`, ~token limit)
4. Optional **mental models** (named reflect summaries): user-preferences, project-conventions, project-decisions with delta refresh.
5. Cap inject budget (`summaryInjectionTokenLimit` / `injectionTokenLimit` ≈ 5000 tokens).
6. Treat memory as **heuristic background**, not instructions; repo/user message wins on conflict.

### Scoping

- Coding-agent default: **per-project-tagged** (project + global prefs).
- Chaeboxi is a **multi-chat client**, not cwd-bound — scoping should default to **global user memory**, with optional later: workspace / agent / session tags.

### User management

- Tools: `memory_edit` (update/forget/invalidate by id)
- Commands: `/memory view|stats|clear|enqueue`
- Lessons via `learn` tool (local: append to `learned.md`, cap 100, secret-redact)

## Chaeboxi current state

| Capability | Exists? | Gap vs required memory |
|------------|---------|------------------------|
| Manual personal info (key/value) | Yes — Settings → User Personal Info + inject | No auto-extract; no relevance; no AI write |
| Session compaction | Yes — `context-management/` | **Session-only**; dies with thread context |
| Knowledge base RAG | Yes — desktop libsql + tools | Document RAG, not conversational memory |
| Prompt injection seams | Yes — `injectModelSystemPrompt`, hooks SessionStart/PreTurn | Ready to inject memory block |
| Cross-session fact store | **No** | Core missing piece |
| Memory manage UI (list/delete/pin) | **No** (personal info is close but not memory) | Need dedicated UI |
| Model-facing memory tools | **No** | retain/recall/forget tools |

## Comparative fit for Chaeboxi

| Approach | Pros | Cons | Fit |
|----------|------|------|-----|
| A. Extend personal info only | Tiny | No auto, no compress, scales poorly | Too weak |
| B. Reuse KB as memory | Embeddings ready | Wrong UX (files); heavy; not fact-oriented | Wrong abstraction |
| C. Full mnemopi/Hindsight | Battle-tested | Heavy deps, embeddings, server, product complexity | Overkill v1 |
| D. **Local fact bank + compact profile** (oh-my-pi local pattern, simplified) | KISS, offline, provider-agnostic | Need own extract prompts | **Recommended** |

## Implementation Recommendations (summary)

See parent `plan.md` for phased ship plan.

**Core product model:**

- `MemoryEntry`: short fact, tags, source, confidence, timestamps, enabled
- `MemoryProfile`: single compressed summary string (always inject if under budget)
- Auto-extract after turns (debounced) + user pin/delete
- Inject same profile into **all models** via existing system-prompt path

## Unresolved questions

1. Scope v1: global-only vs per-agent memory?
2. Auto-save: silent background vs explicit model tool vs both?
3. Web/mobile: SQLite/IndexedDB store parity required day 1?
4. Privacy: local-only guaranteed, or optional sync later?
5. Should personal info merge into Memory UI or stay separate?
