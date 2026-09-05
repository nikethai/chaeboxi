# Validation, Budgets, and Rollout

**Status:** release targets remain proposed. Writing has an implementation checkpoint, synthetic corpus, and deterministic checks; see [writing evaluation](./writing-evaluation.md). Human quality, performance, and packaged-platform gates are not yet demonstrated.

## 1. Evidence hierarchy

1. Exact deterministic fixtures for computation, authority, lifecycle, and export.
2. Human-reviewed task outcomes for rewriting and document interpretation.
3. Packaged-app workflows for permissions, selection, OAuth, and source acquisition.
4. A consented personal-use diary for adoption and switching behavior.

Unit tests alone do not prove that a Slack rewrite or Google Sheets analysis is useful. User preference alone does not prove numerical correctness or safe access.

## 2. Evaluation corpus

Keep synthetic/redacted fixtures in the repository. Do not commit real Slack/WhatsApp conversations, private spreadsheets, downloaded Drive files, tokens, or provider responses containing private data.

Proposed minimum corpus before each corresponding release:

| Area | Corpus | Required properties |
| --- | --- | --- |
| Writing | 40 drafts | Grammar, tone, slang, mixed English/Vietnamese, emoji, multiline, markdown, code, mentions, names, dates, negation, uncertainty |
| Tables | 20 tasks across at least 8 datasets/workbooks | Exact sums/counts, decimal rounding, grouping, joins, nulls, duplicate IDs, leading zeros, mixed types, formulas, date systems |
| Documents | 20 questions across at least 8 documents | Text/scanned/mixed PDF, DOCX, absent answers, conflicting evidence, tables, multi-column layouts |
| Google | At least one synthetic file of each supported type | CSV, XLSX, Sheets, PDF, Docs; two accounts, shared permissions, revoked access, changed source |
| Desktop | At least 30 normal/adversarial transitions per supported app/platform | Selection, focus drift, secure fields, stale ticket, cancellation, repeated invocation, changed draft |

Model evaluations require a configured provider and explicit approval of any paid calls or third-party data transfer. Do not run them automatically in ordinary CI. CI uses deterministic fixtures/mocks for model boundaries; designated evaluation runs record provider/model/date/prompt-policy version.

## 3. Quality gates

### Writing

- Human rates at least 90% of the writing corpus usable without another rewrite; refine the target after baseline.
- Zero critical meaning changes in the regression set: changed names, amounts, dates, negation, commitments, or certainty.
- Selected tone does not add facts or erase important formatting.
- Output remains copyable during non-destructive errors; original text is always recoverable.
- Unsaved content never enters general memory, previous-chat context, ordinary history sync, or diagnostics.

### Numerical analysis

- 100% of supported exact-fixture computations match independent expected results.
- Define tolerances explicitly for floating-point statistics; do not use a blanket tolerance for currency.
- Every numerical answer includes a completed run, snapshot IDs, row coverage, operations, and warnings.
- Charts exactly reflect computed result tables, including filters, units, and denominators.
- Unsupported operations, truncated data, invalid types, or failed jobs cannot return a full-data success state.

### Documents

- Every displayed evidence reference resolves to the correct snapshot and page/paragraph/table.
- Human evidence review finds no unsupported material factual claim in the release fixture set.
- All known unreadable/skipped fixture pages are disclosed.
- Questions with absent evidence are qualified or declined rather than fabricated.
- Arithmetic over extracted tables is blocked until validated conversion succeeds.

These are release-test requirements, not promises that all future model answers will be error-free.

### Personal-use outcomes

During a two-week opt-in trial, aim for:

- At least 80% of eligible writing tasks completed in Chaeboxi without switching apps for a rewrite.
- At least 70% of eligible supported analysis tasks completed with a verified result.
- Falling median time to a usable result relative to the user's own baseline.

Report raw task counts, exclusions, and reasons for switching. A small personal trial is not a population retention study. Do not game the denominator by reclassifying failed supported tasks as ineligible.

## 4. Proposed resource envelope

Phase 0 must validate or lower these starting targets on a recorded reference machine. They are not current product limits, guaranteed maxima, or a reason to reject existing unrelated attachment workflows.

| Resource | Initial candidate budget | Behavior when exceeded |
| --- | --- | --- |
| Writing input | 8,000 characters per quick rewrite | Explain limit; offer normal chat or smaller selection |
| CSV | 50 MiB, 250,000 rows, 200 columns, and 5 million cells; all caps apply | Reject full analysis or explicit preview-only mode |
| XLSX | 25 MiB compressed, 100 MiB expanded, 1 million selected cells | Stop before excessive expansion; request smaller workbook/range |
| PDF/DOCX | 25 MiB input, 200 pages for PDF, bounded expanded DOCX content | Explain unsupported size/coverage; select a smaller source |
| Selected sources | 5 per initial analysis | Ask for a smaller selection |
| Native worker | 512 MiB working-memory target, 1 GiB temp-disk cap | Enforce actual limits or keep runtime blocked |
| Long work | 60 seconds per parse/query operation; progress and cancel | Cancel/terminate safely; mark incomplete, never fabricate result |
| Result delivered to model | 200 rows and 32 KiB serialized per tool result; both caps apply | Aggregate/page; never confuse bounded output with bounded computation |
| Preview UI | Page data; no full table in React state | Fetch bounded slices |

Compression ratio, nested archive depth, OCR page/time limits, source-download timeouts, and concurrent-run budgets must be finalized with parsers/runtime in Phase 0. Start with one active analysis job per device unless measurements justify more.

Suggested responsiveness goals:

- Warm Quick Chat writing surface opens within 500 ms on the reference desktop.
- UI shows request/progress/cancel state within 200 ms of action.
- Short rewrites target a complete answer within 5 seconds on the chosen model/network; report p50/p95 separately and do not treat provider latency as an app guarantee.
- Cancel acknowledgment appears within 250 ms; native/network termination must have a tested upper bound.

Measure warm and cold startup separately. Record hardware, OS, build type, engine/model version, network conditions, input size, and all failures.

## 5. Security and failure matrix

Mandatory test categories:

- Cross-window/session source access; forged, stale, deleted, or wrong-account IDs.
- Spreadsheet/document prompt injection requesting file access, credentials, web calls, or message sending.
- Engine attempts at external reads, network access, extension loading, multiple statements, and unbounded joins.
- Archive bombs, path traversal, malformed formats, encrypted files, parser timeouts, temp-disk exhaustion.
- Formula injection in exported CSV and active content in reports/charts.
- Unexpected source change, duplicate refresh, schema drift, interrupted import, crash during publication.
- Provider timeout, rate limit, unsupported model capability, failed stream, cancellation, and late completion.
- Google OAuth state/PKCE validation, refresh races, revoked consent, denied download, 429, and cross-account confusion.
- Hidden remote transfer, raw-data logging, automatic memory extraction, and accidental source sync.
- Wrong app/window/selection, expired/reused replacement ticket, secure fields, user typing during review, permission revocation.
- Export destination cancellation, existing-file overwrite confirmation, and originals remaining unchanged.

## 6. Implementation test commands

Use existing project commands after implementation, narrowing to changed suites during development:

```bash
pnpm test
pnpm check
pnpm lint
pnpm build:renderer
pnpm build:web
cargo test --manifest-path src-tauri/Cargo.toml --lib
```

Full native tests/builds require the documented platform toolchain. If adding an analysis-only harness, document its exact command when it exists; do not claim it is already available.

Run packaged desktop builds for shortcuts, OS consent, window ownership, AX replacement, Google redirects, and native parser/engine packaging. Browser-only tests cannot substitute for these checks.

Record existing baseline failures separately rather than weakening tests or fixing unrelated code inside feature PRs. The initial planning-only change did not run these commands; subsequent writing checkpoint verification and baseline TypeScript failures are recorded in [writing evaluation](./writing-evaluation.md#evidence-and-remaining-work).

## 7. Rollout and rollback

Independent proposed gates: writing action, local analysis intake, tabular engine, document extraction, OCR, Drive intake, saved recipes, and text replacement.

1. **Development:** synthetic fixtures, no automatic external data/calls.
2. **Opt-in alpha:** consented test inputs; desktop capabilities remain explicitly gated.
3. **Personal beta:** user's selected tasks, local diary, visible limits, no background data collection.
4. **Stable:** per-slice exit gates, packaged-platform coverage, documentation, and rollback check.

Kill switches must disable the responsible native/API capability, not only hide a button. Revocation rejects new operations and cancels/rejects in-flight completion where necessary.

Rollback preserves saved source/run metadata and marks temporarily unsupported operations honestly. Never silently migrate analyses back to generic file reading and call that equivalent execution.

Critical stop-ship events: incorrect supported deterministic calculation, unauthorized disclosure, mutated original, wrong-target replacement, accidental send, or cross-account/source access.

## 8. Reporting template

Each release candidate records:

- Commit/build, enabled gates, supported platforms/formats, and limits.
- Fixture counts and exact pass/fail results; model-dependent versus deterministic tests.
- Measured performance and costs, not estimates presented as measurements.
- User-trial outcomes and known failure reasons.
- Privacy/security review findings and residual risks.
- Data/schema compatibility, rollback evidence, and documentation updates.

The roadmap is complete when supported real workflows pass these gates, not merely when all UI surfaces exist.
