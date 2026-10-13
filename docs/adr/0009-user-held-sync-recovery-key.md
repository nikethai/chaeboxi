# ADR 0009: User-held recovery key for encrypted sync

Status: accepted recovery policy; technical design pending.

## Context

Optional hosted sync needs recovery when trusted devices are lost. Recovery must distinguish encrypted sync-only content from explicitly service-readable Cloud Knowledge collections.

## Decision

The user selected a recovery key they keep over service-assisted content recovery. The service must not hold a means of decrypting encrypted sync-only content for recovery. Restoring access on a replacement device requires account authentication and the recovery key, or a still-accessible trusted device through an enrollment mechanism to be designed.

Resetting the account password alone cannot decrypt this content. Losing every trusted device and the recovery key leaves it unrecoverable by the service. Recovery-key generation, storage, setup confirmation, rotation, compromise handling, and the cryptographic protocol require technical design and review before implementation.

## Consequences

The onboarding experience must clearly explain the consequence of losing the key and help users save it outside the app. No specific backup integration is selected. Claims about server-inaccessible content apply to encrypted sync-only collections, not Cloud Knowledge collections enrolled for hosted processing. Device enrollment and revocation interactions remain proposed in the [detailed design](../plans/2026-10-05-personal-assistant-design.md).
