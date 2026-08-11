# OpenAI-Compatible Reasoning, Streaming, and Cache Diagnostics Design

**Date:** 2026-08-10  
**Status:** Drafted from repo review + user-approved design direction  
**Scope:** Add a session-scoped reasoning control beside the active model, keep streaming behavior honest across chat surfaces, and expose best-effort cache diagnostics for OpenAI-compatible and Responses paths

## 1. Objective

Improve the request-control experience for OpenAI-compatible providers by making three things explicit and usable:

1. **Reasoning level control** — expose a session-scoped reasoning dropdown beside the active model display on all chat surfaces that show that model
2. **Streaming truthfulness** — preserve the existing behavior of always requesting streaming on supported paths, while making it clear in the design that incremental rendering ultimately depends on the upstream endpoint actually streaming
3. **Cache diagnostics** — improve cacheability where the request shape allows it and surface cache telemetry only when the upstream protocol returns trustworthy metadata

This is a **targeted UX + request-mapping enhancement**, not a transport rewrite.

## 2. Non-goals

- Replacing the existing chat-completions or Responses transport layers
- Promising universal cache hit/miss visibility across all OpenAI-compatible endpoints
- Inventing fake streaming for providers that return one final payload
- Designing a provider-agnostic reasoning ontology beyond what current providers can actually accept
- Refactoring unrelated model/provider infrastructure

## 3. Recommendation

### Chosen approach: unified control with protocol-aware request mapping

A single user-facing reasoning dropdown should work across all chat surfaces, while the request pipeline maps that value differently depending on the active transport:

- **OpenAI-compatible chat-completions path**: inject the reasoning choice into the existing provider-options pipeline only when the model supports reasoning
- **Responses path**: map the same session value into the Responses-specific parameter shape
- **Streaming**: keep requesting streaming through the existing client pipeline; incremental rendering depends on whether the upstream endpoint actually streams
- **Cache diagnostics**: show richer diagnostics only when the upstream returns trustworthy usage metadata such as cached-token details

### Alternatives considered

- **Responses-first only** — simpler to wire, but would create inconsistent UX between existing chat-completions and Responses paths
- **UI-only first** — faster visible change, but risks shipping a control that is not honestly wired to provider behavior

**Recommendation:** keep one UI concept and let the transport-specific adapters do the protocol work.

## 4. Verified findings

| Finding | Status | Evidence | Notes |
|---|---|---|---|
| The OpenAI-compatible chat path already exists | Verified | `src/shared/providers/definitions/models/custom-openai.ts` | Uses `createOpenAICompatible(...).languageModel(...)` |
| The Responses path already exists | Verified | `src/shared/providers/definitions/models/openai-responses.ts`, `src/shared/providers/definitions/models/custom-openai-responses.ts`, `src/shared/providers/definitions/models/openai-codex.ts` | Uses `createOpenAI(...).responses(...)` |
| Reasoning-related session controls already exist for some providers | Verified | `src/renderer/modals/SessionSettings.tsx` | OpenAI, Claude, and Google provider options already have reasoning/thinking-related UI |
| The current model layer already threads provider options | Verified | existing provider model definitions + approved repo review context | The new work is request mapping, not new transport creation |
| Chat completion execution already uses `streamText` | Verified | `src/shared/models/abstract-ai-sdk.ts:529-668` | The client does not have a separate "buffer full response then reveal" path; if output appears all at once, upstream likely emitted one payload |
| `stream === false` currently wraps with simulated streaming middleware | Verified | `src/shared/models/abstract-ai-sdk.ts:663-667` | Streaming semantics are already centralized |
| Cache telemetry is protocol-dependent, not universal | Verified | repo review + user-approved scope | Responses-capable endpoints may expose cached-token usage; generic OpenAI-compatible chat endpoints often will not |
| Anthropic-style cache breakpoints are not present in current OpenAI-compatible paths | Verified | earlier request-layer review in session | Relevant mainly as contrast; user scope here is OpenAI-compatible + Responses |

## 5. User-approved product decisions

The user validated the following decisions during brainstorming:

- Use **Option 1**: one unified feature with protocol-aware internals
- The reasoning control should be a **dropdown**, not a gauge
- Place it beside the active model display on **all chat surfaces that show the active model**
- Scope it as **session-first**, with an optional **save as default** action
- Use **provider-native labels where possible**, otherwise **Low / Medium / High**
- Support both **chat-completions and Responses**, with richer diagnostics on Responses when available
- For delivery behavior: **if upstream supports streaming, stream; if not, do not fake it**

Where the user did not explicitly overrule a recommendation, this design adopts the conservative option:

- Unsupported models keep the control visible but **disabled with explanatory tooltip**
- Cache diagnostics are **best-effort** and shown only when upstream data is trustworthy

## 6. Success criteria

A successful outcome means:

1. Users can change reasoning level from a dropdown adjacent to the active model on every relevant chat surface
2. The dropdown updates the current session immediately and can optionally be saved as the default for future sessions
3. Unsupported models display a stable but disabled control with a clear explanation
4. Chat-completions and Responses paths both accept the same UI choice, mapped honestly into their own request parameter shapes
5. The app continues to request streaming through the existing pipeline; when the upstream streams, the UI renders incrementally
6. Cache telemetry is shown only when the endpoint exposes trustworthy usage metadata; otherwise the UI stays honest and quiet
7. The feature does not imply fake universal cache-hit visibility on generic OpenAI-compatible endpoints

## 7. Design

### 7.1 User-facing behavior

Add a **reasoning dropdown** next to the active model display anywhere the chat UI already surfaces the chosen model. The control reads and writes a **session-scoped reasoning value**. When the user changes it, new requests in the current session immediately use that value.

The same control also offers an action to **save the current value as the default**. That default seeds new sessions but does not retroactively rewrite old ones.

The dropdown labels should be:

- **Provider-native labels** when the current provider/model has an explicit preferred vocabulary
- otherwise **Low / Medium / High**

If the current model does not support configurable reasoning, the control remains visible but **disabled**, with a tooltip explaining that the selected model does not expose a configurable reasoning level. This keeps layout stable and makes the feature discoverable.

### 7.2 State model

Use two layers of state:

1. **Global default setting** — optional; applies when creating or opening sessions without an explicit reasoning override
2. **Session setting** — authoritative for the active session and shared by every chat surface showing the active model

The session value should be the single source of truth for rendering the dropdown across surfaces. The global default should only seed session state and support the explicit “save as default” affordance.

This keeps per-chat experimentation easy while avoiding accidental global mutations from transient UI clicks.

### 7.3 Request mapping

The existing transport layers stay intact. The new work is a **thin normalization + mapping layer** between UI state and protocol-specific request options.

Recommended normalized internal values:

- `low`
- `medium`
- `high`
- `undefined` / unset

That normalized value is then mapped per active request path.

#### Chat-completions / OpenAI-compatible path

On the existing `custom-openai.ts` path, inject the reasoning setting only when the model advertises reasoning capability. The request should continue to flow through the existing provider-options mechanism rather than introducing a parallel transport-specific code path.

The implementation plan should verify the exact wire shape accepted by the underlying SDK/provider combination for OpenAI-compatible chat-completions. The design expectation is:

- if the provider path accepts reasoning effort on chat-completions, send the mapped value
- if not, omit it rather than sending a speculative parameter

This keeps the feature honest for heterogeneous OpenAI-compatible vendors.

#### Responses path

On the existing Responses path (`openai-responses.ts`, `custom-openai-responses.ts`, and related model definitions), map the same normalized value into the Responses-specific reasoning parameter shape.

The UI concept remains identical, but the wire contract can differ from chat-completions. That difference must stay encapsulated in the mapping layer rather than leaking into UI components.

### 7.4 Streaming semantics

No new streaming subsystem is needed.

The current client already executes chat generation through `streamText(...)`, and when `stream === false` it uses simulated streaming middleware rather than a separate buffered-render path. Therefore, the product design should state the behavior honestly:

- the client continues to **request streaming by default** through the existing pipeline
- incremental rendering happens when the upstream endpoint actually emits a stream
- if a provider returns a single final payload even on a nominally streaming path, the UI will necessarily appear to update all at once

This means the user-facing improvement is mostly **clarity and consistency**, not a new streaming engine.

### 7.5 Cache behavior and diagnostics

Treat caching as two separate concerns:

1. **Cacheability** — shaping requests so repeated stable prefixes are more likely to benefit from upstream caching
2. **Observability** — displaying cache-related usage only when the upstream returns trustworthy telemetry

#### Cacheability

For OpenAI-compatible and Responses paths, the main lever is **request-shape stability**, not a local cache toggle. The design should preserve stable reusable prefixes where practical and avoid unnecessary churn in repeated system/context content.

This spec intentionally does **not** promise a universal cache-control feature for all vendors. Generic OpenAI-compatible endpoints differ widely in what they support.

#### Diagnostics

Diagnostics should be **best-effort and protocol-aware**:

- On Responses-capable endpoints that surface cached-token metadata, the UI may show cached-token usage
- On generic OpenAI-compatible chat-completions endpoints with no trustworthy cache telemetry, the UI should show nothing or a neutral “telemetry unavailable” state
- The UI must never fabricate a cache hit/miss verdict from absence of metadata

A small low-noise diagnostic surface may expose:

- active transport: chat-completions vs Responses
- streaming requested / streaming effectively observed, where measurable
- cache telemetry available / unavailable
- cached-token count when actually returned

This should remain secondary information, not a prominent dashboard element in the main chat flow.

### 7.6 Components and boundaries

Recommended implementation units:

1. **ReasoningDropdown**
   - Pure UI component beside the model display
   - Responsible only for display, disabled state, label rendering, and user interaction

2. **ReasoningSettings source**
   - Reads/writes session reasoning value
   - Seeds from the optional saved default
   - Exposes one source of truth across chat surfaces

3. **ReasoningRequestMapper**
   - Converts normalized UI values into protocol-specific request params
   - Encodes differences between chat-completions and Responses
   - Prevents UI components from knowing transport details

4. **UsageDiagnostics model**
   - Interprets upstream usage metadata conservatively
   - Knows when cache telemetry is present, absent, or unsupported
   - Avoids fake cache verdicts

This separation keeps the feature understandable: UI controls stay simple, request mapping stays isolated, and telemetry interpretation stays conservative.

### 7.7 Error handling

- **Unsupported model** — render disabled dropdown with tooltip; no error toast
- **Unrecognized reasoning param** — omit unsupported params for that request path/provider combination; optionally log/debug internally, but do not break chat generation
- **Responses/chat path differences** — mapping layer absorbs protocol differences so the UI remains stable
- **No cache telemetry** — no warning toast; simply omit cache-specific metrics
- **Upstream streams only one payload** — no client-side workaround; behavior is acceptable and should be described honestly

## 8. Testing strategy

Testing should cover the isolated units and the integration seams that matter most.

### Unit tests

- reasoning label normalization and provider-native label fallback
- session override vs saved-default seeding behavior
- request mapping for chat-completions vs Responses
- unsupported-model disabled-state logic
- conservative usage diagnostics parsing (including "telemetry unavailable")

### Integration tests

- changing the dropdown updates the active session setting and is reflected across chat surfaces
- "save as default" affects newly created sessions but not existing session overrides
- chat-completions path includes reasoning params only when supported
- Responses path maps the same UI value into the Responses-specific request options
- cache diagnostics appear only when returned usage metadata actually contains cache-related fields

### Manual verification

- OpenAI-compatible endpoint using chat-completions path
- Responses path for the same or equivalent provider configuration
- supported model vs unsupported model
- streaming-capable endpoint vs endpoint that returns one final payload
- surface consistency across all chat views that display the active model

## 9. Likely implementation areas

- `src/renderer/modals/SessionSettings.tsx`
- chat-surface components that show the active model display
- reasoning/settings state store(s) for session + default behavior
- request mapping around existing OpenAI-compatible and Responses provider options
- usage-metadata parsing / diagnostics UI where cache telemetry can be shown conservatively
- tests for request mapping, session behavior, and usage parsing

## 10. Risks and constraints

1. **OpenAI-compatible vendor variance**  
   Different vendors may accept different reasoning parameters or ignore them entirely.

2. **Telemetry asymmetry**  
   Responses may expose richer cache usage than chat-completions; the UI must tolerate that asymmetry without looking broken.

3. **Discoverability vs clutter**  
   Putting the control on every chat surface improves access but risks crowding narrow layouts; implementation should preserve compactness.

4. **False expectations about streaming**  
   Users may interpret “stream supported” as “always visibly token-by-token.” The spec intentionally avoids that promise because upstream behavior ultimately determines chunk cadence.

## 11. Readiness for planning

This work is ready to move into implementation planning. The repo already has the relevant transport paths, existing reasoning-related settings precedent, and centralized streaming behavior. The remaining work is to turn this design into a concrete implementation plan focused on UI placement, state plumbing, protocol-specific request mapping, and conservative cache diagnostics.