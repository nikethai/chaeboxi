# Writing Provider Compatibility

## Scope and decision

Writing is a provider-neutral feature. The user confirmed that it should support configured text/chat models across providers, not just one model chosen for an evaluation.

Keep the existing provider registry, factories, credentials, and model selection. Do not add a preferred-model allowlist, switch providers on failure, or weaken the isolated writing policy to enable a remote agent.

Two alternatives were rejected:

- Keeping the blanket Perplexity exclusion unnecessarily removes text models that have an explicit no-search option.
- Removing every exclusion would allow remote agent sessions or non-text models into a workflow that promises no tools or unrelated context.

The implemented approach shares one eligibility rule between selection and execution, enables Perplexity with search disabled, and tests the existing adapter families offline.

## Implementation

### Shared selection rule

[`getWritingModels`](../../src/renderer/packages/writing/models.ts) filters the configured model catalog (or defaults when no configured list exists). Text, reasoning, and vision-input models remain eligible. Embedding, reranking, image-generation/editing, and recognizable image/audio/video-only model IDs do not.

An explicit empty model list stays empty. A custom text model does not need to appear in a built-in catalog.

[`requestWritingRewrite`](../../src/renderer/packages/writing/runtime.ts) resolves the current provider settings and checks the same rule before creating model dependencies. Removed models, deleted providers, non-text selections, and unsupported custom API formats fail with `unsupported_model`. It does not retry with a different model.

### Perplexity no-search policy

Writing calls carry `purpose: 'writing'` as well as `contentPrivacy: 'ephemeral'`. These are separate concerns: purpose controls provider execution behavior; privacy controls content-bearing diagnostics.

The [Perplexity adapter](../../src/shared/providers/definitions/models/perplexity.ts) adds `providerOptions.perplexity.disable_search = true` only for the writing purpose. The installed SDK serializes this as the API's `disable_search` field. Ordinary chat keeps its existing search behavior, including when diagnostic privacy is ephemeral.

The [official API schema](https://docs.perplexity.ai/api-reference/sonar-post.md) documents `disable_search: true` as disabling web search. The real-SDK/mock-HTTP tests check the actual serialized request for all five IDs in the adapter's current Sonar catalog. This does not verify live availability of those IDs or migrate the installed SDK's endpoint.

If the server rejects the parameter, the request fails. The application never removes the flag as a fallback.

### Remaining exclusions

| Backend | Reason |
| --- | --- |
| OpenClaw | The current adapter connects to remote agent sessions; empty caller tools do not disable the agent's own tools or retained context |
| ComfyUI and custom ComfyUI format | Image workflow rather than a text completion adapter |
| Disabled legacy hosted cloud and its custom format | Disabled by product policy; this change does not reactivate it |
| Non-text models | Not an appropriate output modality for a writing rewrite |

An arbitrary custom OpenAI-compatible host may itself wrap a search service or agent. The app cannot infer or control undisclosed server-side behavior from that host's name. The user must choose a trusted text backend; UI filtering is not a remote execution sandbox.

## Offline coverage

| Test layer | Coverage | What it establishes |
| --- | --- | --- |
| Model eligibility | All 22 registered providers; four custom text API formats; mixed catalogs and stale selections | Picker and runtime use the same model eligibility rule |
| Real factories and adapters, mocked `streamText` | All 20 registered text providers, custom OpenAI/Responses/Claude/Gemini, and OpenAI/Gemini/xAI OAuth factory routes | Selected model, isolated messages, empty tools, step limit, abort signal, usage propagation, redacted errors, and no fallback at the SDK boundary |
| Real Perplexity SDK, mocked HTTP | Five Sonar IDs, ordinary chat, rejected parameter | The no-search flag reaches the request body; normal chat remains unchanged; rejection does not enable search |
| Component test | Select Perplexity, inspect destination, explicitly rewrite | The model is reachable from the real writing picker and is not silently replaced |

Representative model IDs exercise each factory, not every published model/version. Network calls are blocked or replaced by synthetic responses. OAuth tests exercise factory selection with synthetic tokens, not refresh, sign-in, or subscription availability.

Run from the repository root:

```bash
pnpm exec vitest run src/renderer/packages/writing src/renderer/components/writing src/shared/models/abstract-ai-sdk-ephemeral.test.ts src/shared/providers/definitions/models/perplexity-writing.test.ts
```

## Verification results

Compared with writing checkpoint `6a8d4488`:

- Focused writing/compatibility suites: **9 files, 221 tests passed**.
- Full Vitest suite: **192 files passed, 3 skipped; 1,823 tests passed, 74 skipped, 2 todo**.
- Renderer and web production builds: passed, with existing bundler warnings.
- Changed writing/provider files passed Biome checks. Lint/format of the component, shared options, and English copy passed; the existing `void` union lint warning in shared model options remains.
- TypeScript: **37 errors**, with identical error locations and codes reproduced from a clean archive of `6a8d4488` using the same dependencies. No new type errors; the repository-wide check is still not green.
- Environment: Node `24.13.0`, pnpm `10.15.1`, Vitest `4.0.18`. Release validation still needs supported Node 20–22.

No live model requests, sign-in attempts, or packaged desktop tests were run.

## Remaining release gates

Run the [human writing evaluation](./writing-evaluation.md) and packaged-platform checks against representative configured providers, including local and custom endpoints. Live provider compatibility, actual search suppression, OAuth refresh, model quality, latency, and cost still require explicit authorized evaluation. No paid calls or private-data transfers are part of this implementation.

Keep the existing TypeScript baseline failures and supported Node 20–22 requirement visible in release evidence. Offline compatibility tests do not certify a release or close the entire Phase 1 gate.
