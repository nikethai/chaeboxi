# Gate 0 ADR — Video URL transcript providers

**Date:** 2026-08-10  
**Status:** Accepted (auto cook defaults)

## Decision

| Item | Choice |
|---|---|
| Primary BYOK multi-platform | **Custom HTTP** (user endpoint) + optional **Supadata-compatible** client |
| STT | **OpenAI-compatible Whisper** via dedicated `sttApiKey` **or reuse** OpenAI provider key |
| Default `enabled` | `true` (free YouTube captions path works without keys) |
| Desktop yt-dlp | Optional, off by default |
| Facebook URL patterns | `facebook.com/*/videos/*`, `facebook.com/watch`, `fb.watch/*`, `facebook.com/reel/*`, `facebook.com/share/v/*` |

## Rationale

- Vendor lock avoided: `custom` is first-class; Supadata-style is an optional convenience.
- YT free path ships value without keys.
- TT/FB require BYOK; structured `PROVIDER_REQUIRED` when missing.
- STT reuses OpenAI when possible to reduce setup friction.

## Custom HTTP contract

`POST customEndpoint` with JSON body:

```json
{
  "url": "https://...",
  "language": "en",
  "mode": "transcript"
}
```

Expected 200 JSON (flexible):

```json
{
  "title": "...",
  "author": "...",
  "durationSec": 120,
  "description": "...",
  "language": "en",
  "transcript": "full text OR",
  "text": "full text",
  "segments": [{ "startSec": 0, "endSec": 2.5, "text": "..." }]
}
```

## Supadata-compatible

`GET https://api.supadata.ai/v1/transcript?url=...&text=true`  
Header: `x-api-key: <key>`

Map response fields into `NormalizedVideoRead`.
