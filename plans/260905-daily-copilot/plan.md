---
title: Dependable daily copilot
status: proposed-for-review
created: 2026-09-05
baseline_commit: a2f72b45
priority: P1
scope: writing, local analysis, Google Drive, continuity, controlled desktop actions
---

# Dependable Daily Copilot — Product and Delivery Plan

## 1. Decision summary

Build one coherent daily assistant around two proven user needs:

1. Improve grammar and wording before sending messages in Slack or WhatsApp.
2. Understand data in Excel, CSV, Google Sheets, PDFs, and documents, including files in Google Drive.

Combine **A: dependable assistance**, **B: personal continuity**, and **C: controlled desktop actions** inside these workflows. Do not build three separate products or enable every available tool on every turn.

**Status:** the user requested a full plan and endorsed the overall direction. Detailed architecture, limits, effort, and release gates below are proposals, not approved implementation decisions. No application code is changed by this plan.

**First release recommendation:** dependable writing assistance through existing Quick Chat, followed by verifiable local-file analysis. Start Google authorization and computation feasibility work early, but do not make writing depend on those larger projects.

## 2. Reading order

| Document | Purpose |
| --- | --- |
| [This roadmap](./plan.md) | Product scope, sequence, estimates, and approvals |
| [Technical design](../../docs/plans/2026-09-05-daily-copilot-design.md) | Architecture, privacy, data ownership, alternatives, and contracts |
| [Delivery phases](./delivery-phases.md) | Ordered implementation tasks, dependencies, and exit criteria |
| [Validation and rollout](./validation-and-rollout.md) | Fixtures, measurable gates, platform checks, release and rollback |
| [Decision register](./decision-register.md) | Confirmed needs, assumptions, feasibility gates, and unresolved choices |

## 3. Product promise

> Improve what I write, explain my data with evidence, and help me bring approved results back into my work.

Local-first storage does not mean every operation is local. A configured remote model receives only the content authorized for that operation. Google receives connector requests. Downloads, OCR providers, and other external services must be disclosed when used.

### Workflow W1: improve a message

Copy or paste a draft → open Quick Chat writing action → choose Fix grammar / Natural / Shorter / Professional / Casual → review → copy.

Later, on validated desktop combinations: explicitly capture selected text → review → replace that same selection. Never send the message automatically.

### Workflow W2: analyze files

Choose local files → inspect sheets, columns, pages, and extraction warnings → ask a question → compute or retrieve evidence → inspect results → save an export.

Example: compare monthly sales, identify declining customers, explain duplicate handling, and export the filtered result.

### Workflow W3: analyze Drive content

Connect an account → choose specific Drive files → disclose the selected source and model destination → create an immutable local snapshot → use W2.

Refreshing creates a new snapshot. An old answer is never silently relabeled as an analysis of current data.

### Workflow W4: continue and deliver

Reopen a saved analysis → inspect sources and recipe → refresh explicitly if necessary → rerun → turn the result into a Slack-ready summary → copy or use a narrowly approved desktop handoff.

## 4. Existing foundations and actual gaps

Assessment is based on repository inspection at `a2f72b45`, not an end-to-end runtime audit.

| Area | Existing foundation | Work still needed |
| --- | --- | --- |
| Quick access | [Quick Chat](../../src/renderer/routes/quick.tsx), [native shortcuts and clipboard](../../src-tauri/src/desktop_shell.rs) | Dedicated writing action, clean context, explicit retention, acceptance evaluation |
| Models and tools | Provider abstraction and [generation path](../../src/renderer/packages/model-calls/stream-text.ts) | Purpose-specific tool selection, visible readiness/failure, regression tests |
| Search | Generic search and native Gemini grounding selection | Reproduce grounding/tool interactions; report actual search path rather than configuration alone |
| File attachments | [Line reading and search](../../src/renderer/packages/model-calls/toolsets/file.ts) | Typed tabular ingestion, deterministic computation, full-data coverage evidence |
| Documents | [Desktop KB](../../docs/rag.md) with local extraction/retrieval | Structured provenance, Office ingestion, scanned-document handling, extraction coverage |
| Accounts | [Integrations](../../docs/integrations.md) and Google scope packs | First-class file selection/download, narrower consent, distribution-ready OAuth |
| Memory | [Global/agent memory](../../docs/memory.md), recall, pins, editing | Explicit writing preferences and saved analysis recipes; avoid automatic sensitive-content retention |
| Desktop actions | [Computer-use permissions and approvals](../../docs/computer-use.md) | Narrow selected-text replacement with target revalidation; no broad agent required |
| Workspace | [Picker-owned authority](../../docs/project-workspaces.md), default-off high-risk capabilities | Preserve restrictions; analysis must not revive generic filesystem or shell execution |

The current Gemini path excludes native grounding when function tools are available, and normal chat enables several such tools. This is an investigation candidate, not a demonstrated explanation of this user's confidence gap.

The current Google Drive scope pack requests broad `drive` access. Connecting an account is not equivalent to a safe first-class Drive analysis feature.

## 5. Scope and supported formats

| Input | First useful support | Follow-on or limitation |
| --- | --- | --- |
| CSV | Type preview, encoding/delimiter choices, filter/group/join/aggregate | Oversized files rejected or explicitly preview-only; never silently sampled for totals |
| Excel `.xlsx` | Sheet selection, values and available cached formula results, data profiling | No macro execution, external-link fetching, or claim of full Excel recalculation |
| Google Sheets | Explicitly selected sheets/ranges, values and formula metadata where available | Bounded snapshot consistency checks; no background sync or remote writeback |
| Text PDFs | Page-linked retrieval, summaries, comparisons | Extracted tables require validation before arithmetic |
| Scanned/mixed PDFs | Detect unreadable pages; opt-in OCR after feasibility gate | Never describe partial text extraction as complete coverage |
| DOCX | Paragraph/table extraction, heading/paragraph provenance | Do not invent original page numbers when pagination is unavailable |
| Google Docs | Snapshot export into the same document pipeline | Stable source/version metadata; explain export omissions |
| TXT/Markdown | Reuse text pipeline with source anchors | No active content execution |
| Legacy `.xls` / `.doc`, encrypted files | Explicit unsupported message and conversion guidance | Add only after demand, licensing, parsing, and security validation |

All requested format families are in the roadmap. They are not all in the first release. Concrete input limits and OCR availability are gated by Phase 0 measurements.

## 6. What users see

Use the existing chat and Quick Chat surfaces rather than create another navigation hierarchy.

- **Writing action:** draft, one primary rewrite, optional changes/explanation, Copy, retry, cancel.
- **Analysis conversation:** source tray, import warnings, data/page preview, answer, table/chart, evidence drawer, export.
- **Evidence drawer:** snapshot identity, rows/pages used, transformations, missing/omitted data, query/recipe, model and time.
- **Continuation:** recent saved analyses and explicit writing preferences, not an opaque memory feed.
- **Desktop handoff:** source app/target identity, proposed replacement, confirmation, verified result or honest failure.

Task profiles are internal execution policies; users should not have to understand tool routing. Advanced users retain access to existing general chat and agent settings.

## 7. Phased roadmap and dependencies

| Phase | Outcome | Depends on | Planning effort |
| --- | --- | --- | --- |
| 0 | Baselines, representative fixtures, runtime/OAuth/selection spikes | None | 1–2 engineer-weeks |
| 1 | Everyday writing beta | 0 writing baseline | 2–3 |
| 2 | Source snapshots, provenance, disclosure, job lifecycle | 0 architecture gate | 1–2 |
| 3 | CSV and Excel analysis with verified calculations | 2 + computation gate | 3–4 |
| 4 | PDF/DOCX/document analysis; OCR sub-gate | 2; 3 for table arithmetic | 2–3 |
| 5 | Drive/Sheets/Docs in the same analysis flow | 2 + OAuth gate; 3/4 for respective formats | 2–3 |
| 6 | Writing preferences, saved analyses, rerunnable recipes | 1 + persisted analysis foundations | 1–2 |
| 7 | Narrow selected-text capture/replacement | 1 + platform safety gate | 2–3 |
| 8 | Cross-platform hardening and staged release | Each shipping vertical slice | 1–2 |

**Total planning range: 15–24 engineer-weeks**, plus external OAuth review delays and any scope discovered in feasibility work. This is not a delivery commitment. With one full-time experienced engineer and part-time QA/product/security review, reserve roughly 4–6 months or more. Re-estimate after Phase 0.

Writing beta could be ready after approximately 3–5 engineer-weeks, provided its gates pass. Do not delay it until all analysis and desktop features are complete.

Phases 3 and 4 can overlap after source contracts stabilize. OAuth/distribution research begins in Phase 0. QA, privacy review, and user trials run throughout; Phase 8 is not the first testing phase.

## 8. Platform strategy

- Desktop is the first complete analysis target, fitting existing Tauri authority and local processing.
- Writing paste/copy should work on desktop and web without native privileges; validate mobile layout and existing clipboard behavior separately.
- Validate native capture/replacement first on macOS because existing AX infrastructure is strongest there. This is a recommendation, not an assumption about every user's OS.
- Windows/Linux replacement remains unavailable until their own target-safety tests pass. Wayland restrictions are a product constraint, not an error to bypass.
- Web/mobile continue supporting current chat/attachments. Do not advertise the new desktop analysis engine, Drive authorization flow, OCR, or desktop actions as supported there before separate validation.

## 9. Success and prioritization

Primary personal outcome: the user completes eligible real writing and analysis tasks in Chaeboxi without repeating them in Gemini/Grok to obtain a usable result.

Measure with an opt-in local task diary, not invented retention or hidden telemetry:

- Rewrite acceptance, additional edits, and time to a usable draft.
- Numerical correctness, evidence completeness, and reproducibility.
- Task completion, failures/recovery, latency, cost, and reason for switching apps.
- Repeat use of saved recipes and writing preferences.
- Correct handling of source refresh, permissions, deletion, and cancelled work.

Proposed thresholds and fixture sizes are in [validation](./validation-and-rollout.md). Automated safety and exact-calculation gates are mandatory; subjective usage targets are evaluated with the user.

## 10. Explicit non-goals

- Automatic Slack/WhatsApp message sending.
- Autonomous whole-desktop operation as the default writing workflow.
- Unrestricted Python, Node, shell, arbitrary SQL, package installation, or filesystem access.
- Editing Drive originals, Google Sheets writeback, whole-Drive crawling, or always-on synchronization.
- Reimplementing the existing memory system or promising consumer Gemini/Grok parity from API access.
- New multi-agent modes, extra providers, large-model training, or a new hosted subscription service.
- Full Excel compatibility, trusted calculations over unverified OCR tables, or unrestricted file sizes.

## 11. Next approval

Approve this roadmap as the planning baseline, then authorize **Phase 0 only** on a separate feature branch. Phase 0 produces measured feasibility decisions and a smaller implementation specification for Phase 1.

Source samples are still needed, but lack of private samples does not block synthetic fixture preparation. Request consented/redacted examples; do not commit the user's private messages or files.

No new engine dependency, public Google OAuth app, remote service, paid API experiment, native privilege, or broader data retention is approved merely by accepting the roadmap.
