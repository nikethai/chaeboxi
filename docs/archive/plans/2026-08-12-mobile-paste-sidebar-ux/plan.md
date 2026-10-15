# Mobile paste + blank UI + sidebar

**Date:** 2026-08-12  
**Status:** implemented (pending device QA)

## Goals

1. External image copy/paste works in normal chat and Image Creator
2. iPhone blank-chat first look is calm and non-cramped
3. Mobile sidebar is a focused Chats panel, not a squeezed desktop rail

## Phases

### Phase 1 — Clipboard image ingest
- Shared `extractClipboardImages` + paste policy
- Wire into InputBox + ComposerRichInput
- Wire into Image Creator textarea/drop surface
- Unit tests for MIME variants / dedupe / plain-text rules

### Phase 2 — Mobile blank home
- Remove starter card from blank home (design contract)
- Compact mobile cluster layout (no giant voids)
- Single-row mobile composer toolbar
- Memory under `+` on mobile

### Phase 3 — Mobile sidebar
- Near-full intentional drawer width
- Compact mobile header
- Hide Projects empty promo card on mobile
- Recents-first density

## Out of scope
- Capacitor clipboard plugin
- Bottom-tab navigation rewrite
- Desktop rail redesign
