# Plan: Gemini dual-auth (API key + Antigravity-style Google OAuth)

**Status:** Implemented (Phases 0–5) — 2026-08-06  
**Date:** 2026-08-06  
**Report:** [reports/2026-08-06-research-gemini-antigravity-subscription-oauth.md](./reports/2026-08-06-research-gemini-antigravity-subscription-oauth.md)

### Implementation notes

- Phase 0 spike folded into production modules (no throwaway script).
- PKCE + paste-redirect UX (desktop/web-safe without Tauri localhost server).
- Unit tests: `src/shared/providers/oauth/gemini-antigravity-oauth.test.ts` (18 tests).

## Goal

Let users use Gemini in Chaeboxi like xAI SuperGrok / OpenAI ChatGPT subscription:

- **API key** → AI Studio / Generative Language API (existing, safe default)
- **Google sign-in (Antigravity / Cloud Code Assist)** → subscription/quota path via OAuth

## Product gate (must decide before code)

| Decision | Options |
|----------|---------|
| Risk posture | **No-go** (official only) · **Experimental** (default) · Full product feature |
| Surfaces | Desktop only · Desktop + web manual paste |
| Models | Gemini only · Gemini + Claude-via-Google |
| OAuth client | Reuse community Antigravity client IDs · Own GCP OAuth app |

**Recommendation:** Experimental, desktop-first, Gemini-only, after successful personal spike. Strong ToS warning in UI.

## Phases (after go)

### Phase 0 — Spike (1–3 days)

- PKCE login on Tauri desktop
- Store tokens + `projectId`
- One streaming chat via `cloudcode-pa` envelope
- Document failure modes (429, ban, empty SSE)

**Exit:** Chat works for a real Google account for several days without breakage.

### Phase 1 — Dual-auth plumbing

- `gemini-antigravity-oauth.ts` / `gemini-antigravity-auth.ts`
- Extend `oauth` settings with `projectId`, `email`
- `authMode` default remains `api_key` for Gemini (unlike xAI)

### Phase 2 — Model transport

- `gemini-antigravity` model class (or custom fetch adapter)
- Envelope wrap/unwrap; refresh tokens like `ensureXaiBearer`
- Map `fetchAvailableModels` into provider model list

### Phase 3 — UI

- Reuse `$providerId.tsx` subscription OAuth pattern (toggle, sign-in, sign-out, check connection)
- ToS/risk modal before first OAuth
- Hide API host when oauth mode (fixed Cloud Code base)

### Phase 4 — Hardening

- Humanized 429 / quota reset
- Tests for token refresh, settings patches, auth mode resolution
- Web: disable or manual paste only

### Out of scope (v1)

- Multi-account rotation
- Claude-via-Antigravity
- Soft-quota orchestration across accounts

## Dependencies

- Existing dual-auth for xAI/OpenAI (copy patterns, not device-code mechanics)
- Tauri open browser + localhost callback or deep link
- Desktop HTTP fetch (CORS) if needed — already used by other OAuth

## Acceptance criteria (when implemented)

- [ ] API key path unchanged
- [ ] OAuth sign-in stores tokens + projectId; chat uses Cloud Code Assist
- [ ] Refresh works without re-login
- [ ] Sign-out clears oauth without wiping apiKey
- [ ] Clear error if unsigned / expired / rate limited
- [ ] ToS acknowledgment required once

## Risks

| Risk | Mitigation |
|------|------------|
| Account ban / ToS | Experimental flag + warning; no multi-account abuse features |
| API churn | Isolate transport module; feature flag |
| Web CORS / callback | Desktop-first |

## Unresolved

See research report end.
