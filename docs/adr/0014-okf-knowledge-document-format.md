---
type: decision
status: stable
verified:
  - by: human:nikethai
    at: 2026-10-17T22:15:00+07:00
generated: { by: codex/gpt-5, at: 2026-10-17T21:52:56+07:00 }
sources:
  - id: okf-02
    resource: https://github.com/GoogleCloudPlatform/open-knowledge-format/blob/0b87c52c6ef999286c745e19998fdfcd03d5dbee/SPEC.md
    title: Open Knowledge Format specification, version 0.2
---
# ADR 0014: OKF for knowledge documents, not authority

Status: **accepted** by maintainer, 2026-10-17. Authorizes using OKF 0.2 with SQLite-backed storage for curated knowledge; implementation remains unscheduled.

## Context

TASK-4 suggests mapping OKF onto Dango's knowledge: sources as reference material, draft/stable as proposal/authoritative, verified as approver, stale_after as review, and log.md as change history. The repository already uses OKF-style metadata for planning documents, but that is not an app storage decision or proof that the entire docs tree is an OKF-conformant bundle.

Dango's accepted decisions require explicit approval of authoritative knowledge ([ADR 0001](0001-user-approved-knowledge-authority.md)), scoped source access and privacy ([ADR 0003](0003-explicit-knowledge-source-connections.md)), canonical revision history for hosted knowledge ([ADR 0008](0008-central-hosted-knowledge-authority.md)), and scope plus Everywhere ([ADR 0013](0013-everywhere-layer.md)). A document format must preserve these boundaries rather than replace them.

Reviewed upstream: OKF 0.2, SPEC.md at commit `0b87c52c6ef999286c745e19998fdfcd03d5dbee`.[^okf-02]

## Review findings

| OKF capability | Fit for Dango | Qualification |
| --- | --- | --- |
| Markdown plus YAML; required `type`; optional title, description and tags (§4) | Human-readable, diffable knowledge documents without a bespoke format | Unknown types and fields must remain readable; document parsing is not permission to apply content. |
| `sources` and stable per-source IDs for claim footnotes (§5.1) | Supports source-linked facts and proposals | A source can be a non-resolvable scope descriptor. Dango needs concrete evidence links when presenting traceable claims; OKF alone does not guarantee them. |
| `generated` and `verified` (§5.2–5.3) | Useful authorship and verification provenance | `human:` is an unauthenticated string, not proof of the user's approval. Verification need not be renewed after a content edit. |
| `status` (§5.4) | Useful portable lifecycle labels | Missing status means stable in OKF. Stable does not mean approved in Dango. |
| `stale_after` (§5.5) | A precise review-due instant | It is an absolute, timezone-aware datetime, not a TTL, deletion rule or automatic replacement. |
| Bundle paths, index and log (§3, §6, §8–9) | Portable organization and navigation | Concept identity is path-based; moves need Dango identity tracking. Prose logs are not a transactional revision or approval ledger. |
| Extensions and permissive consumption (§4, §11) | Dango can retain application metadata without forking OKF | Missing optional fields must not make an otherwise valid concept unreadable; application eligibility is a separate check. |
| Attested Computation (§10) | Not needed for initial knowledge documents | Executor and attester references must remain inert; adopting a format does not authorize code execution. |

The original direct mapping of `stable` to authoritative and `verified` to approver is unsafe. An imported document can claim both without any Dango user action.

## Proposed decision

### 1. Adopt the document format, not a new storage engine

Use OKF 0.2 as the document representation for curated knowledge and its import/export. Preserve separate original conversations, source records, attachments, retrieval indexes and learned-method lifecycle. This does not select a new SQLite schema, make Markdown files the physical source of truth, or replace the hosted revision authority in ADR 0008.

A bundle represents knowledge from one scope, including Everywhere as its own scope. An export spanning several scopes contains separate bundles plus Dango-owned scope mappings. Directory names and imported metadata cannot establish access rights. Cross-scope queries still follow the accepted scope and privacy policies.

Use concept documents for independently reviewable knowledge items. `CONTEXT.md` may be a concept or a generated view, but is not a mandatory single file containing all knowledge. `index.md` and `log.md` are reserved navigation/history files, not concepts. A bundle-root index may declare `okf_version: "0.2"`.

### 2. Keep approval and revision identity outside self-asserted frontmatter

Dango maintains stable item identity, revision identity, scope ownership, source permissions, and an approval record bound to the exact content revision. These remain application-controlled even if exported as additional metadata. The concrete envelope/schema and content-binding mechanism require implementation design; importing an envelope does not authenticate it.

- Dango-generated factual proposals export with `status: draft` and authorship metadata.
- Dango-approved current revisions export with `status: stable`; a human verification event records the explicit approval. Existing independent verification events may also be retained.
- Ordinary imports enter the reference/proposal workflow, even when they say stable or contain `verified: { by: human:... }`. They do not become governing knowledge automatically.
- A meaningful edit creates a candidate revision needing approval; it does not inherit approval merely because an old verifier or timestamp remains. The last approved revision stays in use until a replacement is approved.
- Pending proposals stay out of ordinary answer context under ADR 0001. Reading one on explicit request does not approve it.
- Deprecated concepts stay available for history/reference but do not govern current answers. Deprecation and deletion remain distinct.
- Missing status retains OKF's stable lifecycle interpretation, but gives no Dango approval. A concept with only `type` remains readable as reference material.

This rule governs authoritative knowledge, not the separately accepted automatic method-learning policy in ADR 0007. Method activation must not be implemented as automatic factual approval.

### 3. Carry provenance and freshness without automatic promotion

Preserve `sources`, stable source IDs and matching footnotes. For Dango-generated derived knowledge, record concrete source record/revision links when available; label unavailable evidence and coverage gaps honestly. An upstream scope descriptor can be preserved as provenance, but cannot masquerade as a retrievable citation.

Normalize a bare `verified` mapping to a one-element event list when reading. Preserve unknown fields when round-tripping. Treat authors, verifier names, usage counts and source dates as evidence claims, not authorization or an automatic credibility score.

Use timezone-aware `stale_after` values as review-due signals. A passed deadline or changed source marks affected approved knowledge for review; it neither proves the knowledge false nor approves a replacement. Continue using the last approved version with a relevant notice, as ADR 0001 requires. Invalid or timezone-free freshness metadata yields a visible unknown/invalid state rather than a claim of freshness.

`log.md` is an optional human-facing change summary. Approval events, revision ancestry, conflicts, deletion and hosted commit state remain in Dango's durable application history, not inferred from prose or filesystem timestamps. Synchronization and user approval remain independent states.

### 4. Keep scope, privacy and execution boundaries authoritative

Scope plus Everywhere retrieval and client opt-ins remain exactly as ADR 0013 defines them. A cross-link is not permission to read another scope, and importing a directory does not make its contents global. All processing and derived documents retain applicable source restrictions; a bundle or metadata edit cannot relax local-only processing, background-review permissions or sync enrollment.

Parse metadata with a safe, bounded YAML reader. Resolve bundle-root paths within the bundle, never as absolute OS paths; do not follow escaping paths or symlinks. Markdown links and source URLs are data, not permission to fetch remote content or discover unconnected sources. Unknown fields/types, including Attested Computation metadata, stay inert. Never run imported executors, attesters, scripts, or document instructions merely because they appear in OKF.

### 5. Keep this spike separate from implementation

Acceptance of this ADR completes the TASK-4 format decision, not app support. No parser, storage migration, sync protocol, auto-ingestion, executable computation runtime or change to existing user data is authorized here. No follow-up tasks are created by this proposal.

Before any implementation, its reviewed plan must specify the application envelope, safe parsing and resource limits, identity/move handling, approval binding, lossless round-trip behavior, migration/rollback, and tests. Required acceptance scenarios include:

- A minimal `type`-only document, unknown types/fields and broken links remain readable; optional metadata never grants authority.
- Imported stable documents, forged human verification and edits carrying old verification cannot bypass approval; proposals do not leak into ordinary answer context.
- Bare/list verification forms, timezone boundaries, stale approved content and invalid freshness data are handled without inventing approval or freshness.
- Scope isolation, Everywhere client defaults and local-only restrictions survive import, export, retrieval and derived summaries.
- Identity survives supported document moves; stale hosted revisions cannot overwrite accepted content; sync completion does not imply user approval.
- Hostile YAML, path traversal, symlink escape, remote links and executable metadata cannot gain filesystem, network or execution authority.

## Alternatives

- **Adopt raw OKF lifecycle as Dango authority.** Rejected: stable defaults and self-asserted verification bypass user approval and do not bind an accepted revision.
- **Invent a Dango-only Markdown format.** Rejected for now: repeats OKF's useful metadata and reduces portability without removing the need for application controls.
- **Replace every store with a Git-backed Markdown tree.** Not selected: OKF does not prescribe storage, transactions or synchronization, and the accepted design allows existing stores behind a common retrieval boundary.
- **Keep OKF only for repository planning docs.** Simpler initially, but leaves the app knowledge-document format unresolved. The proposed profile reuses OKF without mistaking document metadata for authority.

## Consequences and completion

The format is a good fit for portable, inspectable curated knowledge, but only with Dango-owned approval, scope and revision controls. It is not a complete knowledge-store design, an authorization mechanism or an executable-agent standard.

The review and proposed decision satisfy the research/proposal portion of TASK-4. Maintainer acceptance or an explicit alternative decision remains before closing the spike. No runtime behavior was implemented or tested by this review.

[^okf-02]: [OKF 0.2 specification at the reviewed revision](https://github.com/GoogleCloudPlatform/open-knowledge-format/blob/0b87c52c6ef999286c745e19998fdfcd03d5dbee/SPEC.md), especially §4–6 and §8–12.
