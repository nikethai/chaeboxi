---
title: Continuity workspace growth roadmap
description: Phase 0 discovery for a Continuity retention wedge. In-repo artifacts complete; field recruiting, consented ChatGPT ZIP, desktop session I/O timing, and ZIP inspector red-team remain open. MVP Phase 1 gated closed.
status: phase-0-artifacts-complete-field-work-open
priority: P1
effort: 2-3 weeks discovery
branch: main
tags: [discovery, continuity, retention, desktop]
created: 2026-08-21
owner: product
segment: multi-model-power-users
primary_metric: weekly-retention
research: ./research/user-pain-points-continuity-report.md
supersedes: ./research/research-report.md
phase_0: ./phase-00-discovery.md
---

# Continuity Workspace Growth Roadmap

## Overview

### Decision

The earlier report recommended shipping Voice v1 and validating Computer Use. Voice and macOS computer-use grounding subsequently shipped in commits `d1ff040d` and `fe5999d7`. This plan therefore evaluates the next wedge; it does not abandon unfinished work.

**Phase 0 discovery is approved. Do not approve six months of implementation yet. Do not start Phase 1.**

Continuity is a plausible retention wedge, but current evidence proves recurring pain—not adoption, switching intent, or repeat use in Chaeboxi.

**Current status (2026-08-21):** in-repo artifacts complete; field work open. MVP Phase 1 remains **CLOSED**. Status note: [reports/phase-0-status-2026-08-21.md](./reports/phase-0-status-2026-08-21.md). See [phase-00-discovery.md](./phase-00-discovery.md).

No product telemetry; do not invent retention numbers. Baseline: [discovery/measurement-baseline.md](./discovery/measurement-baseline.md).

### Target outcome

Help multi-model power users find prior AI work and selectively continue it with another configured model, without opaque memory or manual copy/paste.

### Bounded positioning

> **Bring your AI history with you. Inspect and choose what the next model receives.**

Avoid “every model,” “any model,” or “everything stays local.” Storage and search can be local, but selected content leaves the device when sent to a remote provider.

## Hypotheses

| Hypothesis | Evidence required |
| --- | --- |
| Continuity pain is frequent | Qualified users face it at least weekly |
| Import is acceptable | Users will provide a real export, not only endorse the idea |
| Retrieval has repeat value | Users return to imported work in later weeks |
| Selective handoff beats copy/paste | Faster task completion with equal or better accuracy |
| Transparency builds trust | Users understand what leaves the device and why |
| Maintenance is bounded | One importer remains stable across observed export versions |

## Existing Foundations

Reuse what exists; do not market existing capability as new:

- Cross-session content search already exists as a bounded linear scan. Benchmark it before adding an index.
- Sessions already support folders, tags, threads, and `messageForksHash`.
- Chaeboxi already supports native JSONL import/export.
- Provider abstraction, token accounting, cost tracking, memory, RAG, and encrypted native-history sync already exist.

The differentiated workflow is not search or forking alone:

```text
Vendor archive → source provenance → local retrieval
→ inspect/select context → explicit remote/local destination
→ native continuation with lineage → reversible source deletion
```

## Product Boundary

### Discovery/MVP scope

- Desktop only: macOS, Windows, Linux
- One provider importer selected from verified real exports
- Text conversations only
- Imported records remain read-only
- Search imported and native conversation text
- Open source conversation with provenance
- Select excerpts and recent turns
- Preview token estimate and destination provider
- Continue into a native Chaeboxi session
- Delete imported source and rebuild/reconcile search data

### Explicitly deferred

- Second provider importer
- Attachment extraction or preview
- Automatic summaries
- Persistent context-packet history
- Semantic search
- Workspace files/decision stores
- Automatic routing or failover
- Provider health scoring
- User fallback chains
- Parallel model execution
- Team collaboration
- Web/mobile archive import
- Sync of imported archives

## Architecture Decisions Required Before MVP

### 1. Imported-source boundary

Use a separate immutable imported-source aggregate, not ordinary mutable sessions.

```text
ImportedSource
  └─ ImportedConversation
       └─ ImportedMessage

Native Session
  └─ optional ContinuationLineage
       - imported source/conversation IDs
       - selected message IDs
       - target provider/model
       - created time
```

Imported records must not pass through native session mutation APIs. “Continue” creates a native session and lineage; it never mutates the import.

### 2. Archive I/O boundary

Large/archive-unsafe operations belong behind the platform abstraction and desktop privileged boundary:

```text
Desktop file picker
  → privileged streaming archive inspection
  → size/path/type validation
  → staged normalized records
  → reconciliation report
  → atomic publication
```

Pure adapters own detection, validation, and normalization. Renderer UI owns progress and review, not ZIP extraction or unbounded parsing.

### 3. Search ownership

Write an ADR before choosing an engine. It must define:

- Existing linear-search baseline
- Desktop index owner and schema
- Commit → incremental index update flow
- Deletion/re-import behavior
- Index version and rebuild behavior
- Crash/stale-index recovery
- Unicode normalization and ranking
- Cold/warm query and rebuild budgets

Reuse SQLite lifecycle primitives where useful, but keep history and KB schemas/lifecycles separate.

### 4. Handoff integration

V1 handoff is derived at send time; do not create a durable “context packet” domain yet.

The generation path must receive:

1. Existing system/provider instructions
2. Existing memory policy if enabled
3. A clearly delimited **untrusted reference block** containing only user-selected imported excerpts
4. The user’s new instruction

Rules:

- Imported system prompts and tool calls are omitted in v1.
- Imported text never becomes a system instruction.
- Tools, MCP, browser, computer use, and integrations default off for the first imported-context handoff; user may explicitly re-enable them.
- Show target provider/model, selected sources, estimated tokens, omissions, and that selected content will leave the device for remote APIs.

### 5. Deletion and sync

V1 imported sources are device-local and excluded from current whole-history sync.

Deletion removes:

- Imported normalized records
- Search rows/index references
- Staging files
- Import metadata

It does not delete derived native continuations or retract content already sent to providers. Native continuation lineage becomes unavailable or displays “source deleted.” Re-import behavior must be deterministic.

### 6. Attachments

Attachments are out of MVP. Record only that unsupported attachments existed and report them as skipped. This avoids path traversal, active preview, blob ownership, quota, and sync problems until demand is proven.

## Discovery Plan — Phase 0

**Duration:** 2–3 weeks  
**Commitment:** approved research/prototypes only  
**Implementation gate:** closed until all exit criteria pass

### Workstream A — Demand validation

Recruit 8–12 qualified participants who:

- Use at least two AI providers weekly
- Have a recurring multi-session project
- Can legally provide a real export or complete an observed task

Include current power users, abandoned multi-model users, and users relying on manual notes.

For each participant:

1. Observe current retrieval and copy/paste workflow.
2. Measure time and correctness on two standardized tasks.
3. Test archive import willingness with real data.
4. Test selective excerpt handoff—not a concept mock alone.
5. Repeat one task in a later week.
6. Verify understanding of local storage versus remote model disclosure.

### Workstream B — Export feasibility

- Obtain consented, sanitized real exports.
- Verify ChatGPT conversation export first because official conversation-history export is documented.
- Treat Claude conversation import as unsupported until real samples prove availability and stability; Anthropic memory export is not equivalent.
- Catalogue observed format/account/date variants.
- Build golden and adversarial fixtures only after real-format verification.

### Workstream C — Baseline and scale

Benchmark existing cross-session linear search before creating an index.

Declare a launch envelope across:

- Compressed and expanded archive bytes
- Conversations/messages
- Maximum single message
- Malformed-record rate
- Available disk headroom

Representative corpus must include:

- Unicode/multilingual text
- One huge conversation
- Long messages
- Duplicates
- Truncated/malformed records
- An archive above the intended launch limit

Attachments remain skipped.

### Workstream D — Security and privacy

Complete an archive-ingestion threat model covering:

- Zip bombs and size amplification
- Path traversal, symlinks, and unsafe names
- Malformed JSON and parser denial of service
- HTML/SVG/remote-resource execution
- Search/index resource exhaustion
- Sensitive data in logs, diagnostics, and partial-error reports
- Prompt injection and memory/tool poisoning during handoff

Define research-data custody, deletion, and retention before collecting exports.

### Workstream E — Architecture spikes

Produce ADRs for:

1. Imported-source storage and immutable repository boundary
2. Desktop archive I/O and staged publication
3. Search owner/index lifecycle
4. Continuation lineage and generation-pipeline ordering
5. Deletion graph and local-only sync policy

### Discovery exit gate

Proceed to MVP only if all are true:

#### Product evidence

- At least 6 of 8–12 qualified participants have a weekly continuity task.
- At least 5 use a real export in the prototype.
- Selective handoff reduces median task time by at least 30% versus manual copy/paste.
- Resumed-task answers meet predefined correctness criteria.
- At least 4 participants repeat the workflow in a later week.
- Participants correctly explain what remains local and what a remote provider receives.

#### Feasibility

- One provider format is verified across representative real exports.
- Import is staged, restartable, idempotent, and reconcilable.
- Discovered records = imported + skipped + failed.
- No partially published source appears as complete.
- Imported records cannot use native session mutation APIs.

#### Security

- No unresolved path traversal, active-content execution, arbitrary file access, credential leak, or unbounded resource-consumption finding.
- Adversarial imported content cannot trigger tools, poison memory, or become system instructions without explicit user action.

#### Performance

Targets must be set from the selected launch envelope. Minimum candidate budgets:

- Warm search p95 ≤200 ms
- No renderer task >50 ms during background import/indexing
- Explicit peak-memory and storage-amplification ceiling
- Explicit cold-search, import-throughput, startup-regression, and rebuild-RTO targets

#### Strategic stop conditions

Stop or narrow to native-history search if:

- Import is mostly a one-time migration with no later reuse.
- Users will not provide exports.
- Provider formats are too unstable.
- Handoff quality is worse than manual copy/paste.
- Privacy disclosure materially reduces willingness to use it.
- Security or maintenance cost exceeds demonstrated retention value.

## Conditional MVP — Phase 1

**Duration:** 4–6 weeks after Phase 0 approval  
**Platform:** desktop only  
**Provider:** one verified archive format

### User flow

```text
Import → reconciliation report → find → open
→ select excerpts → preview destination/tokens/privacy
→ continue in native Chaeboxi session
```

### MVP requirements

- Streaming/staged import with cancel, restart, and disk-space checks
- Strict format and resource limits
- Immutable imported records with source/version/checksum provenance
- Deterministic re-import and deduplication
- Exact/keyword content search with provider/date filters only where validated
- Read-only imported conversation view
- User-selected excerpts plus recent turns
- Native continuation with lineage
- Explicit destination/provider disclosure
- Source deletion and search reconciliation
- Content-free diagnostics by default

### Release invariants

- 100% correctness for supported golden archive formats
- Every skipped/failed record reported
- No source mutation or silent truncation
- No result references unpublished/deleted data
- Crash, cancel, disk-full, and re-import tests pass
- Migration from the two latest production storage versions passes at supported scale
- No imported content enters memory automatically
- Privileged tools default off on first handoff

### MVP success gate

Establish current retention baseline before release. Continue only when the beta shows:

- Repeated imported-history use in later weeks, not just import-week activity
- Correct retrieval@k on standardized tasks
- Successful model response completing the resumed task
- Meaningful median time saved versus baseline
- No severe disclosure, wrong-context, deletion, or integrity incidents

Do not use search-to-open as the primary success metric; multiple opens can indicate poor ranking.

## Conditional Expansion

### Phase 2 — Second importer or stronger retrieval

Choose one based on evidence:

- Add a second verified provider adapter, **or**
- Add a disposable local full-text index if baseline search misses performance/quality targets, **or**
- Improve native-history search if imports do not drive retention.

Do not do all three automatically.

### Phase 3 — Workspace continuity

Only after repeated retention is proven:

- Upgrade folders with overview and pinned decisions
- Add inspectable context composition
- Define folder rename/delete/orphan ownership first
- Keep imported source/device-local policy explicit

### Phase 4 — Resilient handoff and comparison

Only after the continuation lineage is stable:

- Explicit retry with another model
- Uncertain-completion and duplicate-spend handling
- Surface existing message forks
- Optional 2-model comparison with separate timelines and cost preview

Automatic routing remains out of scope.

## Measurement

### Baseline first

Measure current cohorts before setting final numeric retention targets:

- Install → provider configured
- First useful conversation
- Week-1/week-4 retention
- Existing history-search usage
- Existing session continuation frequency

### Task metrics

- Retrieval success: correct target appears in top-k
- Search reformulation and zero-result rate
- Time to find source
- Time to completed resumed task
- Output correctness
- Repeated project continuation in later weeks
- Import abandonment and failure rate

### Safety metrics

- Wrong-context inclusion
- User misunderstanding of remote disclosure
- Failed/incomplete deletion
- Sensitive data in diagnostics
- Import integrity mismatch
- Prompt-injection/tool escalation attempts

Telemetry remains opt-in. If disabled, use versioned local counters and participant-exported content-free metrics.

## Risks

| Risk | Level | Mitigation |
| --- | --- | --- |
| Evidence supports pain but not product adoption | Critical | Discovery-only commitment and longitudinal tasks |
| Import becomes one-time utility | Critical | Repeat-week gate before expansion |
| Archive ingestion vulnerabilities | Critical | Privileged streaming parser, hard limits, threat model |
| Local-first claim misleads users | Critical | Explicit destination/data-disclosure preview |
| Imported prompt injection reaches tools | Critical | Untrusted block; omit system/tool records; tools off by default |
| Existing sync cannot carry archives | High | Device-local imports in v1 |
| Search/index architecture diverges by platform | High | Desktop-only MVP and ADR before engine choice |
| Provider format drift | High | One verified adapter, versioned fixtures, partial reports |
| Deletion resurrects or leaves derivatives | High | No import sync; explicit deletion graph and reconciliation |
| Feature count resumes growing | High | Freeze Phases 2–4 behind repeat-retention gates |

## Immediate Next Actions

1. ~~Approve or reject **Phase 0 discovery only**.~~ **Approved 2026-08-21** (cook --auto). MVP still closed.
2. ~~Establish current retention and session-reuse baseline.~~ Documented: no product telemetry; volunteer/local counters only — [discovery/measurement-baseline.md](./discovery/measurement-baseline.md).
3. Recruit 8–12 qualified participants — [discovery/recruitment-screener.md](./discovery/recruitment-screener.md) (**human, not done**).
4. ~~Create research-data consent, custody, and deletion protocol.~~ [discovery/consent-custody-protocol.md](./discovery/consent-custody-protocol.md).
5. Obtain representative ChatGPT exports; Claude conversation export **does exist** officially (2026-07 help article) but stays Phase 2 until real samples — [discovery/export-feasibility.md](./discovery/export-feasibility.md) (**samples not in repo**).
6. ~~Benchmark existing linear history search before choosing an index.~~ [discovery/search-baseline.md](./discovery/search-baseline.md); code `src/renderer/packages/history-search/`.
7. ~~Write the five architecture ADRs.~~ [adrs/](./adrs/).
8. ~~Complete archive-ingestion and imported-context threat models.~~ [discovery/threat-model-archive-ingestion.md](./discovery/threat-model-archive-ingestion.md), [discovery/threat-model-imported-context.md](./discovery/threat-model-imported-context.md).

**Still blocking Phase 1:** participant study, consented ChatGPT ZIP, desktop I/O timing of `session:*` search, red-team of a real ZIP inspector (not written yet).

## Code review (2026-08-21)

**Result:** 8/10, 0 critical. Phase 1 remains **closed**. Report: [reports/code-review-2026-08-21.md](./reports/code-review-2026-08-21.md).

In-repo spikes match the approved Phase 0 scope (extract linear search; untrusted block not wired). No imported-source storage, archive IPC, FTS index, importer UI, or generation-path wiring.

Review warnings on the untrusted block **fixed in-repo** (still not wired to send):

- Wrapper tags inside excerpt/metadata text are neutralized
- Block packing is prefix-only (`block_size_limit` then stop)
- Omitted reason codes (`role_ineligible`, `empty`, `block_size_limit`) match ADR 004

Focused tests **16/16** pass after those fixes.

## Unresolved Questions

1. Is desktop-only acceptable for the first continuity release?
2. Can participants legally share sanitized provider exports?
3. Is opt-in anonymous telemetry acceptable, or must all measurement remain local/exported?
4. What baseline retention and session-reuse rates does Chaeboxi have today?
5. What archive size envelope should the first release support?
