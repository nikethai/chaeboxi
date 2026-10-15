# Chaeboxi PM pilot design

Status: design approved in conversation on 2026-10-13; implementation plan not yet written. This supersedes the first-source and milestone-order decisions in [the personal assistant design](2026-10-05-personal-assistant-design.md) where they conflict; everything else in that document and in ADRs 0001–0009 stands. See [ADR 0010](../adr/0010-pm-pilot-first-user.md).

## Charter

**Purpose.** Cut the time a small-agency project manager spends answering client questions that were already answered somewhere.

**First user.** One PM the maintainer knows, at a small agency, on Gmail and Asana, with external clients. The maintainer is the second user. Same app for both; no profiles or modes.

**Objective (v1).** Grounded replies. Every client email gets a triage label. When a question was already answered in an email thread or a work-tracker task or comment, a draft reply with sources appears in the Gmail thread.

**Success.** After four weeks of use, the PM sends drafted replies with light or no edits for most repeat questions and has not turned drafts off.

**In scope.**
- Gmail connector: read, label, create drafts (never send).
- Work-tracker connector behind a generic interface; Asana is the only implementation in v1.
- Per-client memory (ledger) with source links, built from both connectors.
- Inbox pipeline: route → retrieve → judge → act by confidence tier.
- Quick Chat and main chat retained as the on-demand recall surface, per ADRs 0001–0003.
- First run: sign in to a model (subscription login or key), connect Gmail, connect tracker.
- Settings split into a short top level and an Advanced section.

**Out of scope for v1, on the roadmap.** Auto-chase of tasks, scope-creep flags, locked-attachment routing, CarelessWhisper as a source, automatic discovery of local agent session stores (Codex, Claude Code, Cursor), Outlook, other trackers, hosted sync, mobile, canvas. None of these block v1.

**Stakeholders.** The PM (user), the agency owner (approves Gmail access; possible payer later), the maintainer.

**Assumptions.** The PM's answers mostly live in Gmail and Asana. A single-user OAuth client avoids Google's CASA assessment for the pilot. ADRs 0001–0004 hold unchanged. The PM's agency will grant Gmail access; confirm before building the connector.

**Constraints.** One maintainer. Desktop macOS first. Local-first: no user data in a server the maintainer runs. Non-technical user: developer surfaces hidden by default, not removed.

**Risks and mitigations.**
- Draft flood → drafts are the exception (high-confidence tier only), daily cap, auto-expiry, per-client switch, global pause.
- Subscription login revoked by a provider → key entry is a first-class fallback, not an afterthought; the agency owner is told a key may be needed.
- Decision-model calibration on hidden-policy tasks is poor in independent tests → thresholds tuned on the PM's own labelled mail; labels-only period before drafts; never auto-send.
- Large platforms ship generic triage free → the defensible part is the cross-source client memory, not drafting.
- Gmail restricted scopes → single-user internal OAuth client for the pilot; budget CASA before any multi-tenant release.

## 1. Sources

Gmail and the work tracker are knowledge sources under [ADR 0003](../adr/0003-explicit-knowledge-source-connections.md): connected once in Settings, scoped to a project, with the existing local-only toggle. One project per client.

Each connector emits work records in the existing shape: who, what, when, project, and a stable link back (Gmail message ID and thread ID; tracker task and comment IDs). Repeated syncs recognise existing records by those IDs.

- **Gmail** syncs incrementally by `history.list` from a stored history ID, polled while the app runs. Push notifications are not used: Pub/Sub push needs a public HTTPS endpoint, which a desktop app does not have. An expired history ID triggers a bounded re-sync window. Scope: the existing `gmail.modify` scope pack in the Google Workspace connector. That scope technically permits sending, so "never send" is enforced in code: the Gmail client used by Chaeboxi exposes no send operation.
- **Work tracker** is a generic interface: list projects, tasks, comments, status, assignee, due date, link. Asana syncs through its Events API with sync tokens (pull-based, no public endpoint needed) plus a local cache; no search-per-email, because Asana rate limits punish it. An expired sync token triggers a full re-sync of that project. Asana is the only adapter in v1. New adapters are added when a real user arrives with that tool.

**Client mapping.** Clients are created automatically from tracker projects and can be renamed or merged. Each client has a list of email domains or exact addresses. An email belongs to a client when a sender or recipient outside the user's own domain matches that list. An email that matches no client, or more than one, stays unassigned and is never used for any client's memory. Domains are edited in a Clients settings page.

Nothing from either source becomes approved knowledge on its own ([ADR 0001](../adr/0001-user-approved-knowledge-authority.md)).

## 2. Per-client memory

Each client project has a derived ledger: questions asked and the answer given, decisions, commitments, open items. Every entry carries its source links and the time it was derived. Entries are reference material, never approved knowledge; the user can promote one to approved knowledge through the normal proposal flow.

The ledger is the index the recall flow searches for client questions and the evidence the inbox pipeline grounds on. Recall answers in Quick Chat cite ledger entries and state what could not be checked (tracker unreachable, thread not yet synced), per section 2 of the personal assistant design.

Ledger derivation runs in the background with its own budget, on the same device-only basis as the memory worker. Deleting or disconnecting a source removes the entries derived from it; the general lifecycle rules remain an open item from the earlier design.

## 3. Inbox pipeline

One background worker, separate from the memory worker, with its own provider and processing budget and a pause switch in the tray. For each new email in a connected client thread:

1. **Route.** A cheap decision-model call classifies: repeat question / needs PM / noise. Noise is labelled and the pipeline stops.
2. **Retrieve.** Query the client ledger for earlier answers, matching tasks and their current status.
3. **Judge.** A second decision call with the retrieved evidence in the prompt: same question? answered? answer still valid? Returns a label and a confidence.
4. **Act by tier.**
   - High: apply the label and create a draft in the thread, sources listed at the top.
   - Medium: apply the label and record a one-line note in Chaeboxi; no draft.
   - Low: apply the "needs PM" label only.
5. **Draft.** The configured chat model writes the reply grounded only on the retrieved evidence, in the language of the client thread (Vietnamese or English).

Guards: never send; a draft is deleted when the PM replies by hand or after three days untouched; a daily draft cap; per-client drafts on/off; global pause. Thresholds start conservative and are tuned on a few hundred of the PM's own labelled emails before drafts are enabled. Every run is logged with what it checked and what it did, in the same shape as learning history, so the PM can see why a label or draft appeared.

Decision-model choice: start with a hosted Jev-API-compatible model for cost; keep a self-hosted or on-device fallback possible for local-only clients. Provider details are an implementation-plan decision.

## 4. First run and settings

A fresh install asks three things, one screen each:
1. Sign in to a model: subscription login (Google, ChatGPT/Codex) or "I have a key". Each option states what the provider will receive.
2. Connect Gmail. One sentence on what is read and that only excerpts go to the chosen model.
3. Connect the work tracker. Same disclosure.

Then the app opens in Quick Chat with one suggested question for a detected client. Clients are created automatically from tracker projects; the user can rename or merge them.

Settings have two levels. Top level: model, connected sources, per-client drafts on/off, draft cap, pause. Everything else (provider list, MCP, skills, hooks, Swarm, computer use, project folders) moves under Advanced. No code is removed.

## 5. Testing

- **Unit.** Connectors against recorded Gmail and Asana fixtures. Router and judge against an anonymised labelled set of real emails, with calibration measured per label.
- **Integration.** Full pipeline on a fixture inbox, asserting tiers, caps, auto-expiry, per-client switch and the audit log.
- **Acceptance (the pilot).** Two weeks labels-only with the PM; measure precision on "repeat question". Then drafts on for one client. Then all clients. Success criterion as in the charter.

## Open items for the implementation plan

- Confirm Gmail access with the PM's agency before building the connector.
- Confirm which subscription logins are implementable now (Google via the existing Antigravity OAuth plan; ChatGPT/Codex to verify).
- Choose the decision-model provider and the threshold-tuning procedure.
- Settle ledger entry schema and the source-deletion lifecycle (shared open item with the earlier design).
- Decide the Advanced-section layout against the current settings code.
