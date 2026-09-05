# Writing Baseline and Evaluation

## Current result

The writing assistant is implemented as a development checkpoint in `d19af16c`, on `feat/daily-copilot-writing`. It is **not a validated writing beta**. Human rewrite quality, provider-specific isolation, packaged-app privacy, accessibility, and performance gates remain open.

This follow-up adds 40 synthetic drafts: eight per writing style. No real conversations, credentials, model responses, or paid calls are included.

Provider compatibility is not limited to a model chosen for a first evaluation. The [compatibility follow-up](./writing-provider-compatibility.md) shares picker/runtime eligibility, enables Perplexity without search, and adds offline coverage across the provider registry and custom text API formats.

## Evaluation design

Use [the JSON corpus](../../src/renderer/packages/writing/__fixtures__/corpus.json) for both offline boundary tests and explicitly approved human evaluations.

Each case contains:

- `id`: stable identifier for comparing runs.
- `style`: the selected writing action.
- `tags`: coverage categories, including mixed English/Vietnamese, formatting, facts, and adversarial instructions inside drafts.
- `draft`: synthetic input, copied exactly into the writing surface.
- `referenceRewrite`: an authored acceptable example, **not a recorded model response or the only acceptable answer**.
- `preserveExactly`: protected fragments that must survive unchanged, such as URLs, code, names, and identifiers.
- `reviewNotes`: semantic requirements a human must assess, including negation, uncertainty, and commitments.

Exact reference matching would penalize valid rewrites. An automatic model judge would add cost and another source of uncertainty. Instead, use deterministic checks for transport and corpus integrity, then a human rubric for actual writing quality. A fragment match is not proof of preserved meaning.

The corpus is test-only; it is not imported by the application or automatically sent to a provider. Keep private task samples and raw evaluation responses outside the repository. Any new fixture must be synthetic or explicitly redacted and approved.

## Offline checks

Run from the repository root:

```bash
pnpm exec vitest run src/renderer/packages/writing src/renderer/components/writing src/shared/models/abstract-ai-sdk-ephemeral.test.ts src/shared/providers/definitions/models/perplexity-writing.test.ts
pnpm exec biome lint src/renderer/packages/writing src/renderer/components/writing src/renderer/modals/WritingAssistant.tsx src/shared/types/writing.ts src/shared/models/abstract-ai-sdk-ephemeral.test.ts
```

The [corpus tests](../../src/renderer/packages/writing/corpus.test.ts) validate unique IDs and drafts, format limits, coverage, and reference consistency. Each draft also passes through the writing service with a mocked model. Tests check the two-message boundary, ephemeral diagnostics option, empty tools, and preservation of streamed/completed text.

The existing suites cover invalid input, excluded backends, reasoning filtering, incomplete output, error redaction, explicit saving, cancellation, timeout, and late-result rejection. These are deterministic tests of code boundaries, not a provider compatibility audit or a writing-quality score.

## Human evaluation procedure

### Before calling a model

1. Obtain explicit approval for the provider, model, corpus transfer, and any paid usage. Configuring a provider is not approval to run a paid evaluation.
2. Supply credentials through the application's provider settings. Never put keys in fixtures, reports, or commands.
3. Record build commit, OS, app surface, provider/model, endpoint identity without credentials, test date, and prompt-policy commit. Record relevant provider settings and whether the connection is local or remote.
4. Agree on a cost budget. Record unknown pricing as unknown; token counts are not themselves a cost estimate.

### For each case

1. Open Quick Chat's **Improve writing** action, or the main composer's tools menu → **Improve writing**. Use a fresh review rather than continuing a previous chat.
2. Paste the exact `draft`, select its `style`, and explicitly select the agreed model. Check the displayed destination.
3. Run one rewrite and record the first result, elapsed time, and displayed usage. Record failures and timeouts rather than discarding them.
4. Compare the source and output using `reviewNotes` and `preserveExactly`. The reference is guidance, not a mandatory string.
5. Rate usability, meaning, formatting, and tone. For mixed-language cases, use a reviewer competent in English and Vietnamese.
6. Verify Copy returns the same text. Close the review without saving unless testing the explicit Save path.

Retries may be recorded separately but must not replace the first-attempt score. Comparing with Gemini/Grok consumer apps requires separate consent and records of their settings; consumer UI results are not a controlled comparison with an API model.

### Rubric and result record

For each `case_id`, record:

| Field | Values / rule |
| --- | --- |
| Outcome | Complete, failed, timed out, cancelled, or not run |
| Usable without another rewrite | Yes / no; judge the first attempt |
| Critical meaning change | Yes / no, with the changed name, amount, date, negation, certainty, or commitment |
| Protected fragments | Preserved / changed; describe changes without treating this as the entire meaning check |
| Language, formatting, tone | Pass / fail for each; explain failures |
| Latency and usage | Measured elapsed time and available token counts; unknown values remain unknown |
| Retry | Separate attempt ID; keep the original score |
| Reviewer notes | Short reason, including unsupported or unclear cases |

For a complete 40-case run, the proposed gate is at least **36 usable first attempts** and **zero critical meaning changes**. Every case must be attempted; unrun cases block a complete evaluation. Failures and timeouts count as unusable, not exclusions. Do not average away critical meaning failures. Report counts before percentages and retain the plan's language/formatting requirements.

## Packaged-app and privacy checks

Run these separately from the corpus. Use synthetic sentinels, not private text:

- Put unrelated synthetic text in the previous chat and memory. Capture a writing request through an explicitly authorized local test endpoint and confirm it contains only the editing policy and current draft. Repeat for each advertised provider path; mocked tests alone do not prove this.
- Close during streaming and reopen. No unsaved draft or result should appear in review state, normal history, memory, sync, or content-bearing diagnostics. Inspect persisted stores as well as visible history.
- Start a rewrite, edit the draft, then allow the old request to finish. Old output must not replace the new draft or result.
- Cancel, time out, and fail a provider request. The original draft remains available and raw provider error bodies do not appear.
- Explicitly choose Save to chat once. Verify both drafts appear in the new conversation, the selected model is retained, and memory auto-save is disabled. Normal history-sync policy applies to this intentionally saved chat.
- Test keyboard-only access, focus return, screen-reader labels/status, multiline/IME input, copy failures, and small-screen layout.
- Validate the Quick Chat entry in a packaged desktop build. Browser tests do not validate desktop shortcuts, window behavior, or native clipboard integration.

Record supported platform/provider combinations individually. Native selected-text replacement remains out of scope; nothing sends a Slack or WhatsApp message.

## Evidence and remaining work

Checkpoint verification before adding this corpus:

| Check | Observed result |
| --- | --- |
| Vitest | 188 files passed, 3 skipped; 1,650 tests passed, 74 skipped, 2 todo |
| New writing files: Biome lint and format | Passed |
| Renderer production build | Passed; bundler warnings remain |
| TypeScript | 37 errors in 12 files; identical error locations and codes reproduced on clean `a2f72b45` with the same installed dependencies |
| Live provider evaluation | Not run; no quality or cost measurements |
| Packaged desktop / web UI walkthrough | Not run |

Corpus follow-up verification:

| Check | Observed result |
| --- | --- |
| Focused writing suites | 6 files, 129 tests passed, including 81 corpus integrity/transport checks |
| Full Vitest suite | 189 files passed, 3 skipped; 1,731 tests passed, 74 skipped, 2 todo |
| Corpus Biome check | Passed; writing lint and format also passed |
| Web production build | Passed; bundler warnings remain |
| TypeScript after corpus changes | Still 37 baseline errors, with no new error locations/codes |

The full-suite result includes unrelated tests; it is not 1,731 writing tests. Type-checking is **not green**. Existing errors are in imported-history, desktop platform, settings/migration, Gemini Antigravity, and website code. Do not weaken checks or expand this feature branch into unrelated fixes.

Environment: Node `24.13.0`, pnpm `10.15.1`, Vitest `4.0.18`. The installed Node version is outside the project's supported Node 20–22 range. These results are useful development evidence, not a supported-toolchain release certification; repeat release checks on Node 20–22.

Next: authorize bounded evaluations across representative configured providers, run the corpus and packaged workflow checks, record failures, and refine the writing slice. Choosing an initial test model does not narrow supported-model scope. Keep local analysis, engines, OAuth, OCR, and replacement gated independently.
