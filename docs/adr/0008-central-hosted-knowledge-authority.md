# ADR 0008: Central authority for hosted knowledge

Status: accepted product direction and fallback behavior; implementation details pending review.

## Context

The user wants effortless continuity across devices and prefers centralizing knowledge to maintaining competing authoritative copies. Pending changes should process quickly, and service delays must not stop ordinary chat.

## Decision

For enrolled hosted knowledge, the service maintains the canonical accepted revision history. Devices cache selected knowledge and persist queued submissions locally. Updates identify their expected revision; stale changes remain recoverable and require reconciliation rather than silently overwriting accepted knowledge.

Cached knowledge remains usable offline. A queued submission is pending synchronization until accepted by the service. User approval is a separate requirement: a synchronized proposal is still a proposal, and user-approved offline changes remain pending global commit. Device-only knowledge stays local.

Central storage does not imply permission for the service to read encrypted content, search it, or run learning. Preserve the collection policies and service rollout in [ADR 0006](0006-optional-hosted-sync-service.md), and approval boundaries in [ADR 0001](0001-user-approved-knowledge-authority.md).

## Consequences

Central serialization reduces competing device writes but cannot resolve contradictory evidence or simultaneous stale edits automatically. Offline caches may be stale; queued changes are not globally authoritative until accepted. Central authority for chats, canvases, and learned methods is not selected by this decision.

The user accepted fallback to the last cached approved knowledge, responsive chat, durable pending edits, background retry, and honest coverage gaps when nothing is cached. A normal online commit target of a few seconds needs measurement; concrete status UI, retry policy, and outage/recovery tests remain to be validated in the [detailed design](../specs/2026-10-05-personal-assistant-design.md).
