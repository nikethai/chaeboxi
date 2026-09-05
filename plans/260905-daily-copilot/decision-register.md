# Decision Register

**Date:** 2026-09-05  
**Status:** writing development authorized to continue; later architecture and release gates remain proposed

## 1. Confirmed in the conversation

- The user currently prefers Gemini/Grok for tasks that matter because confidence in Chaeboxi is insufficient.
- A recurring task is grammar/sentence improvement before posting to Slack or WhatsApp.
- Another recurring task is analysis of personal/local files and Google Drive content.
- The relevant format families include Excel/CSV, Google Sheets, and PDFs/documents.
- The user wants dependable assistance, personal continuity, and desktop actions in the roadmap.
- The initial request was for a full plan. The user subsequently confirmed Daily Copilot as the baseline and requested committing/pushing the existing code on a separate branch, then continuing to the next step.
- The existing writing code was published as checkpoint `d19af16c` on `feat/daily-copilot-writing`. Continuing with synthetic writing evaluation does not authorize paid services, private-data transfer, or broader native access.

Not established: actual file sizes, representative analytical questions, frequency, supported OS requirements, provider configuration, budget, team capacity, or why particular existing Chaeboxi answers failed.

## 2. Recommended planning decisions

| ID | Recommendation | Reason | Approval state |
| --- | --- | --- | --- |
| D1 | Workflow-first delivery rather than three independent A/B/C programs | Connect investment to daily use | Roadmap direction confirmed |
| D2 | Writing beta first, using existing Quick Chat | Frequent use, lower risk, existing shell | Development continuation confirmed; beta release gated |
| D3 | Read-only local snapshots and deterministic analysis | Auditable results without touching originals | Proposed |
| D4 | Typed analysis operations rather than unrestricted code | Smaller authority and correctness surface | Proposed; engine gated |
| D5 | Google per-file selection with broker-enforced read-only behavior | Narrow data access without whole-Drive indexing | Proposed; OAuth/Picker gated |
| D6 | Explicit style preferences and saved recipes, reusing memory infrastructure | Continuity without sensitive auto-retention | Proposed |
| D7 | Copy first; narrow reviewed replacement later | Avoid accidental wrong-target edits and sends | Proposed; native safety gated |
| D8 | Desktop-first analysis, honest unsupported states elsewhere | Fits existing platform boundaries | Proposed |

## 3. Feasibility gates and owners

Roles are suggested responsibilities, not assigned people.

| Gate | Decision needed | Suggested owner | Blocks |
| --- | --- | --- | --- |
| Runtime | Engine, hard resource/cancel controls, packaging, license | Native engineer + security reviewer | Phase 3 |
| Parsers | CSV/XLSX semantics, PDF/DOCX locators, expansion limits | Data/native engineer | Phases 3/4 |
| OCR | Local versus remote, quality, privacy, package size/cost | Product + data engineer | Scanned-PDF support only |
| OAuth | Per-file Picker/desktop viability, scopes, public client ownership, policy/verification | Integration engineer + product/security | Public Drive release |
| Snapshot ownership | Storage schema, source authority, retention, sync exclusion | Architecture/native owner | Phase 2 |
| Selection | Reliable capture/replace, native tickets, platform matrix | Desktop engineer + security reviewer | Phase 7 |
| Provider behavior | Writing baseline and purpose/tool/grounding compatibility | Model-layer engineer | Phase 1 and approved reliability fixes |

## 4. Early questions to resolve without blocking the roadmap

1. Obtain three redacted drafts and three representative analysis tasks, preferably with synthetic equivalents.
2. Record normal and largest file sizes, sheet/row/page counts, and how often scanned PDFs occur.
3. Confirm the first target OS and whether Slack/WhatsApp are desktop apps or browser tabs.
4. Confirm preferred configured models and whether any work must remain fully local.
5. Determine whether public Google OAuth can use a Chaeboxi-owned project and who owns verification.
6. Confirm available engineering/review capacity before turning effort ranges into dates.

These are Phase 0 discovery tasks, not a demand that the user answer a long questionnaire before any useful work can begin.

## 5. Relationship to existing plans

- The [continuity roadmap](../260820-2357-next-feature-growth/plan.md) explores cross-provider history retrieval/import. This plan does not reopen or override its research/implementation gates; saved analysis continuity is narrower.
- The [local workspace suite](../260823-1509-local-wasi-workspace-suite/plan.md) owns project authority, staged changes, and feasibility-gated execution/worktrees. This plan does not enable those capabilities.
- Existing computer-use functionality remains available under its own permissions; the writing path should not require its broad observation/action authority.
- The Google connector currently includes broad scopes for expert integrations. New analysis consent must coexist with those accounts without silently altering existing bindings.

## 6. Risks and responses

| Risk | Response |
| --- | --- |
| Broad scope delays first value | Ship writing independently; keep later gates closed |
| Better model needed, not more UI | Baseline actual tasks and configured models before changing architecture |
| Polished but numerically wrong answers | Deterministic engine, fixture truth, provenance, and full-data coverage |
| Files exceed assumptions | Measure early; publish real caps; never silently sample whole-file analysis |
| OAuth review/distribution stalls | Start feasibility early; preserve local-file path; do not promise approval dates |
| Private work leaks through memory/logs | Ephemeral writing, explicit disclosure, source ownership, no auto-memory for new workflows |
| Unsafe or stale desktop target | Short-lived native tickets, revalidation, fail closed, Copy fallback |
| Existing plans conflict or duplicate domains | Reuse owners/contracts; require ADR before a new store/runtime |
| Too much provider/tool routing complexity | One request-policy resolution point with compatibility tests |
| Unsupported formats advertised as complete | Per-format capability/coverage matrix and independent release gates |

## 7. Next action

Complete the writing baseline using the [synthetic corpus and evaluation procedure](./writing-evaluation.md). Obtain explicit provider/model and paid-call approval before live evaluation. The development checkpoint does not substitute for Phase 0 evidence or Phase 1 release approval. Keep engine, OAuth, OCR, and replacement decisions explicit rather than burying them inside feature code.
