# Provider usage adapter spikes (v1)

Date: 2026-08-10

Product / honesty model / UI surfaces: [docs/provider-usage-status.md](../docs/provider-usage-status.md).

## Codex / OpenAI ChatGPT OAuth

- In-repo: `oauth.planType` from JWT claims (`plus`, `pro`, `team`, …).
- No stable public remaining-message / remaining-token endpoint used by the client.
- Decision: ship `unknown` + plan label + mark exhausted on classified quota errors.

## Gemini Antigravity

- In-repo model list parsing sees `quotaInfo.isExhausted` and filters exhausted models from the picker.
- Adapter accepts optional `catalogHints` for partial/exhausted model lists.
- No continuous remaining-% meter without new reverse-eng; ship partial/unknown honestly.

## Qwen plan presets

- `planId` + `region` + docs/dashboard URLs already in `plan-presets/qwen.ts`.
- No official remaining-quota API wired in app.
- Decision: plan identity + local usage + docs/dashboard links; quota state `unknown`.

## xAI SuperGrok

- Dual auth OAuth vs API key; plan type optional on tokens.
- Decision: SuperGrok / xAI API labels + local + error-driven exhausted.

## Rate-limit headers

- Capturing `x-ratelimit-*` through the current AI SDK stream path would require invasive response plumbing.
- Deferred; not required for full product honesty model.
