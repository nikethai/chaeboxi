# Delivery Phases

**Status:** writing development is in progress on `feat/daily-copilot-writing` (checkpoint `d19af16c`). Checked items indicate implemented code or prepared fixtures, not release approval. Phase 0 live-model/packaged-app evidence and the Phase 1 quality gate are still incomplete. See [writing evaluation](./writing-evaluation.md) for commands, evidence, and remaining checks.

Every phase ships through a reviewable branch/PR. Do not change shared `main` directly, batch unrelated security changes, or enable later phases implicitly.

## Phase 0 — Evidence and feasibility

**Outcome:** replace assumptions with a measured, bounded implementation decision.  
**Effort:** 1–2 engineer-weeks.  
**Dependencies:** none.

### Tasks

- [ ] Collect consented/redacted writing examples and representative file metadata: format, size, row/page count, language, formulas, and desired questions.
- [ ] Create synthetic fixtures for every requested format; keep private originals outside the repository and diagnostics.
  - [x] Prepare 40 synthetic writing drafts, eight per style, with reference examples, protected fragments, human review notes, and offline request-boundary checks. File-analysis fixtures remain pending.
- [ ] Record current Chaeboxi results for writing, numerical questions, document questions, and Drive onboarding.
- [ ] With explicit permission for any remote use, compare the same tasks in the user's Gemini/Grok workflows. Record consumer app settings and API/model differences; do not claim controlled model equivalence.
- [ ] Reproduce native Gemini grounding/tool-selection interactions and record the actual execution path.
- [ ] Spike isolated writing requests through existing model adapters without Quick Chat history/memory leakage.
  - [x] Implement the direct-adapter writing boundary and deterministic service/runtime/lifecycle tests. Live provider request capture and packaged-app retention checks remain pending.
  - [x] Add offline compatibility coverage for every registered text provider, four custom API formats, OAuth factory routes, and Perplexity's serialized no-search policy. See [provider compatibility](./writing-provider-compatibility.md); live service guarantees remain unverified.
- [ ] Compare candidate tabular engines on supported operations, decimal/date correctness, input size, cancellation, memory/temp storage, security controls, installer impact, and licensing.
- [ ] Check Excel parser behavior for sheets, formula caches, hidden rows, merged headers, links, dates, and archive limits.
- [ ] Evaluate PDF/DOCX provenance and scanned-page detection; identify local/remote OCR candidates without enabling uploads.
- [ ] Prove a read-only Drive operation surface, per-file authorization/Picker viability, Sheets/Docs access, and desktop redirect flow using a test account.
- [ ] Document public Google OAuth ownership, review requirements, and onward-transfer policy constraints.
- [ ] Spike selected-text capture/replacement on macOS test controls and target apps; report safe fallbacks and unsupported cases.
- [ ] Decide native snapshot/storage ownership and how it differs from KB, workspaces, and imported conversation history.

### Deliverables

Baseline report, synthetic corpus, runtime/parser decision, OAuth decision, selection feasibility matrix, revised estimates, and Phase 1 implementation specification.

### Exit gate

Writing can progress independently when its request-isolation and quality baseline are ready. Computation, OAuth, OCR, and replacement each retain a separate blocked/ready decision with evidence.

An inconclusive engine spike is not permission to embed arbitrary Python. An OAuth obstacle is not permission to request broader scopes or scrape private Drive pages.

## Phase 1 — Everyday writing beta

**Outcome:** correct a message faster than switching to another app.  
**Effort:** 2–3 engineer-weeks.  
**Dependencies:** Phase 0 writing gate.

### Tasks

- [ ] Add an internal writing request policy and provider-neutral service; reuse existing credentials, streaming, cancellation, error translation, and usage tracking.
  - [x] Implement service, configured-model selection, streaming, cancellation, bounded errors, and displayed token usage. Provider compatibility and usage-accounting review remain pending.
- [x] Default to Fix grammar. Add Natural, Shorter, Professional, and Casual as explicit alternatives.
- [x] Specify preserve-meaning behavior for names, numbers, dates, links, markdown, code, mentions, negation, certainty, and commitments.
- [x] Show one primary rewrite with Copy, retry, cancel, and optional original-text comparison. Model-generated explanations are not implemented.
- [x] Integrate into existing Quick Chat and main-chat entry points without another agent or sidebar system.
- [x] Use only the current draft and selected style/context at the writing service boundary. Do not inherit unrelated chat, tools, or general memory; live provider validation remains in Phase 0.
- [x] Use shared picker/runtime model eligibility, reject stale or non-text selections, and support Perplexity writing with search explicitly disabled. Keep remote agent sessions excluded.
- [ ] Keep drafts/results ephemeral by default. Add explicit Save to chat; exclude unsaved work from ordinary chat sync and memory auto-save.
  - [x] Implement local review state, unmount cancellation, explicit Save, and content-bearing diagnostic suppression. Packaged retention/sync checks remain pending.
- [ ] Support paste/copy first; shortcut capture must require an intentional capture action and a visible draft preview before sending.
  - [x] Implement paste/review/copy without automatic capture or sending. Native clipboard and platform checks remain pending.
- [ ] Provide first-use provider setup/readiness, model choice, and visible destination; no hidden fallback model.
- [ ] Test keyboard navigation, screen readers, focus return, multiline text, mixed English/Vietnamese, emojis, and small screens.

### Acceptance scenarios

- Copy a Slack draft, invoke writing, correct it, and copy the result without composing a prompt.
- Change tone without inventing a deadline, apology, promise, or new fact.
- Cancel an in-flight correction; no late rewrite replaces newer input.
- Close/reopen the app; an unsaved draft does not appear in history, memory, or sync.
- Provider failure preserves the original draft and offers an actionable retry.

### Exit gate

Pass writing quality and privacy gates in the validation document. Release to a small opt-in beta before adding replacement.

## Phase 2 — Shared sources, evidence, and jobs

**Outcome:** one trustworthy intake and provenance path for later analysis.  
**Effort:** 1–2 engineer-weeks.  
**Dependencies:** Phase 0 storage/security design.

### Tasks

- [ ] Define Zod/shared/native contracts for snapshots, source parts, job state, coverage, analysis results, and errors.
- [ ] Add selected-file intake through platform/native ownership; support current attachments only through a reviewed conversion path.
- [ ] Implement app-owned staging, hash/metadata, atomic publication, owner binding, and native size/resource budgets.
- [ ] Add preview and source tray with unsupported, partial, cancelled, and failed states.
- [ ] Record origin, capture time, version/hash, parser version, and source locators.
- [ ] Add provider disclosure and authorization before sending excerpts, schemas, samples, or results.
- [ ] Implement cancellation propagation, late-result rejection, crash recovery, deletion, and quota cleanup.
- [ ] Define persistence: ephemeral staging versus intentionally saved analysis; keep snapshots out of existing sync by default.
- [ ] Add explicit unsupported platform behavior and disabled capability UX.

### Exit gate

Interrupted imports do not become ready sources. Cross-session/window access is rejected. Deleted source bytes and indexes are not available through stale IDs. All partial extraction states are visible.

## Phase 3 — Deterministic CSV and Excel analysis

**Outcome:** reliable numerical answers over complete authorized tables.  
**Effort:** 3–4 engineer-weeks.  
**Dependencies:** Phase 2 and approved runtime/parser decisions.

### Tasks

- [ ] Add bounded CSV ingestion with delimiter, encoding, header, null, date, decimal, and identifier previews.
- [ ] Add XLSX sheet selection and typed values; report formula-cache availability, hidden/filtered rows, merged headers, and skipped content.
- [ ] Preserve raw source values and source row/cell locators alongside interpreted tables.
- [ ] Add data profiling: counts, nulls, duplicates, type conflicts, and basic ranges.
- [ ] Define typed operations for filters, sort, projection, derived columns, aggregates, grouping, joins, and descriptive statistics.
- [ ] Validate identifiers, expression types, allowed functions, join behavior, budgets, and requested source IDs before execution.
- [ ] Apply actual engine restrictions and bounded cancellation; test that model input cannot enable external I/O.
- [ ] Add clarifications for ambiguous metrics, periods, currencies, units, join keys, and “duplicate” definitions.
- [ ] Return deterministic tables plus coverage/recipe metadata. Generate charts only from those tables.
- [ ] Add evidence drawer with rows examined, exclusions, query/recipe, versions, warnings, and a rerun action.
- [ ] Export safe CSV and chart/report artifacts through a native picker; do not write source files.
- [ ] Distinguish complete answers from exploratory samples and unsupported operations.

### Acceptance scenarios

- Compare two monthly files and reconcile all sums against independently computed expected results.
- Join customer and transaction tables without silently multiplying revenue through duplicate keys.
- Preserve customer ID `00123` and distinguish empty cells from zero.
- Explain that formula results may be stale or unavailable rather than fabricate recalculation.
- Reject an oversized input or unsupported analysis with a useful recovery route.

### Exit gate

Exact-fixture numerical results pass; every quantitative answer identifies its input snapshots and operations. Security/cancellation/resource tests pass on each advertised desktop target.

## Phase 4 — PDF, DOCX, and document understanding

**Outcome:** useful document answers with inspectable evidence and honest coverage.  
**Effort:** 2–3 engineer-weeks; OCR may require separate re-estimation.  
**Dependencies:** Phase 2; Phase 3 for arithmetic over extracted tables.

### Tasks

- [ ] Reuse/extend local parsing and retrieval while preserving page, paragraph, heading, and table locators.
- [ ] Support text PDF, DOCX, TXT, and Markdown; classify encrypted, corrupt, legacy, and unsupported inputs explicitly.
- [ ] Detect scanned and mixed-content PDFs; report readable versus unreadable pages.
- [ ] Implement source-linked summary, questions, comparison, and quoted evidence.
- [ ] Add an explicit OCR sub-flow only after its quality/privacy/packaging gate passes; show provider and estimated cost before remote OCR.
- [ ] Expose OCR uncertainty and unprocessed regions; do not label incomplete documents fully analyzed.
- [ ] Add table extraction preview and correction/confirmation before treating extracted cells as analytical input.
- [ ] Test headings, footnotes, multi-column pages, page breaks, images, and document prompt injection.
- [ ] Distinguish retrieval-limited answers from whole-document claims.

### Exit gate

Evidence links resolve to the correct snapshot/location. Missing evidence produces a qualification or refusal. Scanned pages and unreliable tables cannot silently enter exact numerical answers.

If OCR is blocked, ship text-document support with clear limitations; the scanned-PDF milestone stays incomplete.

## Phase 5 — Google Drive, Sheets, and Docs

**Outcome:** selected cloud files use the same reliable local analysis path.  
**Effort:** 2–3 engineer-weeks after feasibility; external review is additional.  
**Dependencies:** Phase 2, approved OAuth/access design, and Phases 3/4 for supported formats.

### Tasks

- [ ] Reuse connected-account metadata, secure token storage, account selection, and refresh locking.
- [ ] Introduce a narrowly scoped analysis authorization path without silently mutating existing broad Google/MCP connections.
- [ ] Implement the approved desktop OAuth/Picker flow; do not ship developer client-ID setup as the final consumer onboarding.
- [ ] Bind selected file IDs to the chosen account and owning analysis. No whole-Drive indexing.
- [ ] Display name, type, owner/account where available, modification/capture time, selection, and export limitations.
- [ ] Implement bounded read-only downloads/exports and Sheets range acquisition.
- [ ] Preserve formula/value semantics, sheet selection, locale, and source metadata; reuse local table/document processors.
- [ ] Detect changes during acquisition; snapshot each input and record cross-file acquisition skew.
- [ ] Handle denied download, shared-drive restrictions, shortcuts, revoked permissions, expired tokens, quota, offline, and retry.
- [ ] Disclose downstream model/OCR transfer and respect organizational restrictions. Never scrape around access denial.
- [ ] Add explicit refresh creating a new version, disconnect behavior, and local snapshot deletion choices.

### Exit gate

Complete a test-account flow for CSV/XLSX, Sheets, PDF, and Docs. Public release additionally requires approved OAuth ownership/configuration and policy review. No remote mutation API is exposed.

When public authorization is blocked, keep Drive experimental or unavailable; local analysis remains usable.

## Phase 6 — Personal continuity

**Outcome:** repeat useful work without opaque memory or stale-data mistakes.  
**Effort:** 1–2 engineer-weeks.  
**Dependencies:** Phase 1 for preferences; Phases 2–4 for saved analyses; Phase 5 for Drive refresh.

### Tasks

- [ ] Add explicit writing preference controls: tone, English variant, formatting, and reviewed terms.
- [ ] Reuse existing editable memory only for intentionally saved durable writing facts; do not save every rewrite.
- [ ] Add Save analysis with title, sources, evidence, recipe, parameters, and result provenance.
- [ ] Add recent saved analyses through existing conversation/project navigation.
- [ ] Rerun the recipe against the same snapshots; require explicit mapping when rebinding new sources.
- [ ] Offer Refresh and rerun with a changed-source summary and provider disclosure.
- [ ] Handle schema drift, missing columns, changed units, deleted sources, and disconnected accounts.
- [ ] Allow an approved analysis result to become a writing draft without attaching the whole source dataset.
- [ ] Provide deletion/export behavior and clear explanations of already-sent or already-exported derivatives.

### Exit gate

A saved monthly report can be rerun reproducibly. Changed inputs produce a new run/version. The app never silently swaps sources, providers, metrics, or schemas.

## Phase 7 — Narrow desktop capture and replacement

**Outcome:** improve selected text without risking the wrong app or accidental send.  
**Effort:** 2–3 engineer-weeks for the first validated platform; other platforms re-estimated separately.  
**Dependencies:** Phase 1 and approved selection feasibility/security review.

### Tasks

- [ ] Add explicit selected-text capture using existing shortcut/permission foundations.
- [ ] Implement native owner-bound, expiring, one-use target tickets; expose no general typing authority.
- [ ] Preserve source selection identity while Quick Chat receives focus.
- [ ] Show source app and proposed replacement; require user confirmation.
- [ ] Revalidate target and exact selection immediately before replacement; reject changed/unknown/secure targets.
- [ ] Verify insertion where supported and display the actual outcome.
- [ ] Use Copy as fallback, not broad computer-use activation or simulated Enter.
- [ ] Test Slack, WhatsApp, a browser textbox, a standard editor, and unsupported controls in packaged builds.
- [ ] Document platform/app/version support; disable unverified combinations.
- [ ] Keep workspace, browser, general computer-use, and analysis permissions independent.

### Exit gate

Zero wrong-target changes and zero sends in the adversarial fixture matrix. Focus changes, stale selections, revoked permissions, repeated tickets, and app restarts fail closed.

## Phase 8 — Release and sustained quality

**Outcome:** ship the proven slices with recovery and honest support claims.  
**Effort:** 1–2 engineer-weeks plus ongoing regression work.  
**Dependencies:** each feature's exit gate, not completion of all later features.

### Tasks

- [ ] Run automated suites, packaged-app workflows, accessibility checks, and platform-specific capability tests.
- [ ] Review model/version compatibility, source limits, costs, latency, and cancellation under realistic inputs.
- [ ] Verify schema upgrades, old-data behavior, independent feature rollback, and no sensitive diagnostics.
- [ ] Publish a support matrix and clear documentation for writing, analysis formats, Drive, OCR, and replacement.
- [ ] Conduct a two-week opt-in task diary trial with reasons for falling back to Gemini/Grok.
- [ ] Fix the highest-frequency blocking failures before expanding scope.
- [ ] Update product/architecture documentation only when behavior actually ships.

### Release decision

Promote individual slices from development → opt-in alpha → personal beta → stable. Any numerical corruption, unintended data transfer, wrong-target replacement, or source mutation blocks the affected slice and triggers its independent rollback.
