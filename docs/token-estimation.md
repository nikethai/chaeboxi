# Token Estimation

How Chaeboxi estimates tokens for context management and budget UI.

## Purpose

- Keep conversations within the model context window
- Support truncation / compaction decisions
- Show approximate usage in the UI

## Approach

Token counts are **estimates**, not exact provider billing tokens. Different providers tokenize differently.

Implementation lives under `src/renderer/packages/token-estimation/` (and related helpers in shared utilities).

## Guidelines

1. Prefer provider-specific counters when available.
2. Fall back to a generic estimator for unknown models.
3. Never block chat solely on estimate failures—fail open with a safe default.
4. When changing estimators, add/adjust unit tests next to the module.

## Related

- Context management: `src/renderer/packages/context-management/`
- Session generation path: `src/renderer/stores/session/`
