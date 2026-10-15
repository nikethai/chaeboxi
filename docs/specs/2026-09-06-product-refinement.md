# Personal assistant product refinement

Status: understanding and milestone acceptance scenarios confirmed; focused evolution selected; positioning and detailed design in progress. Implementation has not been authorized.

## Product direction

Chaeboxi supports quick conversations, information finding, brainstorming, visual sketches, and personal knowledge recall. Dedicated coding work belongs in specialist tools. The agreed vocabulary is in [CONTEXT.md](../../CONTEXT.md); detailed decisions are in [the ADR directory](../adr/).

## First milestone: Quick Chat and canvas


The user selected Quick Chat and canvas as the first refinement milestone. Improve the everyday conversation and visual revision experience using the existing foundation where suitable.

Platform order is desktop first, then mobile. Web is outside the refinement priorities; this is not a decision to delete the existing web target. Mobile is a companion with Quick Chat that works through a phone-reachable configured provider even when the desktop is asleep or disconnected. Desktop-dependent capabilities require a connection and show unavailable without it. Pairing, sync, and remote execution design are later work, not part of the first milestone.

- Simple answers stay in chat; useful visuals may open automatically beside chat or on request.
- When Quick Chat creates a canvas, open the same conversation in the full main app with canvas beside chat; the compact window does not have enough room. This transition is automatic rather than waiting for a preview-card click.
- Canvas includes Mermaid and bounded interactive visuals. Image generation depends on a capable configured model.
- Canvas uses conversation-supplied information without independent external fetching. Refresh requests go through the assistant and revise the canvas.
- Canvases belong to their originating thread and can be reopened there.
- Follow-ups continuing the same subject and purpose update the existing canvas. Different questions or explicit fresh starts create new canvases.
- Show the latest canvas version by default and retain earlier versions for restoration through a compact history control.
- Canvas content revisions happen through chat for the first milestone. Version restore remains available; direct visual editing is deferred and any existing source view stays secondary. Interactive controls such as filters and sliders still work within the rendered visual.
- Saved canvases do not automatically become authoritative knowledge.
- Include simple local canvas export in a format appropriate to the content. Markdown is suitable for text; interactive content requires a format that preserves its behavior. Hosted publishing and share links are deferred.

Connected-source retrieval and the background memory worker are deferred to a later milestone. Their agreed approval, scope, and conflict rules remain documented in the ADRs. This milestone choice does not authorize deleting existing capabilities or starting implementation.

## Unresolved milestone decisions

- Desktop validation scope and later mobile companion boundaries.
- Canvas rendering implementation under the agreed no-independent-fetching boundary.
- Concrete acceptance scenarios and completion criteria.

## Brainstorming decision log

| Decision | Alternatives considered | Reason |
| --- | --- | --- |
| Develop personal-first, with the option of a public Product Hunt launch. | Personal-only tool; broad public-launch requirements from the outset. | The user's daily workflows provide the initial benchmark while the product remains suitable for eventual public use. No launch date or launch execution is authorized. |
| Target Quick Chat ready for typing within approximately 500 ms when the app is already running; keep typing and navigation responsive during generation and show progress promptly. | No explicit responsiveness target; combining UI and model latency into one target. | The user wants a Gemini-like quick-access experience. Provider response latency is measured separately. This is a target, not a verified result or a claim about Gemini's measured performance. |
| Allow relevant chat and knowledge excerpts to reach the user-selected provider by default, with a local-only setting per knowledge source. | All sources local-only; all sources eligible for cloud processing. | Retain access to capable cloud models while allowing sensitive sources to stay local. |
| Offer an explicit cloud exception for the current request only, explained by a tooltip, while preserving the source's local-only default. | Require a local model; permanently change the source setting to use cloud. | Local hardware requirements should not prevent use when the user prefers an informed cloud exception. The exception does not authorize future requests or background review. |
| Provide common default capacity limits with user-adjustable overrides. | Require a precise initial library estimate; impose fixed limits; accept unbounded intake. | The user cannot estimate their personal library yet and wants practical defaults without a permanent capacity ceiling. Exact values and limit units remain to be chosen from measurements. |
| Keep locally saved chats, canvases, and approved knowledge viewable when the internet or model provider is unavailable; offer retry for requests needing an unavailable provider. | Require an available provider to access saved work. | Existing work should remain useful independently of generation availability. This does not promise access to remote material that has never been saved locally. |

| Design for one maintainer and low ongoing hosting/operations demands. | Assume a dedicated backend or operations team. | The user is the sole maintainer; feature and infrastructure complexity must remain manageable by one person. |

Cold-start performance, detailed measurement conditions, and measured library-capacity defaults remain to be specified. Proposed capacity UX: visible usage, explanations of performance implications, and explicit reporting of material excluded by a limit rather than silently claiming complete coverage. These adjustable limits concern ingestion/indexing capacity, not provider context windows or security restrictions.

## Understanding lock — confirmed

- Personal-first everyday assistant for quick information, writing, brainstorming, sketches, and finding past work; public Product Hunt release remains possible.
- Preserve the Gemini-inspired Quick Chat baseline and target approximately 500 ms warm opening independently of provider latency.
- First milestone is desktop Quick Chat plus conversation-owned interactive canvas, automatic full-app transition, chat revisions, version restore, and simple local export.
- Later knowledge work uses explicitly connected, scoped sources, user-approved authority, a proposal-only memory worker, and non-blocking conflict notices.
- Swarm and computer use remain manually enabled capabilities; dedicated coding workspaces are outside the refined scope.
- Mobile follows as a companion with independent Quick Chat; web is not a priority. Locally saved work remains available offline and source privacy is user-configurable.
- One maintainer, adjustable capacity defaults, and low operational burden constrain all design choices.

Confirmed assumptions: evolve the existing application rather than rewrite it; treat the first milestone as a usable personal release rather than an immediate Product Hunt launch; use macOS as the initial acceptance environment without declaring other desktop targets removed.

Open details for design: rendering approach and enforcement, measured capacity defaults, source lifecycle and derived-data privacy, remaining computer-use permission lifetime, mobile pairing/sync, and cleanup of existing coding surfaces. The broader decisions remain valid; these details do not expand the first milestone. The user confirmed the understanding, assumptions, and completion scenarios before approach selection.

## Existing Quick Chat baseline

The user identifies the current Gemini-inspired Quick Chat behavior as the baseline to preserve. Source inspection confirms that the floating Quick Chat shares session data and opens the same session in the main app through `openSessionInMain`; this is existing functionality, not a new milestone feature. Preserve that continuity while refining canvas behavior. This inspection is not a packaged-app runtime verification.

## Confirmed completion scenarios

1. Ask a simple question in desktop Quick Chat; receive an answer without opening canvas or changing windows.
2. Request a flow diagram or interactive comparison; continue the same conversation in the main app with a working canvas beside chat.
3. Refine that visual through chat; the same canvas updates, and an earlier version can be restored. A different subject creates a separate canvas.
4. Close and reopen the app; locate the canvas in its original thread, reopen it, and export the selected version in a suitable local format.
5. Cancel generation or encounter an invalid visual; preserve the previous working canvas and conversation, and provide an understandable retry path.

Validate these in the packaged desktop app on macOS first. Other desktop platform validation and the rendering implementation still require assessment. These are confirmed acceptance criteria, not completed checks or implementation authorization.

## Design approaches — option 1 selected

1. Focused evolution (accepted): reuse shared chat/provider/storage infrastructure and give canvas an explicit thread-owned lifecycle. Balances incremental delivery with clear feature boundaries; requires targeted integration and migration work.
2. Minimal UI patch: keep existing artifact behavior and add controls. Lowest initial effort, but risks fragile revision identity, restore, and Quick Chat transitions as behavior accumulates.
3. Fixed visual templates: render only prescribed chart/diagram/layout types from structured data. More predictable rendering, but narrower creative range and an ongoing template-maintenance burden.

Source inspection found a remote Tailwind script in the current HTML preview document and script/form permissions in the preview iframe. Existing preview support is reusable evidence, not proof of compliance with offline and no-independent-fetching requirements.

## Positioning hypothesis — pending validation

Confirmed service rollout order: paid hosted sync first, Cloud Knowledge after sync proves reliable. Delivering both tiers together was considered; sequential delivery was chosen to fit solo maintenance. Dates, pricing, and measurable reliability gates remain undecided. This commercial sequence supplements the existing desktop Quick Chat/canvas first-build milestone rather than replacing it.

Subsequent business-scope change: the user selected optional paid hosted sync for effortless cross-device continuity. Initial hosting covers storage/sync, not server-side memory processing or learning; see [ADR 0006](../adr/0006-optional-hosted-sync-service.md). The original understanding lock must be updated for this service scope before its detailed design. Pricing, coverage, recovery, and launch sequencing are unresolved.

Further refinement: chats, canvases, memories, and learned procedures sync in the first version, with large KB documents opt-in. The user proposes a higher tier for cloud KB queries without full local downloads. Cloud retrieval is now a desired later service capability; encryption/content-access decisions and launch timing remain open. Hosted autonomous learning remains deferred.

Cloud-search content access confirmed: explicitly enabled collections may be processed by the hosted retrieval service; other collections remain encrypted sync-only or device-only. This selection enables relevant retrieval without requiring a full local KB download. It does not approve the contents as authoritative knowledge. Launch sequencing and the revised service understanding lock remain open.

The user accepted focused evolution and requested a concrete reason to choose Chaeboxi over Jan, Bionic, Gemini, or ChatGPT. Proposed pain point: people working across AI tools repeatedly search for prior work, re-explain context, and reconcile conflicting memories or guidelines. Proposed promise: one quick personal assistant for finding and reusing knowledge across tools, with sources, user-approved authority, and model choice. This is a hypothesis, not evidence of market demand or a claim that competitors cannot offer similar workflows.

The user confirmed losing context as a personal pain point and broadened it to needing an assistant when juggling too much work, citing Hermes as a reference. Memory alone and local operation are not yet established competitive advantages. The intended workload-assistance behavior (for example, on-demand context recovery versus proactive reminders or task execution) needs clarification; no new scheduling or autonomous-work scope is accepted by this statement.

The user accepted on-demand "pick up where I left off" as the lead personal-assistant workflow before proactive reminders/task management. They then raised Hermes-style self-learning/improvement. Existing accepted scope covers memory proposals and user-approved knowledge; learning reusable procedures or improving skills remains an open design question, not an accepted autonomous self-modification capability.

The user rejected mandatory approval for every learned procedure, requesting some automatic improvement, and raised shared KB, memories, and learned behavior across two or three devices. The automatic-versus-approved boundary is reopened; do not interpret this as permission to silently overwrite approved project guidelines or as confirmation of a new policy for all memory. Cross-device continuity is now an explicit requirement; storage/hosting approach and milestone placement remain undecided. Existing encrypted history/memory snapshot sync is a foundation, not proof of unified KB/skill sync or conflict-safe automatic learning.

Quick Chat and canvas remain the first implementation milestone, but alone do not demonstrate this broader differentiation. A later narrow cross-source recall demonstration may be needed before public positioning relies on that promise. No roadmap reprioritization has been approved.

Decision log: focused evolution selected over a minimal UI patch and fixed templates to retain existing foundations while providing coherent canvas behavior and flexibility. The choice preserves the confirmed scope and does not authorize implementation.

## Revised understanding — confirmed

This section supersedes earlier unresolved statements about hosting, tier sequencing, and mandatory approval for all learning.

- Lead benefit: help the user pick up where they left off across work, AI tools, and devices, with sources.
- Keep the accepted personal-assistant scope and focused evolution approach. Desktop Quick Chat/canvas remains the first build milestone; mobile follows, web is not a priority, and coding work stays with specialists.
- Automatically learn useful methods within existing permissions, with history and undo. Authoritative knowledge additions/changes still require approval; unresolved conflicts remain non-blocking. See ADR 0007.
- Sync chats, canvases, memories, and learned procedures; large KB documents are opt-in. Local saved work remains accessible without the service.
- Optional paid hosted sync launches first. Higher-tier Cloud Knowledge follows once sync is reliable, searching explicitly enabled collections without full KB downloads.
- Encrypted sync-only, device-only, and cloud-search collections have distinct access boundaries. Cloud retrieval preserves project scope and approval status. Hosted autonomous learning remains deferred.
- Retain one-maintainer constraints, BYOK provider choice, and the approximately 500 ms warm Quick Chat target.

Confirmed assumptions: business scope changes do not require both service tiers in the initial desktop milestone; no model-training or arbitrary application self-modification is implied by automatic learning.

Open design details: how success is verified for learned methods; sync conflict resolution and deletion; pairing/recovery; measurable service reliability gates, pricing and quotas; implementation details for the confirmed canvas flow.

## Updated reference landscape

The user confirmed the revised direction and accepted selective reuse of CopilotKit OpenDots for continuity/learning, OpenMuse for mobile UX, and OpenBot for action controls. See [the October 5 reference review](../research/2026-10-05-copilotkit-reference-review.md). No wholesale runtime migration or new vendor dependency is authorized. Memory, persistence, and learning alone are insufficient differentiation against these newer references.

Detailed design proceeds in [the product design draft](2026-10-05-personal-assistant-design.md), with each section reviewed before implementation.
