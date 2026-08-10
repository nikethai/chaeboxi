# Plan: Quote as Chip + Structured History UI

**Status:** proposed  
**Date:** 2026-08-10  
**Scope:** Composer quote UX + message schema + history render + model inject  
**Related code:** `Message.tsx`, `InputBox.tsx`, `uiStore.ts`, `session.ts` types, `message-utils.ts`, `TextSelectionToolbar.tsx`, `Attachments.tsx` / memory chip pattern

---

## Locked product decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Composer capacity | **Single quote only** | Replace previous chip. Matches reply patterns; avoids multi-quote formatting mess. |
| Sent history | **Structured quote chip** (not only raw `>` text) | Persist + render a reply-style block on the user message. |
| Detail open | **HoverCard (desktop) + tap Popover (mobile)** | Long text needs scrollable high-contrast panel; Tooltip is too weak. |
| Capture source | **Full message + selection quote** | Menu Quote = full; selection toolbar Quote = selection when available. |

### Explicit non-goals (v1)

- Multi-quote stack
- Quoting images/files/videos (existing TODOs stay open)
- Editable quoted text in composer
- Changing fork/`sequenceMessages` auto-quote of assistant history (separate path)
- New LLM provider APIs

---

## Problem

Today Quote is a **string dump into the textarea**:

1. `quoteMsg` → every line as `> …` + separator  
2. `uiStore.quote: string`  
3. `InputBox` appends into `messageInput`  

Result: wall of markdown in the dock, mixed with draft, hard to scan, hard to dismiss cleanly, weak “detail” story.

---

## Architecture (recommended)

### Pattern: **memoryAttachments twin** (not a new contentPart type)

Memory already proves the best local pattern:

- Message-level optional field (`memoryAttachments`)
- Composer chips in `composer-meta-stack`
- Inject into model context in `convertToModelMessages` (`formatMemoryAttachments`)
- Not mixed into free-text editing

Quote should follow the same shape with **cardinality 0|1** and **history UI** (memory currently has no history chip — Quote will be the first rich attachment bar on user bubbles).

**Avoid** `contentPart: { type: 'quote' }` for v1:

- `contentParts` flow through vision conversion, copy, merge, streaming
- Discriminated union churn across shared types
- Memory already shows message-level attachment is enough

### Data model

```ts
// src/shared/types/session.ts
export const MessageQuoteAttachmentSchema = z.object({
  sourceMessageId: z.string().optional(),
  sourceRole: z.enum(['system', 'user', 'assistant', 'tool']).optional(),
  text: z.string(),                    // full quoted body (selection or full message)
  isPartial: z.boolean().default(false), // true when from text selection
  createdAt: z.number().optional(),
})

// on MessageSchema (user turns only in practice):
quoteAttachment: MessageQuoteAttachmentSchema.optional().catch(undefined),
```

```ts
// uiStore / composer draft (ephemeral)
type QuoteDraft = {
  sourceMessageId?: string
  sourceRole?: MessageRole
  text: string
  isPartial: boolean
}
// uiStore: quoteDraft: QuoteDraft | null  (replace quote: string)
```

### System boundaries

```text
[Message actions / Selection toolbar]
        │ setQuoteDraft(draft)
        ▼
   uiStore.quoteDraft
        │ consume once
        ▼
   InputBox local quoteDraft ──chip──► HoverCard/Popover detail
        │ on send
        ▼
   Message.quoteAttachment  ──render──► history reply bar
        │ convertToModelMessages
        ▼
   user content += formatted quote block ("> " lines) before user text
```

### Model wire format (keep boring)

On convert (mirror memory):

```text
Quoted message (assistant, partial):
> line 1
> line 2

---

{user text}
```

Or prepend as separate text part. Prefer **one helper** `formatQuoteAttachment(quote)` used only in model-calls — do **not** put `>` markdown into the textarea.

`getMessageText` for user messages:

- **Default (copy / export):** include a readable quote prefix so clipboard stays useful  
- **Token estimation:** include quote text (it is sent to the model)  
Document this in helper options if needed (`includeQuote?: boolean`, default true for estimation paths).

---

## UX design

### Composer chip

- Lives in existing `composer-meta-stack` / `composer-meta-row` (same as skills/memory)
- Visual: `composer-skill-chip` + quote icon (`IconQuote` / filled)
- Label:
  - Partial: `Quote · selection` or first ~28 chars of text
  - Full: `Quote · Assistant` / `Quote · You` + optional truncated preview
- `×` clears draft
- **Never** writes quote into the textarea

### Detail panel (clearer)

Desktop: Mantine **HoverCard** (or Popover with hover open if HoverCard insufficient)

- Header: role badge + “Quoted” / “Partial quote” + optional Jump
- Body: scrollable `max-h-[min(320px,40vh)]`, pre-wrap, readable line-height, quote accent border
- Surface: high contrast (`chatbox-background-primary` + border + shadow)
- Footer optional: character/line count

Mobile: **click/tap** opens Popover (no hover). Chip itself is the target.

Accessibility:

- Chip focusable, `aria-label` with preview
- Escape closes panel
- Remove button has explicit label

### History (sent user message)

Above or inside user bubble, a **reply bar** (not the full wall of text by default):

```text
┌ Quote · Assistant · partial ───────── ↗ ┐
│ preview first two lines…                 │  ← compact
└──────────────────────────────────────────┘
  User's actual message text…
```

- Compact by default; expand in-place or HoverCard for full text (reuse detail panel component)
- Optional jump-to `sourceMessageId` if still in session list
- Distinct from assistant selection toolbar chrome

### Capture paths

| Entry | Behavior |
|-------|----------|
| Message menu **Quote** | Full `getMessageText(msg)`; `isPartial: false` |
| Selection toolbar **Quote** | `selectionToolbar.text`; `isPartial: true`; needs source msg id/role |
| Empty selection + Quote menu | Full message |

Selection toolbar today is **assistant-only** (`handleSelectionMouseUp`). Plan:

1. Add **Quote** action to `TextSelectionToolbar` (alongside Explain / Translate / Copy)
2. Keep selection toolbar on assistant for v1 (current behavior); Quote menu still works on any role that exposes Quote action
3. If selection exists when menu Quote is clicked, **prefer selection** (best of both without two mental models)

---

## Implementation phases

### Phase 1 — Schema + store contract

**Goal:** Stop using free-form quote string as the long-term API.

**Files**

- `src/shared/types/session.ts` — `MessageQuoteAttachmentSchema`, `quoteAttachment` on `MessageSchema`, export type
- `src/renderer/stores/uiStore.ts` — `quoteDraft: QuoteDraft | null`, `setQuoteDraft`, remove/deprecate `quote: string` + `setQuote`
- Grep all `setQuote` / `state.quote` call sites

**Steps**

1. Add Zod schema with `.catch(undefined)` for backward compat  
2. Replace uiStore quote string with draft object  
3. Temporary adapter if needed: if old code paths remain during PR, convert once

**Tests**

- Zod parse: missing field ok; valid attachment ok; junk → undefined

**Acceptance**

- No runtime dependency on `uiStore.quote: string`

---

### Phase 2 — Composer: chip only (no textarea dump)

**Goal:** Quote lands as a single dismissible chip.

**Files**

- `src/renderer/components/chat/Message.tsx` — `quoteMsg` builds `QuoteDraft`
- `src/renderer/components/InputBox/InputBox.tsx` — consume draft, local state, chip row, clear on send/dismiss
- Optional: `src/renderer/components/InputBox/QuoteChip.tsx` if InputBox size warrants extract (~keep under modularization pressure)

**Steps**

1. On `quoteDraft` change: set local state, clear store, focus textarea (do not append text)  
2. Render chip in meta stack when present  
3. On send: attach `quoteAttachment` on constructed user message; clear draft  
4. Remove legacy imperative `setQuote` textarea path / `useImperativeHandle.setQuote` dump (or rewire to draft)

**Acceptance**

- Quote never appears as editable markdown in the dock  
- Dismiss × removes chip only  
- New Quote replaces previous (single)

---

### Phase 3 — Detail panel (HoverCard + mobile Popover)

**Goal:** Detail is actually readable.

**Files**

- New shared presentational: e.g. `src/renderer/components/chat/QuoteDetailPanel.tsx` (header + scroll body)
- `QuoteChip` or InputBox wiring with Mantine HoverCard/Popover
- CSS tokens only if existing chip/hover surfaces are insufficient (`globals.css` sparingly)

**Steps**

1. Shared panel used by composer chip and history bar  
2. Desktop hover open delay ~200–300ms; mobile controlled open on click  
3. Contrast/scroll QA light + dark  

**Acceptance**

- Long quotes (500+ chars) scroll inside panel  
- Panel text contrast clearly better than current tooltip-style memory chip  

---

### Phase 4 — Persist + history UI + model inject

**Goal:** Sent messages show structured quote; models still get quote context.

**Files**

- `InputBox.tsx` — set `quoteAttachment` on constructed message  
- `src/renderer/packages/model-calls/message-utils.ts` — `formatQuoteAttachment` + inject in user branch  
- `src/renderer/packages/model-calls/message-utils.test.ts`  
- `src/renderer/components/chat/Message.tsx` (or small `MessageQuoteBar.tsx`) — render for `msg.role === 'user' && msg.quoteAttachment`  
- Token estimation path if it only reads `contentParts` text — ensure quote counted  

**Steps**

1. Inject formatted quote before/with user text in `convertToModelMessages`  
2. History compact bar + reuse detail panel  
3. Optional jump-to-source if `sourceMessageId` present in session  
4. Copy message: include quote text in a clear form  

**Acceptance**

- Reload session: quote bar still visible  
- Model request payload contains quoted body (unit test)  
- User text alone is not mixed with `>` in the editor history of the draft (history bubble shows structure)

---

### Phase 5 — Selection quote

**Goal:** Selection → partial quote chip.

**Files**

- `TextSelectionToolbar.tsx` — Quote action  
- `Message.tsx` — wire `onQuote` with selection text + msg id/role; clear toolbar after  
- Menu Quote: if active selection inside this message, prefer selection (`isPartial: true`)

**Steps**

1. Add Quote to toolbar props/actions  
2. Prefer selection when non-empty and within message content  
3. Chip label indicates partial  

**Acceptance**

- Select mid-assistant paragraph → Quote → chip shows selection only  
- Full menu Quote without selection → full message  
- Model inject uses partial text only  

---

### Phase 6 — Hardening

**Files / checks**

- i18n keys for chip/detail/toolbar  
- `pnpm test` for message-utils + any new unit tests  
- `pnpm check` / lint on touched files  
- Manual: mobile form factor, dark mode, dismiss, replace quote, send while generating queue  

**Docs**

- Only if user-facing behavior doc exists for chat UX; otherwise skip (YAGNI). Optional short note in `docs/` only if team relies on it.

---

## Component / ownership map

| Concern | Owner |
|---------|--------|
| Schema | `src/shared/types/session.ts` |
| Ephemeral draft | `uiStore` |
| Capture | `Message.tsx`, `TextSelectionToolbar.tsx` |
| Composer chip + send attach | `InputBox.tsx` (+ small extract if large) |
| Detail UI | shared `QuoteDetailPanel` |
| History bar | chat message tree |
| LLM inject | `message-utils.ts` |

---

## Risk analysis

| Risk | Mitigation |
|------|------------|
| Breaking old sessions | `quoteAttachment` optional + `.catch(undefined)` |
| Double quote (chip + leftover `>` in text) | Remove textarea inject entirely; no dual path |
| Token undercount | Include quote in estimation / inject tests |
| Mobile hover gap | Controlled Popover on tap |
| Jump-to fails after fork/delete | Optional action; hide if message missing |
| Selection only on assistant | Document; full Quote still works from menu for other roles |
| InputBox already large | Extract `QuoteChip` early if touch count high |
| History chip vs memory inconsistency | OK — Quote is reply semantics; memory is fact attach |

---

## Alternatives considered (and rejected for this plan)

| Alt | Why not |
|-----|---------|
| Keep textarea dump + CSS collapse | Still corrupts editing surface |
| Tooltip-only detail | Fails “clearer detail” |
| Multi-quote chips | User chose single; revisit later |
| `contentPart` quote type | Higher blast radius; memory pattern is enough |
| Expand-only-on-send without history structure | User explicitly wants history chip |

---

## Implementation strategy (order)

Recommended ship slices:

1. **P1 + P2** — schema + chip (user-visible win even without fancy panel)  
2. **P3** — readable detail  
3. **P4** — persist/history/model (required for your history-chip decision)  
4. **P5** — selection  
5. **P6** — polish/tests  

Do **not** ship P2 without P4 if product promise is “structured in history” — otherwise first release would drop quote on send. Minimum vertical slice: **P1 → P2 → P4 (inject + attach) → P3/P5**.

**MVP vertical slice (first PR):**

1. Schema + uiStore draft  
2. Capture full message → chip  
3. Send `quoteAttachment` + model inject  
4. Minimal history bar (can share detail panel later)  
5. Then PR2: HoverCard polish + selection toolbar Quote  

---

## Decision framework (for future changes)

- Need multi-quote? Only after single is solid; store becomes `quoteAttachments: []` max N=3.  
- Need quote images? Separate media quote attachment; do not overload `text`.  
- Need contentPart later? Migrate only if providers need multimodal quote blocks.

---

## Suggested file touch list (implementation)

**Create**

- `src/renderer/components/chat/QuoteDetailPanel.tsx`
- `src/renderer/components/chat/MessageQuoteBar.tsx` (history)
- `src/renderer/components/InputBox/QuoteChip.tsx` (optional extract)

**Modify**

- `src/shared/types/session.ts`
- `src/renderer/stores/uiStore.ts`
- `src/renderer/components/chat/Message.tsx`
- `src/renderer/components/chat/TextSelectionToolbar.tsx`
- `src/renderer/components/InputBox/InputBox.tsx`
- `src/renderer/packages/model-calls/message-utils.ts`
- `src/renderer/packages/model-calls/message-utils.test.ts`
- possibly `src/renderer/utils/message.ts` / shared `getMessageText` if copy must include quote

---

## Acceptance criteria (overall)

1. Clicking Quote does **not** dump `>` markdown into the input dock.  
2. Composer shows **one** quote chip; replace on new Quote; × dismisses.  
3. Hover (desktop) / tap (mobile) shows a **scrollable high-contrast** detail panel.  
4. Sent user message shows a **structured quote bar** after reload.  
5. Model conversion includes quoted text (unit-tested).  
6. Selection Quote quotes only the selection (`isPartial: true`).  
7. Full Quote without selection quotes entire message.  
8. No regression to memory/skills chips layout.  
9. Types/lint/tests pass for touched areas.

---

## Effort (rough)

| Slice | Effort |
|-------|--------|
| MVP: schema + chip + send + inject + basic history bar | ~0.5–1 day |
| Detail panel polish (HoverCard/Popover) | ~0.25–0.5 day |
| Selection toolbar Quote + prefer-selection | ~0.25–0.5 day |
| Tests + a11y + dark/mobile QA | ~0.25 day |

**Total:** ~1.5–2.5 days for full plan as chosen.

---

## Next actions after plan approval

1. Implement MVP vertical slice (P1 + P2 + P4 minimal).  
2. Add detail panel + selection (P3 + P5).  
3. Harden with tests (P6).  
4. Optional: copy plan into `plans/2026-08-10-quote-chip-composer/plan.md` in-repo for team history.

---

## Unresolved (none blocking)

- Exact jump-to-source animation if Virtuoso scroll API is awkward — hide jump if costly.  
- Whether history bar is above bubble (Slack-like) or inside card top — recommend **inside user card top** for layout consistency with attachments.
