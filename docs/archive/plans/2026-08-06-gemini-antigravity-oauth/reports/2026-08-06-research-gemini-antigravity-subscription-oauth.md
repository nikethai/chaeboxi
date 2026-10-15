# Research Report: Gemini Antigravity Subscription OAuth for Chaeboxi

**Date:** 2026-08-06  
**Scope:** How to support Gemini (and related Google-backed models) via Antigravity-style Google OAuth / subscription quota, analogous to existing xAI SuperGrok and OpenAI ChatGPT Codex dual-auth.

## Executive Summary

Chaeboxi already has a proven **dual-auth** pattern for subscription vs API-key providers:

- **xAI:** device-code OAuth → SuperGrok/X Premium → `api.x.ai`
- **OpenAI:** device-code OAuth (Codex client) → ChatGPT Plus/Pro → WHAM Responses (`chatgpt.com/backend-api/wham`)
- **Gemini today:** API key only → `generativelanguage.googleapis.com` via `@ai-sdk/google`

**Antigravity** is Google’s agentic IDE/CLI product. Community clients (OpenCode plugin, PicoClaw, etc.) authenticate with **Google OAuth 2.0 + PKCE** (browser + localhost callback, not device-code), then call **Cloud Code Assist internal APIs** (`cloudcode-pa.googleapis.com/v1internal:*`) with a **project envelope** and special client headers. That path is subscription/quota-backed for Antigravity / Gemini CLI users — **not** the AI Studio API-key path.

**Critical risk:** Unofficial reuse of Antigravity OAuth + internal endpoints is widely flagged as **ToS-violating**. Users of community plugins report **account bans**. The popular `opencode-antigravity-auth` repo is **archived (2026-07)** and carries explicit ban warnings. Any product plan must treat this as **high legal/product risk**, not a clean “ChatGPT Plus equivalent.”

**Recommendation:** Architect like xAI/OpenAI dual-auth for UX consistency, but implement **Gemini path as a distinct transport** (Cloud Code Assist envelope + PKCE OAuth + `projectId`). Ship **Gemini-only v1**, defer multi-account rotation and Claude-via-Antigravity. Gate feature with clear ToS/risk UI. Prefer official Gemini API key / Vertex for production-safe users.

## Research Methodology

- Sources: Chaeboxi codebase (oauth modules, gemini provider, settings schema), PicoClaw Antigravity provider docs, OpenCode antigravity-auth README/architecture, Google Antigravity enterprise docs, Gemini CLI auth docs, community ban reports
- Date range: ~late 2025 – Aug 2026 materials
- Search terms: Antigravity OAuth, cloudcode-pa, Gemini CLI OAuth, subscription dual-auth, opencode-antigravity-auth, loadCodeAssist, streamGenerateContent

## Key Findings

### 1. What “Antigravity login” actually is

| Layer | Detail |
|-------|--------|
| Product | Google Antigravity — agentic IDE + CLI; free tier + Google AI Pro/Ultra / Enterprise licenses |
| Auth | OAuth 2.0 **PKCE** (browser), not RFC device-code like xAI/OpenAI Codex |
| Token | Standard Google `access_token` + `refresh_token` from `oauth2.googleapis.com/token` |
| Backend | **Cloud Code Assist** internal API: `https://cloudcode-pa.googleapis.com` |
| Chat | `POST /v1internal:streamGenerateContent?alt=sse` with body envelope `{ project, model, request: { Gemini-shaped payload }, ... }` |
| Models/quota | `v1internal:fetchAvailableModels`, `v1internal:loadCodeAssist` (project, credits, tier) |
| Client hints | Headers/metadata mimicking IDE/CLI (`User-Agent`, `X-Goog-Api-Client`, `Client-Metadata` / ideType pluginType) |

Scopes commonly used by community implementations:

- `cloud-platform`
- `userinfo.email` / `userinfo.profile`
- `cclog`, `experimentsandconfigs` (varies by client)

**Not the same as:**

1. **AI Studio API key** → `generativelanguage.googleapis.com` (what Chaeboxi Gemini does today)
2. **Official Gemini API OAuth** (Google Cloud project OAuth for Generative Language API — different product surface)
3. **Vertex AI** ADC / service accounts

### 2. Dual quota reality

Community plugins distinguish:

- **Antigravity quota pool** — IDE/agent models (Gemini 3.x, sometimes Claude Opus/Sonnet via Google gateway)
- **Gemini CLI quota pool** — overlapping Gemini models, separate rate limits; routing can prefer CLI-first or Antigravity-first

Google One AI Pro **does not always equal** full Antigravity/API quota; users report Free-tier treatment and 429s when product identity / project setup is wrong.

### 3. Chaeboxi baseline (reuse)

| Component | Status |
|-----------|--------|
| `ProviderSettings.authMode` + `oauth{}` | Exists (xAI/OpenAI) |
| Device-code OAuth modules | xAI, OpenAI Codex |
| Dual-auth UI in `$providerId.tsx` | Wired for xAI + OpenAI only |
| Gemini provider | API key only; `@ai-sdk/google` |
| Settings fields for `projectId` / Google email on oauth | **Missing** (OpenAI has `accountId`/`planType`/`idToken`) |

Pattern to clone (mental model):

```
authMode: 'oauth' | 'api_key'
oauth: { accessToken, refreshToken, expiresAt, ...provider-specific }
createModel → resolve bearer (refresh if needed) → pick transport
```

OpenAI already shows **different model class + base URL** for subscription vs key (Codex/WHAM vs Platform). Gemini OAuth should follow that split, not force Antigravity through `@ai-sdk/google` with only an API key swap.

### 4. Auth flow comparison

| | xAI SuperGrok | OpenAI Codex | Antigravity / Cloud Code |
|--|---------------|--------------|---------------------------|
| Flow | Device code | Device code | **PKCE + browser redirect** |
| UX | Show user code, open URI | Same | Open browser → localhost callback (or paste redirect URL) |
| Desktop fit | Excellent | Excellent | Need **local callback server** or Tauri deep link |
| Web fit | Hard (CORS/network) | Hard | Harder (localhost callback; manual paste mode) |
| API after auth | OpenAI-compatible | WHAM Responses | **Internal envelope + SSE unwrap** |

### 5. Security & ToS

| Risk | Severity | Notes |
|------|----------|-------|
| ToS / account ban | **Critical** | Documented bans after OpenCode antigravity plugin use |
| Unstable private API | High | Endpoints, headers, client IDs can change without notice |
| Client ID/secret reuse | High | Community clients embed Google OAuth client credentials intended for Google apps |
| Token storage | Medium | Refresh tokens = full account access; encrypt / OS keychain preferred |
| Multi-account rotation | Medium | Looks like quota abuse; elevates ban risk |
| Claude via Antigravity | High complexity + ToS | Extra thinking-signature protocol; out of scope for v1 |

**Official safer alternatives:**

1. Gemini API key (AI Studio) — current Chaeboxi path  
2. Vertex AI with user/project billing  
3. Wait for official “use Google AI subscription in third-party apps” if Google ever ships one

### 6. Performance / reliability

- 429 with `quotaResetDelay` in error details — need humanized wait messages  
- Empty 200 SSE for restricted models  
- Token refresh with skew (5 min buffer used by PicoClaw; Chaeboxi uses 60s for xAI/OpenAI)  
- Multi-account rotation popular in TUIs — **YAGNI for Chaeboxi v1**

## Comparative Analysis

### Option A — Full Antigravity OAuth (community-style)

- Pros: Matches user ask; subscription-like UX; models/quota like OpenCode  
- Cons: ToS ban risk; reverse-engineered API; maintenance hell; legal exposure for Chaeboxi brand  

### Option B — Dual-auth: API key (default) + experimental “Google sign-in (Antigravity)”

- Pros: Aligns with xAI/OpenAI UX; power users opt in; API key remains safe default  
- Cons: Still ships risky path if enabled by default  

### Option C — Import tokens from Gemini CLI / Antigravity local auth files only

- Pros: No embedded OAuth client; user already authenticated “officially”  
- Cons: Fragile file formats; desktop-only; still hits same APIs (ToS still murky); worse UX  

### Option D — Official only (key + Vertex), no Antigravity

- Pros: Clean ToS; stable  
- Cons: Does not deliver “subscription like ChatGPT/xAI”  

**Strategic pick for Chaeboxi:** **B with explicit experimental flag and ToS modal**, or **D** if product risk appetite is low. Do not default OAuth on for Gemini.

## Implementation Recommendations (architecture only)

### Target dual-auth model (mirror xAI/OpenAI)

```
Gemini Provider
├── authMode: api_key  → Gemini model class → generativelanguage.googleapis.com (existing)
└── authMode: oauth    → GeminiAntigravity model class → cloudcode-pa.googleapis.com
                         tokens + projectId + email in settings.oauth
```

### Modules (proposed; do not implement yet)

```
src/shared/providers/oauth/
  gemini-antigravity-oauth.ts   # PKCE start, callback exchange, refresh
  gemini-antigravity-auth.ts    # dual-auth resolve, ensureBearer, settings patches
  gemini-antigravity-models.ts  # fetchAvailableModels mapping
src/shared/providers/definitions/models/
  gemini-antigravity.ts         # chat via envelope + SSE unwrap (or custom fetch for AI SDK)
```

Extend `settings.oauth` optionally:

- `projectId`
- `email` (display)
- maybe `quotaPool: 'antigravity' | 'cli'` later

### Desktop UX (Tauri)

1. User toggles “Sign in with Google (Antigravity)”  
2. App generates PKCE, opens system browser  
3. Localhost callback (or deep link) captures `code`  
4. Exchange tokens; `loadCodeAssist` → store `projectId`  
5. Optional: fetch model list + show plan/credits  
6. Chat uses subscription transport  

### Web UX

- Prefer **manual redirect URL paste** (like remote PicoClaw)  
- Or disable OAuth on web and show “use desktop app / API key”

### What not to do in v1 (YAGNI)

- Multi-account rotation  
- Claude-via-Antigravity  
- Soft-quota threshold orchestration  
- Embedding “masquerade as VS Code” beyond minimum required headers (reduces detection risk but never eliminates ToS issue)

## Resources

- Chaeboxi: `src/shared/providers/oauth/xai-oauth.ts`, `openai-codex-oauth.ts`, `definitions/gemini.ts`, settings `authMode`/`oauth`
- PicoClaw Antigravity provider guide: https://docs.picoclaw.io/docs/providers/antigravity/
- OpenCode plugin (archived, ToS warning): https://github.com/NoeFabris/opencode-antigravity-auth
- Antigravity product: https://antigravity.google/
- Gemini CLI auth: https://geminicli.com/docs/get-started/authentication/
- Official Gemini OAuth (different product): https://ai.google.dev/gemini-api/docs/oauth
- Ban report example: discuss.ai.google.dev thread on opencode-antigravity-auth bans

## Unresolved Questions

1. Product risk appetite: ship experimental Antigravity OAuth at all, or stay API-key-only?  
2. Is Chaeboxi willing to embed third-party Google OAuth client credentials (community reverse-engineered)?  
3. Scope: Gemini models only, or also Claude models via Google gateway?  
4. Desktop-only for OAuth v1, or web manual paste too?  
5. Should OAuth use a **Chaeboxi-owned Google Cloud OAuth client** (if Google allows the scopes) vs reusing Antigravity client IDs?

## Next Steps (for plan approval)

1. Product decision on ToS/risk (go / no-go / experimental-only).  
2. Spike: PKCE login + one `streamGenerateContent` chat on desktop (throwaway branch).  
3. Spike: map Antigravity model IDs to Chaeboxi model list.  
4. Design dual-auth UI reuse in `$providerId.tsx`.  
5. Full implementation plan only after spike proves auth + chat stable for 1–2 weeks of personal use.
