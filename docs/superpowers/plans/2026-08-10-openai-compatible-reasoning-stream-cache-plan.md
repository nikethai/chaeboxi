# OpenAI-Compatible Reasoning, Streaming, and Cache Diagnostics Implementation Plan

**Date:** 2026-08-10  
**Derived from spec:** `docs/superpowers/specs/2026-08-10-openai-compatible-reasoning-stream-cache-design.md`  
**Goal:** Implement a session-scoped reasoning dropdown beside the active model across chat surfaces, map it honestly into existing OpenAI-compatible and Responses request paths, and expose conservative cache diagnostics only when trustworthy usage metadata is available.

## 1. Delivery strategy

Ship this work in four thin phases:

1. **State and normalization foundation**
2. **UI rollout across chat surfaces**
3. **Protocol-specific request mapping**
4. **Cache diagnostics and verification**

Each phase should end with:
- focused type/test pass for touched files
- one manual chat flow on OpenAI-compatible chat-completions
- one manual chat flow on Responses, where configured
- explicit check that unsupported models do not break the UI

## 2. Execution principles

- Reuse the existing transport layers; do not invent a new request path.
- Keep the UI model simple: one normalized reasoning value, transport-specific mapping underneath.
- Preserve current streaming behavior; the client already requests streaming through the centralized `streamText` path.
- Treat cache telemetry as **best-effort**. Show only what upstream usage data proves.
- Prefer small shared helpers over duplicating reasoning logic in each surface.
- Avoid broad provider refactors outside the OpenAI-compatible / Responses scope.

---

## 3. Phase 1 — State and normalization foundation

### 3.1 Task A — Define normalized reasoning values and helpers

**Objective**  
Create one normalized reasoning representation that UI and transport code can share.

**Primary files**
- new shared/helper module under renderer or shared settings area
- `src/renderer/modals/SessionSettings.tsx`
- session/settings type definitions if needed

**Work**
1. Define the normalized values: `undefined`, `low`, `medium`, `high`.
2. Add helper utilities for:
   - converting stored values to dropdown values
   - provider-native label selection when available
   - fallback labels: Low / Medium / High
3. Keep provider-specific parameter naming out of UI helpers.
4. Reuse existing OpenAI reasoning-effort semantics where possible instead of creating a second incompatible representation.

**Dependencies**
- None. This is the foundation for later UI and request work.

**Definition of done**
- One normalized reasoning model exists.
- Existing OpenAI session-settings logic can be migrated to use it.

**Validation checkpoint**
- Unit tests for normalization and label fallback
- Typecheck for touched types/helpers

---

### 3.2 Task B — Add session-first state with optional saved default

**Objective**  
Make reasoning a session-scoped setting with an explicit “save as default” flow.

**Primary files**
- session/settings store or model files
- `src/renderer/modals/SessionSettings.tsx`
- global settings persistence layer
- session creation / initialization path if needed

**Work**
1. Add or formalize a session-level reasoning field sourced from session settings.
2. Add a global default setting for reasoning that seeds new sessions.
3. Ensure existing sessions keep their explicit override once set.
4. Add a clean helper/action for “save current choice as default.”
5. Confirm the field shape stays compatible with existing `providerOptions.openai.reasoningEffort` usage rather than duplicating state unnecessarily.

**Dependencies**
- Task A normalization helpers.

**Definition of done**
- New sessions pick up the default value.
- Active sessions can diverge from the default without side effects.

**Validation checkpoint**
- Unit/integration tests for session override vs default seeding
- Manual check: change session value, open/create new session, verify default behavior

---

## 4. Phase 2 — UI rollout across chat surfaces

### 4.1 Task C — Extract a reusable reasoning dropdown component

**Objective**  
Build one compact dropdown component suitable for all model-display chat surfaces.

**Primary files**
- new shared component near model display/chat UI components
- shared model display helpers/components
- `src/renderer/modals/SessionSettings.tsx` for reuse or parity

**Work**
1. Build a compact dropdown that:
   - shows the current normalized value
   - renders provider-native labels where available
   - can be disabled
   - shows explanatory tooltip for unsupported models
2. Add optional secondary action for “save as default.”
3. Keep the component presentation-only: it should receive value, options, disabled state, and callbacks.
4. Match existing component density and layout conventions around the active model display.

**Dependencies**
- Phase 1 state and label helpers.

**Definition of done**
- One reusable dropdown exists and is not tied to a single screen.
- Unsupported-model state is clearly explained without toast noise.

**Validation checkpoint**
- Component-level tests if available
- Manual visual check in narrow and normal-width chat layouts

---

### 4.2 Task D — Wire the dropdown into all chat surfaces that show the active model

**Objective**  
Keep reasoning control placement consistent anywhere the active model is surfaced in chat.

**Primary files**
- chat composer / header / model trigger surfaces discovered during implementation
- any quick chat or compact chat variants
- shared model display components

**Work**
1. Inventory every chat surface that shows the active model.
2. Prefer wiring at the shared model-display layer to avoid copy-paste.
3. Ensure all surfaces read from the same session-scoped source of truth.
4. Preserve layout stability on unsupported models by showing the disabled control rather than removing it.
5. Keep mobile/compact layouts usable; collapse labels or tighten width if needed.

**Dependencies**
- Reusable dropdown component from Task C.

**Definition of done**
- All relevant chat surfaces show the same reasoning value.
- Changing the control in one surface is reflected everywhere for that session.

**Validation checkpoint**
- Manual pass across all identified chat surfaces
- Verify cross-surface synchronization within one active session

---

## 5. Phase 3 — Protocol-specific request mapping

### 5.1 Task E — Centralize reasoning request mapping for OpenAI-compatible and Responses

**Objective**  
Create a thin mapping layer from normalized reasoning values to protocol-specific request options.

**Primary files**
- request/helper module near provider option shaping
- `src/shared/providers/definitions/models/custom-openai.ts`
- `src/shared/providers/definitions/models/openai-responses.ts`
- `src/shared/providers/definitions/models/custom-openai-responses.ts`
- optionally `src/shared/providers/definitions/models/openai.ts` or adjacent model definitions if shared OpenAI path also needs parity

**Work**
1. Add one helper that accepts:
   - normalized reasoning value
   - active transport/path
   - current provider option object
2. For chat-completions/OpenAI-compatible:
   - verify the exact AI SDK/provider option shape accepted by `createOpenAICompatible`
   - if supported, map to the correct reasoning-effort option
   - if unsupported/unknown, omit the parameter rather than sending speculative fields
3. For Responses:
   - verify the exact providerOptions shape accepted by `provider.responses(...)`
   - map normalized values into the Responses-specific reasoning option shape
4. Keep `store: false` / stateless behavior untouched where already required (e.g. Codex/WHAM path).
5. Ensure model capability checks gate reasoning params so unsupported models do not receive them.

**Dependencies**
- Phase 1 normalized reasoning state.

**Definition of done**
- One mapping helper controls reasoning param generation.
- Both chat-completions and Responses paths consume it without duplicating protocol logic.

**Validation checkpoint**
- Unit tests for mapping output per transport
- Targeted request-shaping tests/mocks for supported vs unsupported models

---

### 5.2 Task F — Keep streaming semantics explicit without transport changes

**Objective**  
Avoid accidental regressions while documenting and preserving the current streaming contract.

**Primary files**
- `src/shared/models/abstract-ai-sdk.ts`
- any UI state or diagnostics surface that describes transport state
- tests covering stream defaults if needed

**Work**
1. Confirm all touched paths still request streaming through current centralized call settings.
2. Avoid adding any fake progressive rendering fallback beyond existing simulate-streaming behavior.
3. If a diagnostic or developer-facing status indicator is added, label it in terms of:
   - streaming requested
   - upstream may still emit a single payload
4. Add regression coverage only if the reasoning work touches stream-related option plumbing.

**Dependencies**
- None strict, but should be verified while request mapping is changed.

**Definition of done**
- Reasoning changes do not regress current streaming defaults.
- No new misleading “fix” for all-at-once upstream responses is introduced.

**Validation checkpoint**
- Manual prompt on streaming-capable endpoint
- Manual prompt on endpoint known to respond in one payload if available

---

## 6. Phase 4 — Cache diagnostics and verification

### 6.1 Task G — Verify and expose available cached-token usage metadata

**Objective**  
Use existing usage structures only where upstream metadata actually populates them.

**Primary files**
- `src/shared/models/abstract-ai-sdk.ts`
- usage extraction/finalization helpers reached from `totalUsage`
- `src/shared/types/session.ts`
- `src/renderer/packages/cost-tracking/`
- `src/renderer/packages/usage-tracking/`

**Work**
1. Audit the final usage mapping path from AI SDK `result.totalUsage` into `message.usage`.
2. Verify whether Responses paths already populate `cachedInputTokens`; if not, add conservative parsing only for fields the SDK/provider actually exposes.
3. Do not infer cached-token counts on generic OpenAI-compatible chat-completions paths if the upstream does not report them.
4. Preserve existing cost/usage aggregation semantics that already understand `cachedInputTokens`.
5. Add tests for:
   - cached-token metadata present
   - metadata absent
   - metadata malformed/partial

**Dependencies**
- Request mapping phase can land independently, but diagnostics depend on verified usage fields.

**Definition of done**
- Responses path can surface cached token counts when truly returned.
- Generic endpoints without telemetry remain silent/neutral.

**Validation checkpoint**
- Targeted tests for usage parsing
- Manual inspection of a response payload path that returns cache usage if available

---

### 6.2 Task H — Add low-noise diagnostics surface

**Objective**  
Expose transport/cache status without turning the chat UI into a debugging panel.

**Primary files**
- chat status bar / session status UI (`src/renderer/components/chat/SessionStatusBar.tsx` or adjacent surface)
- any popover/details component chosen during implementation
- supporting view-model helpers

**Work**
1. Choose a small existing status surface rather than adding a new major panel.
2. Show only conservative fields:
   - transport in use (chat-completions vs Responses), if available and useful
   - cache telemetry available/unavailable
   - cached token count when present
3. Keep the default state quiet when no trustworthy telemetry exists.
4. Avoid claiming explicit cache hit/miss on absence of metadata.
5. Ensure copy is concise and non-alarming.

**Dependencies**
- Task G verified usage metadata path.

**Definition of done**
- Diagnostics are visible when meaningful and absent when not.
- The UI remains honest for generic OpenAI-compatible endpoints.

**Validation checkpoint**
- Manual compare: Responses path with telemetry vs generic path without telemetry
- Visual sanity pass on compact layouts

---

## 7. Test matrix

### Unit tests
- reasoning normalization helpers
- provider-native label fallback logic
- session/default seeding behavior
- request mapping for chat-completions vs Responses
- usage parsing for cached token metadata
- unsupported-model disabled state logic

### Integration tests
- changing reasoning in one chat surface updates all active-model surfaces in the same session
- “save as default” affects new sessions only
- supported models include mapped reasoning params on the right transport
- unsupported models omit reasoning params
- cached-token diagnostics appear only when upstream usage metadata includes them

### Manual verification
- OpenAI-compatible chat-completions endpoint with supported reasoning model
- OpenAI-compatible chat-completions endpoint with unsupported reasoning model
- Responses path with supported reasoning model
- switching one session between models and verifying disabled/enabled dropdown transitions
- layout check across every chat surface that shows the active model
- cache-diagnostic comparison between telemetry-rich and telemetry-poor endpoints

## 8. Likely implementation order

Recommended order inside a working branch:

1. Normalized reasoning helpers
2. Session/default state plumbing
3. Reusable dropdown component
4. Shared surface wiring across chat UI
5. Request-mapping helper for chat-completions + Responses
6. Usage parsing audit and cached-token propagation fixes if needed
7. Low-noise diagnostics UI
8. Final regression pass and cleanup

## 9. Risks and mitigation

1. **AI SDK parameter-shape variance**  
   Mitigation: verify accepted providerOptions shape before wiring chat-completions and Responses; omit unknown fields rather than guessing.

2. **Surface sprawl**  
   Mitigation: attach the dropdown at the most shared active-model display layer possible.

3. **Telemetry false positives**  
   Mitigation: only surface cached-token data when directly returned by upstream usage metadata.

4. **Layout crowding**  
   Mitigation: keep the control compact and preserve disabled-state layout stability.

## 10. Ready-to-execute outcome

After this plan, the repo should have:

- one normalized reasoning model shared across UI and request layers
- one session-first reasoning control visible on all relevant chat surfaces
- honest protocol-specific request mapping for OpenAI-compatible chat-completions and Responses
- unchanged centralized streaming semantics
- conservative cache diagnostics that appear only when the upstream exposes trustworthy cache metadata