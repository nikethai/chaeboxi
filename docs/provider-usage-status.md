# Provider Usage Status

Track **provider subscription / plan usage** and **in-app usage** for BYOK and OAuth providers.

## Honesty model

| Label | Meaning |
|---|---|
| **In this app** | Tokens / estimated cost measured from assistant messages with `usage` in Chaeboxi. Always available after chat turns (and after session backfill). |
| **Provider plan** | Best-effort plan identity + remaining quota when a provider exposes it. Often `unknown` or `unsupported` — never invent a remaining %. |

Progress bars render only when `quota.state === 'known'`.

## Where to find it

1. **Settings → Usage** — hub: period selector, overview, per-provider cards, soft budgets.
2. **Settings → Model Provider → [provider] → Plan & usage** — same dual metrics for the open provider.
3. **Session statusline** — quiet `plan` segment when there is a plan identity, budget warning, or exhausted state; click opens a popover.

## Soft budgets

Optional **in-app** soft limits (tokens and/or estimated $) over 7d / 30d / calendar month.

- Default: **warn only** (toast once per threshold per period).
- Optional: **Pause generation when budget exceeded** (user opt-in).
- Budgets do **not** replace provider subscription enforcement (impossible for BYOK).

## Adapters

Adapters live under `src/renderer/packages/usage-tracking/adapters/`.

| Adapter | Providers | Plan identity | Provider quota |
|---|---|---|---|
| `openai-codex` | OpenAI | OAuth `planType` / Platform API | unknown + error-driven exhausted |
| `gemini-antigravity` | Gemini | OAuth plan / AI Studio | partial via model catalog exhausted flags |
| `qwen-plan` | Qwen | planId presets | unknown + dashboard links |
| `xai-oauth` | xAI | SuperGrok / API | unknown + error-driven exhausted |
| `default` | everyone else | — | `unsupported` |

To add a provider:

1. Implement `ProviderQuotaAdapter` (`supports`, `getPlan`, `fetchQuota`, `getLinks`).
2. Register in `adapters/index.ts`.
3. Prefer official APIs only; degrade to `unknown` if remaining % is not proven.

## Data storage

| Key | Content |
|---|---|
| `usage-rollup` | Day × provider × model local aggregates |
| `usage-quota-cache` | Last provider quota snapshots (TTL ~10 min) |
| `usage-budget-notify` | One-shot toast state |
| Settings `usageBudget` | Soft budget config (Zod) |

## Non-goals

- Chaeboxi / Chatbox AI license billing UI (CE strips paid license features).
- Scraping undocumented high-frequency provider billing endpoints.
- Fake hard-coded subscription meters (e.g. “Plus = 40 messages”).

## Spike notes (v1)

- **Codex / ChatGPT OAuth:** no stable public remaining-quota API; use `planType` + error-driven exhausted.
- **Qwen Coding/Token Plan:** no wired official remaining-quota endpoint; plan presets + console links.
- **xAI SuperGrok:** no remaining-quota API; OAuth label + local + errors.
- **Gemini Antigravity:** model catalog may include `quotaInfo.isExhausted` when listing models — partial state only.

Longer research notes: [claudedocs/provider-usage-adapter-spikes.md](../claudedocs/provider-usage-adapter-spikes.md).

## Related packages

| Layer | Path |
|---|---|
| UI hooks / rollup / budgets | `src/renderer/packages/usage-tracking/` |
| Quota adapters | `src/renderer/packages/usage-tracking/adapters/` |
| Shared types + adapter interface | `src/shared/providers/usage/` |
| UI cards / status | `src/renderer/components/usage/` |

See also: [storage.md](./storage.md) (storage keys), [adding-new-provider.md](./adding-new-provider.md) (optional plan adapter when adding a provider).
