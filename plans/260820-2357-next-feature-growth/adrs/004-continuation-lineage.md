# ADR 004 — Continuation lineage and generation order

**Status:** Accepted (discovery)  
**Date:** 2026-08-21

## Decision

v1 handoff is **derived at send time**. No durable "context packet" entity.

On Continue:

1. `createEmpty('chat')` native session
2. Stamp `continuationLineage` on that session (metadata only)
3. First send prepends `buildUntrustedImportedContextBlock(...)` as a **user** message, then the user's instruction
4. Privileged tools default off for that session until the user arms them

## Lineage fields (Phase 1 Zod, optional on Session)

- importedSourceId, importedConversationId
- selectedMessageIds[]
- targetProvider, targetModelId
- createdAt
- omittedCount / omittedReasons (codes, not text)

If the source is later deleted, keep lineage ids and a `sourceMissing: true` display. Do not delete the native session.

## Generation order

From `genMessageContext` / `streamText` today: system head → compacted native messages → tools as armed.

Handoff first turn **must** be:

1. Chaeboxi system / default prompt (existing)
2. Memory inject if globally enabled (Chaeboxi-authored policy; `memoryAutoSave: false` on this session)
3. Untrusted imported block (user role, tagged)
4. New user instruction

Omit imported system and tool records in the builder (already tested).

Tool defaults for the first send must be **forced off**, not merely unset. `initEmptyChatSession` already leaves `browserArmed` / `computerArmed` / `agentMode` false, but `streamText` still attaches MCP, web browsing (if configured), image-gen tools, video-url tools, memory tools, and auto skills. Handoff must pass `tools: {}`, `webBrowsing: false`, `includeMcp: false`, and skip skill/command/integration system unshifts until the user arms them.

Token preview: `estimateTokensFromMessages` on the block + instruction + destination model tokenizer when known.

## Insertion point

Closest existing analog: `formatQuoteAttachment` (user-turn prefix, not system). Do **not** fork `InputBox.tsx`. Do **not** put imported text in `injectModelSystemPrompt`. First `submitNewUserMessage` with an explicit flag; keep the untrusted builder in `packages/imported-context`.

## Rejected

- Durable packet table
- Injecting excerpts as `role: system`
- Copying imported threads into `session.messages` as if they were native history (lineage would be lost; compaction/memory would treat them as first-party)
