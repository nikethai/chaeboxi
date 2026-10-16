---
type: spec
status: draft
description: "Chaeboxi personal assistant design"
---
# Chaeboxi personal assistant design

Status: draft; section-by-section review in progress. Understanding and focused evolution are accepted. Implementation has not started or been authorized.

## Confirmed understanding

The product helps the user resume work across conversations, AI tools, and devices. Preserve the desktop Quick Chat foundation, develop the agreed canvas experience first, and add scoped recall, automatic method learning, and cross-device continuity incrementally. Approved knowledge remains user-controlled. Optional hosted sync precedes Cloud Knowledge. Mobile remains useful independently of the desktop; one maintainer and low operational burden constrain delivery.

Detailed requirements, assumptions, and acceptance scenarios remain in [the refinement plan](2026-09-06-product-refinement.md) and [the ADRs](../adr/).

## Decision log

| Decision | Alternatives | Reason |
| --- | --- | --- |
| Evolve existing application foundations. | Minimal artifact patches; fixed visual templates. | Preserve existing work while making continuity and canvas behavior coherent. |
| Selectively reuse OpenDots, OpenMuse, and OpenBot patterns. | Wholesale replacement; build all patterns without references. | Gain useful designs without committing to their storage, runtimes, or service footprint. |
| Preserve distinct, source-linked conversations, work records, approved knowledge, and learned methods behind a common retrieval boundary. | Collapse everything into an undifferentiated memory summary. | The user accepted traceable recall, attribution of recorded outcomes, and separation of evidence from authoritative knowledge. |
| Use focused, scoped retrieval with source-linked answers and explicit coverage gaps. | Inject entire histories; treat failed searches as no matches. | The user accepted concise recall that preserves project applicability, approval status, and source privacy. |
| Learn supported methods automatically in bounded background processing, with relevant loading, evidence, history, and undo. | Approve every method manually; trust every generated lesson automatically. | The user accepted useful automatic improvement while retaining authority over facts and permissions. |
| Centralize the accepted revisions of hosted knowledge, with device caches and queued submissions. | Competing authoritative knowledge replicas on each device. | The user preferred fewer conflicts and accepted instant local persistence, quick background sync, and fallback to cached approved knowledge. The timing target needs measurement. |
| Use a user-held recovery key for encrypted sync-only content. | Service-assisted content recovery. | The user selected recovery without giving the service a way to decrypt that content; loss of every trusted device and the key is unrecoverable. |
| Let eligible, explicitly enabled devices take over shared learning through the central sync service. | Wait for one designated desktop. | The user accepted the device-to-service-to-device flow after clarifying how records and learned results synchronize. Coordination mechanics still need technical validation. |

## 1. Traceable work and context — accepted

Keep a durable, source-linked record of work instead of collapsing everything into one memory summary. Existing conversation, artifact, KB, and memory stores can remain behind a common retrieval boundary; a wholesale storage migration is not assumed.

Four types of material have distinct roles:

- Conversations and canvases: the original exchange and its outputs, with revision identity.
- Work records: concise accounts of a task, its source tool, project, timestamp, recorded outcome, and unresolved work, linked to the original evidence.
- Approved knowledge: the user's accepted preferences, facts, and project guidelines.
- Learned methods: reusable procedures and search strategies with supporting outcomes and revision history.

Import records only from sources explicitly connected by the user. Retain stable origin identifiers to recognize repeated imports. An agent's claimed outcome is attributed to that record, not automatically treated as independently verified completion. Derived summaries are navigation aids, not approved facts.

For "Where did I leave the PRU update?", retrieve relevant records within the intended scope, give a concise status with sources, and identify missing or conflicting evidence. Opening the result returns to the original thread or source when accessible. An unavailable source is labelled honestly; cached evidence can still be read subject to its access policy.

Only relevant context reaches the selected model. The background learning process and sync reuse these identities and scopes, preserving approval status and source privacy. This section defines behavior and ownership; concrete schemas, storage, and adapters are still to be designed.

## 2. Recall and answer flow — accepted

One recall flow searches connected agent records, chat history, approved knowledge, and KB material through their respective adapters. Cloud Knowledge becomes an additional route for explicitly enrolled collections, not an implicit destination for all searches.

Resolve scope from the current project and the user's request. Explicit cross-project history searches may span the authorized sources, while project guidelines remain applicable only to their project. Ask a short clarification if applying a project-specific rule requires an unresolved choice; a pending knowledge conflict does not block ordinary answers.

Retrieve focused matches, then expand the original evidence when a summary cannot support the answer. Preserve origin, project, timestamp, revision, approval status, and access policy in the retrieved material. Search ordering may learn from successful use; ranking cannot elevate a draft above an approved guideline as the governing rule.

Return a concise answer with source links and relevant review-needed or freshness notices. For unfinished work, distinguish recorded next steps from newly suggested next steps. If no evidence is found, say so and offer to broaden the search. Search failures, excluded material, and missing downloads are reported as incomplete coverage rather than "no matches."

Per-source privacy governs local processing, hosted search, and the final model request separately, including derived summaries. A cloud-search result is not automatically eligible for every answer provider. Locally cached results remain available offline under the same policy; show the last known source/sync time rather than imply current completeness.

Finding work ends with the answer and source links. Resuming another agent or taking an external action requires a separate user request and its applicable capability authorization.

## 3. Background method learning — accepted

The memory worker reviews completed exchanges and newly available records only where background review is enabled. Run this outside the interactive response path, in bounded batches, with configurable provider and processing budgets. Initial learning runs on devices; hosting encrypted sync does not authorize server-side learning.

Extract narrow lessons supported by evidence: a user correction, an observed successful outcome, or a search result that demonstrably answered the request. An agent claiming success or the absence of a complaint is insufficient by itself. Associate each lesson with its supporting records and project/workflow scope.

Candidate methods stay out of ordinary answer context until qualifying checks pass. Methods that are supported, compatible with approved guidelines, and within existing permissions may become active automatically, without a per-method approval interruption. Qualifying checks and how success is measured need concrete implementation criteria and evaluation; they must not amount to the model merely declaring its own lesson good.

Active methods are versioned instructions or search strategies, loaded only when relevant. They cannot introduce executable scripts, new tool authority, provider changes, or changes to authoritative facts. A new factual claim or guideline change becomes a knowledge proposal instead.

A compact Learning history shows what changed, its source evidence, and Undo/Disable. Retain the previous working revision; an undo prevents the same revision from immediately being reapplied by the next worker run. Conflicting lessons remain unresolved without disrupting chat. Source privacy and project scope apply to derived lessons and their sync eligibility. Device coordination and concurrent revisions are addressed in the sync design.

## 4. Cross-device continuity and conflicts — partially accepted

Hosted knowledge uses the central authority selected below. The general replica proposal in the following paragraphs is superseded for hosted knowledge; its application to chats, canvases, work records, and learned methods remains proposed. This distinction does not reopen user approval or source privacy boundaries.

Each enrolled device works from a local copy of its selected data. Save locally first and synchronize in the background when connected. A service outage does not prevent opening saved work or using a model reachable from that device. Show pending changes, last successful sync, and failures without blocking ordinary conversations.

Chats, canvases, memories, work records, and learned methods have stable identities and revision ancestry. Merge independent additions automatically. Concurrent edits to the same content preserve both revisions rather than silently choosing the newest device timestamp. Present the conflict in a review queue. Where a last common approved/working version exists, use it with a notice until resolution; otherwise keep branches distinct and identify the ambiguity rather than invent a reconciled authoritative version.

Deletion, method disablement, and undo are durable changes that propagate. Older offline copies cannot silently recreate deleted material or re-enable a disabled revision. Preserve conflicting edits for recovery while defining concrete retention and deletion rules later. Application-level conflict handling must be evaluated independently of transport revision checks.

Sync respects device-only and selected collection policies; original agent histories are not automatically uploaded in full. Imported work records and derived methods carry their source restrictions. Large KB downloads remain opt-in, and a collection's catalog does not imply its content is present locally.

Syncing a method or source description never grants folder access, OS permissions, Swarm activation, or computer control on another device. Provider credentials and native directory bindings stay device-specific in the initial design. Background learning needs coordinated work ownership and evidence identifiers to avoid duplicate analysis or repeated revisions; the exact coordination mechanism remains open.

### Conflict resolution interaction — proposed

Use common-parent revisions to distinguish a normal sequential update from concurrent changes. Different items and identical updates need no user review. Semantic disagreement about the same fact can still require review even when edits were not concurrent.

When resolution is needed, create one persistent review item with the previous version, both changed versions, their source/device attribution, and a concise comparison. Offer Keep this version, Keep the other version, Keep both as separate items, and Combine. Keep both retains an unresolved-conflict link where the items make incompatible claims; it does not make contradictions safe to apply together.

Combine prepares editable text, optionally assisted by the model only when the source/provider policy permits. The draft does not become authoritative until the user explicitly saves/approves the resolution. One resolution action supplies that approval; do not ask for redundant confirmation. Record the result as a new revision descending from both branches and sync it so stale clients recognize their edits were resolved. A genuinely new edit made offline against an earlier branch can create another conflict and must not be silently discarded.

An unresolved canvas conflict retains the previous working version and both candidates. For conflicting learned methods, retain the prior working method if one exists; otherwise use ordinary behavior without adopting either candidate. For simultaneous delete/edit, honor deletion from active retrieval and retain the competing edit for recovery subject to retention rules. Explicit method disablement beats automatic reactivation.

Show review items in a non-blocking queue and relevant notices where affected material is used. Do not interrupt unrelated chat or prompt repeatedly for the same unresolved conflict. This interaction is pending acceptance; storage, retention, and encrypted synchronization mechanics need technical design and tests.

### Central knowledge authority — selected

The user suggested centralizing the KB to simplify conflict handling. Recommended hosted variant: the service maintains a canonical revision history for each enrolled knowledge item, while devices retain selected local caches and queue changes. Connected devices read current versions before submitting changes; the service accepts an update only against its expected revision. Encryption-only collections can use opaque payloads with revision metadata without authorizing server-side search or learning.

Offline access continues for cached material, but edits are pending submissions rather than globally authoritative updates until committed. Non-conflicting submissions can commit on reconnect; stale competing edits remain recoverable and may require review. A central service serializes accepted writes but does not remove contradictory sources, simultaneous changes based on an old version, or semantic conflicts.

This variant applies to hosted/enrolled collections. Device-only knowledge remains local, and chats/canvases need their own continuity rules. Local processing and learned-method generation remain separate from central storage authority. Canonical learned-method revisions and coordination may follow the same pattern if confirmed later.

The user selected this direction over competing authoritative copies, requiring pending processing to be quick and a fallback to keep the assistant usable. This supersedes the general replica-merge proposal for hosted knowledge. Hosted-search access and tier sequencing remain governed by ADR 0006; see also ADR 0008. The fallback below is accepted; concrete timing needs measurement.

### Quick submission and fallback — accepted

Persist a knowledge edit immediately on the device, then submit it promptly when connected. Ordinary online updates should normally settle within a few seconds; this is a proposed product target to measure, not a guaranteed deadline. Pending synchronization and pending user approval are separate states. Central commit cannot approve an unapproved proposal.

Never wait for synchronization to complete before allowing chat. While a submission is pending or the service is unavailable, use the last locally cached approved version and indicate when it may be stale. An explicitly requested pending draft can be read as reference material with its status, but does not replace the governing approved knowledge. If no eligible cached evidence exists, continue from available chat context and clearly identify the knowledge coverage gap; do not invent missing knowledge or claim a complete search.

Retain pending submissions durably across restarts. Retry transient failures in the background with bounded backoff, offer Retry now, and show a compact persistent status rather than repeated popups. Authentication failures need sign-in and stale revisions need reconciliation; neither is solved by blindly repeating the same write. Preserve the user's edit for review while continuing with the approved cached version. Request-specific use of a draft does not grant permanent approval or change its sync status.

## 5. Device enrollment and recovery — recovery accepted; enrollment proposed

Sign in on a new device, approve it once from an existing trusted device, then synchronize the selected context. For encrypted sync-only collections, the service transports encrypted content; pairing must securely grant the new device access to the necessary keys. Exact account authentication, pairing protocol, and cryptographic design require a separate technical review. Device enrollment does not authorize native permissions or enroll additional sources.

Accepted recovery policy: give the user a recovery key to save outside the app. If every trusted device is lost, that key restores access to encrypted sync-only content after account authentication. Resetting the account password alone cannot decrypt that content. Losing both all trusted devices and the recovery key means that content cannot be recovered by the service. The user selected this over service-assisted content recovery. Cryptographic details remain subject to technical design and review; see ADR 0009.

Cloud-search collections have a separate service-readable access policy; recovery claims for encrypted sync-only content must not be generalized to those collections. Show enrolled devices and permit revocation of future service access. Revocation cannot guarantee erasure of previously downloaded content on a disconnected or compromised device.

Recovery policy is accepted. The proposed device enrollment interaction, authentication requirements, revocation behavior, and recovery-key setup interaction still need review.

## 6. Learning across devices — accepted direction

The user asked whether enabled devices could do the work instead of waiting for one designated desktop. Revised recommendation: permit automatic takeover among devices explicitly enabled for background learning. Device enrollment alone does not enable learning. An eligible device must have the required source access, decryption keys, permitted provider configuration, and available processing budget. Device-only records remain on their originating device.

Coordinate shared jobs through the sync service using limited-duration ownership claims. Only the current owner may publish a job result; expired ownership, duplicate submissions, and stale method revisions must be rejected or reconciled. Another eligible device may claim unfinished work after ownership expires. Duplicate computation after failures is possible, so do not promise exactly-once model execution; prevent duplicate publication and bound retries and spending. The service coordinates identifiers and ownership without needing plaintext learning content for encrypted sync-only collections.

Prefer an available desktop; allow enabled mobile devices to contribute within their execution and battery constraints, without promising continuous mobile background operation. If no eligible device is available, retain the queue and continue ordinary chat with existing methods. Scheduling defaults and concrete platform support require validation. Hosted learning remains deferred; enabling takeover does not authorize a new provider or source.

The user accepted this direction after clarification of the encrypted device-to-service-to-device flow. It replaces the earlier single-designated-desktop recommendation. Only successfully uploaded records are available to another device; unfinished uploads wait for the original device to reconnect. Canonical shared method revisions, undo/disable propagation, claim expiry and stale-owner rejection, privacy of coordination metadata, and evidence qualification require technical design and failure testing. The acceptance covers product behavior, not a validated protocol or implementation authorization.

## 7. End-to-end acceptance journeys — accepted direction

Use a small set of real, user-selected project records to demonstrate continuity. These supplement the accepted Quick Chat/canvas acceptance scenarios; they do not reorder the first build milestone.

1. Find previous work: ask which agent helped update a PRU function. Return the relevant source, recorded outcome, and unresolved work. Do not claim completion beyond the evidence or resume the agent. Include a missing-source case to verify honest coverage gaps.
2. Retain approved knowledge: approve a project guideline, then ask a related question in a fresh conversation. Apply it only in the correct scope. Add contradictory source material: flag it without silently replacing the approved guideline or blocking chat.
3. Learn a supported method: demonstrate a successful retrieval approach with observable supporting evidence, qualify it, then reuse it for a similar request. Verify that a mere success claim does not qualify. Show the lesson and its evidence in Learning history; disabling it prevents later reuse and automatic reactivation. Concrete qualification criteria remain a technical-design prerequisite.
4. Continue on another device: synchronize selected records and methods, then recover context on a second device without re-explaining it. Interrupt the worker and verify eligible takeover without duplicate publication. Unsynced and device-only evidence must not appear on the other device.
5. Degrade and recover: interrupt connectivity, retain pending edits through restart, use cached approved knowledge with freshness status, and reconnect without losing an edit. Verify encrypted recovery with the saved key and the documented failure case without any trusted device or key.

The user endorsed these journeys as the usefulness criteria. They are not executed tests or a complete release checklist. Service release gates, retention/deletion behavior, enrollment UX, and concrete learning qualification still require completion before a finalized design review.

## 8. First external agent source — candidates identified

The user identified Codex Work or Claude Cowork as the relevant first external source candidates, correcting the generic Codex recommendation. Do not assume the intended records are coding sessions. Evaluate access to selected work conversations, outputs, decisions, and recorded next steps from those two candidates, alongside Chaeboxi's own conversations and explicitly connected project documents. The first implemented connector remains undecided and should follow an access-feasibility check; identifying two candidates does not commit the first release to both. Prove a real context-recovery journey before expanding connectors. Quick Chat and canvas remain the first build milestone.

The initial integration should retrieve user-selected records, retain source attribution, and open the original record where supported. Importing or retrieving records does not authorize controlling or resuming the source agent. Source selection and separately enabled background learning follow the established policies. The access mechanism, supported record format, incremental refresh, and original-record navigation need a feasibility check; no available public API or supported integration is assumed.

Codex Work and Claude Cowork are confirmed candidates. Supported read/export access, permission scope, refresh behavior, source navigation, and the first connector choice remain pending. This is not implementation authorization.

The [October 13 access review](../research/2026-10-13-work-source-access.md) found a documented Codex thread-reading interface, a Cowork task-export route, and an Enterprise-only Cowork transcript API. It did not establish a personal live-history connector for ChatGPT Work or Cowork. Proposed first feasibility sample: one selected Cowork task export. Verify its contents before selecting an importer; manual export is a bootstrap/fallback and does not satisfy effortless ongoing source refresh. Codex thread access must not be conflated with all ChatGPT Work history.
