# Provider verification matrix

## Commands

```bash
# Registry / pure shared
pnpm test -- src/shared/providers/registry.test.ts
pnpm test -- src/shared/providers/definitions/models/<provider>.test.ts
pnpm test -- src/shared/providers/oauth/

# Quality
pnpm check
pnpm lint

# Dev smoke (manual)
pnpm dev
# or
pnpm dev:web
```

## Minimum evidence by change type

| Change | Minimum |
|--------|---------|
| Registry metadata only | typecheck + lint; smoke model list if UI affected |
| OpenAI-compatible model | unit tests for create/list/settings; streaming if touched |
| Custom AI SDK model | stream/error/tool tests as applicable |
| OAuth dual-auth | oauth unit tests + authMode branch review; no silent key fallback |
| Capability flags | assert UI/tool gating expectations |
| Usage/quota adapter | adapter tests; official API only |

## Integration tests

- `pnpm test:model-provider` / `pnpm test:integration` only when credentials and environment are intentionally available.
- Do not treat credential-dependent failures as local unit-gate failures.

## Report buckets

- Passed
- Failed
- Not run
- Unavailable (no key / no host)
