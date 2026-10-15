# Research Report: Agent Tool for Reading YouTube / Vimeo / TikTok / Facebook Video URLs

**Date:** 2026-08-10  
**Project:** Chaeboxi  
**Scope:** Architecture + research for agent tool(s) that "read" remote video URLs (not local uploads)  
**Status:** Consultation only — no implementation

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Research Methodology](#research-methodology)
3. [Codebase Context (Chaeboxi Today)](#codebase-context-chaeboxi-today)
4. [Key Findings](#key-findings)
5. [Comparative Analysis](#comparative-analysis)
6. [Architecture Recommendation](#architecture-recommendation)
7. [Implementation Plan (Phased)](#implementation-plan-phased)
8. [Risks & Mitigations](#risks--mitigations)
9. [Resources](#resources)
10. [Unresolved Questions](#unresolved-questions)

---

## Executive Summary

Chaeboxi already has a **local** video agent tool (`read_video`) that samples frames from user-uploaded `FILE_KEY` blobs. It does **not** handle remote platform URLs. Separately, `parse_link` scrapes generic web pages and is a poor fit for video platforms (captions live behind player/API layers, not static HTML).

For agents, **"read a video URL" almost always means text**: title, description, captions/transcript, timestamps — optionally plus a few keyframes. Full video download + re-encode is expensive, fragile, and ToS-sensitive.

**Product decision (2026-08-10 update):** Ship a **full product**, not YouTube-only MVP. All four platforms (YouTube, Vimeo, TikTok, Facebook) must work at launch with production UX, settings, errors, tests, and docs.

**Recommended strategy:** one agent tool + multi-backend waterfall (local/native adapters → BYOK multi-platform provider → optional desktop yt-dlp/STT → optional frames). Platform parity is a **product surface** guarantee; internal paths differ. Prefer reliability and ToS-safe defaults over fragile scrapers as the only path.

Brutal truth: Facebook and TikTok are harder than YouTube. Full product still ships them — via managed BYOK + STT fallback, not pretend-scrape equality.

---

## Research Methodology

- **Sources:** codebase scout + 4 web research clusters (YouTube transcripts, multi-platform tools, official platform APIs, legal/ToS)
- **Date range of materials:** ~2024–2026
- **Key search terms:** YouTube transcript API, yt-dlp, youtube-transcript-api, Vimeo text tracks, TikTok voice_to_text, Facebook Graph captions, social scraping legality, Supadata multi-platform

---

## Codebase Context (Chaeboxi Today)

| Capability | Location | What it does | Gap |
|---|---|---|---|
| `read_video` tool | `src/renderer/packages/model-calls/toolsets/video.ts` | Frame sample from **uploaded** blob `FILE_KEY` | No remote URLs |
| Frame extract | `src/renderer/packages/video/*` | HTML5 video → JPEG frames, budgets/limits | Needs local media |
| `web_search` / `parse_link` | `toolsets/web-search.ts` | Search + generic page parse | Weak on video players |
| Tool registration | `stream-text.ts` | Toolset merge + approvals | New toolset plugs here |
| Web-search providers | `packages/web-search/*` | Provider registry pattern | **Good template for video adapters** |
| Jina reader | `web-search/jina-reader.ts` | Markdown scrape via `r.jina.ai` | Metadata/description only for some pages |

**Implication:** Do not overload `read_video`. Add `read_video_url` (or `fetch_video_transcript` + `fetch_video_metadata`) that reuses storage/budgets only when frames are needed.

---

## Key Findings

### 1. What "read" means for agents

Priority for LLM usefulness (high → low):

1. **Transcript / captions** (timestamped segments preferred)
2. **Metadata** (title, channel/author, duration, publish date, description)
3. **Chapters / chapters-like timestamps**
4. **Audio STT fallback** when captions missing
5. **Sampled frames** (visual-only content, demos, product UI)
6. Full video file (almost never needed for chat agents)

### 2. Platform reality (2025–2026)

#### YouTube (easiest / highest ROI)

- Public captions often available via timedtext / open-source clients (`youtube-transcript-api` Python; many JS ports / managed APIs).
- Official **YouTube Data API v3** is strong for **metadata**; caption download is quota-heavy and often restricted for third-party videos.
- Common production pattern: **try captions first → else yt-dlp audio → Whisper/AssemblyAI**.
- Agent ecosystem standard: transcript-first tools and MCP servers.

#### Vimeo (official but owner-scoped for best data)

- Official **text tracks / transcript API** for videos you own (personal access token as account owner).
- **Vimeo AI API** can transcribe (async jobs) — account/product tier dependent.
- For arbitrary public URLs: oEmbed/public metadata yes; full transcript often **no** without auth or STT.

#### TikTok (hard)

- Research API exposes `voice_to_text` when present — access restricted (research/app approval).
- Unofficial scrapers break often; bot detection aggressive.
- Managed multi-platform APIs (e.g. Supadata-class) advertise TikTok + AI fallback.
- Visual + music-driven content → **frames + short STT** often better than "full transcript" expectation.

#### Facebook (hardest)

- Graph API `/{video-id}/captions` for videos you manage (Pages).
- Arbitrary public watch URLs: login walls, ToS hostility, brittle scrapers.
- Meta litigation history against scrapers increases product risk if Chaeboxi ships default FB downloaders.

### 3. Solution classes

| Approach | Pros | Cons | Fit for Chaeboxi |
|---|---|---|---|
| **A. Platform adapters + caption fetch** | Fast, cheap, text-native for agents | Breaks when platforms change; ToS gray for unofficial | Phase 1 core |
| **B. Official APIs only** | Cleanest compliance | Incomplete coverage; keys/oauth friction; FB/TikTok weak | Use where available |
| **C. Managed multi-platform API (BYOK)** | One integration, multi-source, AI fallback | Cost, vendor lock, privacy (URL leaves device) | Strong Phase 2+ option |
| **D. Desktop sidecar (yt-dlp + ffmpeg)** | Powerful offline/BYOK STT | Desktop-only; binary packaging; ToS/legal optics; maintenance | Optional advanced mode |
| **E. Download video → existing `read_video` frames** | Reuses vision path | Heavy; storage; slow; same legal issues as D | Opt-in advanced |
| **F. Overload `parse_link`** | Zero new UX | Wrong abstraction; unreliable | Reject |

### 4. Security & compliance

- Prefer **public URLs only**; never claim private content access.
- Scraping may violate platform ToS (civil risk). Courts treat public data scraping as nuanced; Meta has pursued scrapers. Product should:
  - Prefer official/oEmbed/caption endpoints
  - Label experimental scrapers clearly
  - Avoid DRM/circumvention tooling
  - Keep user-controlled BYOK for paid extractors
  - Minimize data retention of third-party video content
- Rate-limit and cache aggressively.
- Web build: **no local yt-dlp**; use HTTP APIs only.
- Desktop: sandbox sidecar, timeout, size caps, user permission for network extract.

### 5. Performance

- Caption fetch: typically <2s if public timedtext works.
- STT of long audio: minutes + cost; must be async-friendly or hard timeout with progress messaging.
- Frame extract from remote: dominated by download size — cap duration/bitrate.
- Agent context: default truncate transcript (e.g. 8–16k chars) with optional `startSec/endSec` window.

---

## Comparative Analysis

### For Chaeboxi specifically

| Criteria | Captions adapters | Managed API BYOK | yt-dlp desktop | Full official OAuth per platform |
|---|---|---|---|---|
| Time to ship YT | Days | Days | 1–2 weeks | Weeks |
| Multi-platform | Partial | Best | Good (yt-dlp extractors) | Poor for TikTok/FB |
| Local-first ethos | Good if client-side caption fetch | Weak (sends URL out) | Strong (desktop) | Medium |
| Maintenance | High (breaks) | Low | Medium (binary updates) | Medium |
| Legal risk | Medium | Vendor ToS | Medium–high | Lowest |
| Web + mobile | Yes | Yes | No | Yes |
| Cost | Free-ish | Per call | Free compute / STT cost | API quota |

**Decision framework:**

- Default product path: **captions + metadata adapters**, YouTube-first.
- Settings toggle: **optional BYOK multi-platform provider** (like web-search providers).
- Desktop power-user: optional **yt-dlp + local/remote STT** behind advanced setting.
- Do **not** make Facebook parity a v1 gate.

---

## Architecture Recommendation

### Systems design

```text
Agent tool: read_video_url(url, mode?, language?, maxChars?, startSec?, endSec?, includeFrames?)
        │
        ▼
┌───────────────────┐
│ VideoUrlRouter    │  host match → adapter
└─────────┬─────────┘
          │
    ┌─────┴──────┬──────────┬──────────┐
    ▼            ▼          ▼          ▼
 YouTube      Vimeo      TikTok    Facebook
 Adapter      Adapter    Adapter   Adapter
    │            │          │          │
    └─────┬──────┴──────────┴──────────┘
          ▼
   NormalizedResult {
     platform, url, videoId,
     title, author, durationSec, description,
     transcript: { source, language, segments[] } | null,
     warnings[], partial: boolean
   }
          │
          ├── if !transcript && STT enabled → SttFallback (audio URL or managed)
          ├── if includeFrames && allowed → download/stream sample → packages/video extract
          └── truncate → tool result (+ optional multimodal images)
```

### Component boundaries

| Module | Responsibility |
|---|---|
| `packages/video-url/` (new) | URL parse, adapters, normalize, cache, truncate |
| `model-calls/toolsets/video-url.ts` (new) | Agent tool schema + execute + toModelOutput |
| `web-search` / settings | Optional: shared provider key UI patterns for managed extractor |
| Tauri command (optional later) | `yt_dlp_extract` desktop sidecar |
| Existing `packages/video` | Only for frame path after local media available |

### Tool UX (KISS)

Prefer **one tool** for agents:

```text
read_video_url
  url: string
  prefer: 'transcript' | 'metadata' | 'frames' | 'auto'  // default auto
  language?: string
  maxChars?: number
  startSec?: number
  endSec?: number
  maxFrames?: number  // only if prefer frames/auto and vision available
```

Avoid 4 platform-specific tools (agent will misuse). Platform is an implementation detail.

### Technology guidance

1. **Router + adapters** — same pattern as `web-search` providers.
2. **YouTube captions:** JS caption client or small HTTP timedtext flow; fail soft.
3. **Metadata:** oEmbed + lightweight page/JSON parse where legal/stable.
4. **Managed provider interface:** `TranscriptProvider.fetch(url) → NormalizedResult` for Supadata-class / Firecrawl-class / AssemblyAI-class BYOK.
5. **STT fallback (later):** AssemblyAI / OpenAI Whisper / local Whisper — reuse BYOK keys from existing providers when possible.
6. **Do not** embed Python `youtube-transcript-api` in renderer; if needed, desktop sidecar or pure TS/HTTP.

### Scalability

- In-memory + storage cache keyed by `(platform, videoId, language, mode)`.
- Concurrency limit (1–2 extractions per session).
- Hard timeouts (e.g. 20s captions, 120s STT).
- Token budget: default truncate; return `truncated: true` + `nextWindow` hint.

---

## Implementation Plan (Phased)

### Phase 0 — Product decisions (0.5 day)

- Define success: "agent can summarize / quote / answer questions about a public video URL."
- Confirm platforms for v1: **YouTube required**; Vimeo/TikTok/Facebook = best-effort or deferred.
- Decide: BYOK managed provider in settings? Desktop yt-dlp allowed?
- Legal copy: user responsibility for URL rights; public content only.

### Phase 1 — Foundation + YouTube (MVP) (3–5 days)

**Build:**

- `packages/video-url/`: parse URL, detect platform, `NormalizedResult` types
- YouTube adapter: metadata + captions/auto-captions
- Tool `read_video_url` registered like other toolsets
- Truncation, language preference, error taxonomy (`NO_CAPTIONS`, `PRIVATE`, `UNSUPPORTED`, `RATE_LIMITED`)
- Unit tests: URL parse, normalize, truncate, mock adapter
- ToolCallPartUI display for transcript snippets

**Accept:**

- Public YT URL with captions → usable transcript in agent context
- No captions → clear error suggesting STT phase or user upload
- Does not break existing `read_video`

### Phase 2 — Vimeo + provider interface (2–4 days)

- Vimeo: public metadata; text tracks when available; else NO_CAPTIONS
- Pluggable `TranscriptBackend` for BYOK managed multi-platform API
- Settings: optional API key for "Video transcript provider"
- Integration tests with fixtures (recorded HTTP)

### Phase 3 — TikTok + Facebook degraded modes (3–6 days)

- TikTok: metadata/description; transcript only via managed backend or STT
- Facebook: Graph only if user provides token (advanced); else managed backend; else explicit unsupported
- Honest capability matrix in tool description so model does not hallucinate success

### Phase 4 — STT fallback (optional) (3–5 days)

- Audio extract path (desktop yt-dlp **or** provider that accepts URL)
- Whisper/AssemblyAI/OpenAI transcription with duration caps (e.g. max 30–60 min)
- Cost/time warnings in tool result

### Phase 5 — Frames from remote (optional) (2–4 days)

- After audio/video available locally (desktop) or short clip fetch, reuse `packages/video` extract-frames + budget
- Wire `prefer: frames` for visual demos

### Suggested ship order

```text
v1: Phase 0–1 (YouTube read_video_url)
v1.1: Phase 2 (Vimeo + BYOK backend)
v1.2: Phase 3 (TikTok/FB via backend only)
v1.3: Phase 4–5 power features (desktop STT/frames)
```

---

## Risks & Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Platform blocks / breaks scrapers | High | Adapter isolation; managed BYOK fallback; versioned fixtures |
| ToS / legal exposure shipping FB/TikTok scrapers | High | Default official/metadata; scrapers off or vendor-mediated |
| Agent floods context with 2h transcript | Medium | Default maxChars + windowing |
| STT cost surprise | Medium | Opt-in, duration cap, estimate in result |
| Web vs desktop capability split | Medium | Capability flags in tool description / settings |
| Confusing with local `read_video` | Low | Separate tool name + docs |
| Security: SSRF via URL tool | Medium | Allowlist hosts; block private IP ranges; size limits |

---

## Resources

### Official / platform

- [YouTube Data API](https://developers.google.com/youtube/v3)
- [Vimeo text tracks / transcripts](https://developer.vimeo.com/api/reference/videos)
- [Vimeo AI API (transcription)](https://help.vimeo.com/hc/en-us/articles/45762682270097-How-to-use-the-Vimeo-AI-API)
- [Facebook Graph Video / captions](https://developers.facebook.com/docs/graph-api/reference/video/)
- [TikTok Research Video Query (voice_to_text)](https://developers.tiktok.com/doc/research-api-specs-query-videos/)

### Ecosystem patterns

- [youtube-transcript-api (PyPI)](https://pypi.org/project/youtube-transcript-api/)
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) — audio/subs extraction pattern
- AssemblyAI / Whisper patterns for YT audio STT
- Multi-platform managed APIs (Supadata-class, Firecrawl agent video features) — evaluate as BYOK, not hard dependency

### Internal

- `src/renderer/packages/model-calls/toolsets/video.ts` — local frame tool
- `src/renderer/packages/model-calls/toolsets/web-search.ts` — tool + multi-provider pattern
- `src/renderer/packages/video/` — frame budgets/limits to reuse later

---

## Unresolved Questions

1. Is v1 success **transcript-only**, or must include **visual frames** for product demos?
2. Are TikTok/Facebook **must-have at launch**, or acceptable as Phase 3 behind managed API?
3. Is shipping **yt-dlp** in desktop builds acceptable to product/legal?
4. Should transcript extraction use **existing web-search provider keys** or a new settings section?
5. Privacy: may remote transcript providers receive the video URL (BYOK cloud)?
6. Language: auto-pick captions vs always English translation?
7. MCP exposure: also ship as MCP tool for external agents, or in-app tools only first?

---

## Next Actions

1. Answer Phase 0 questions (especially 1–3 above).
2. Spike YouTube captions in pure TS (no UI) — 1 day POC success rate on 20 public URLs.
3. Spike one managed multi-platform API for TikTok/FB feasibility (optional).
4. Write formal plan under `plans/` only after Phase 0 answers; then `/cook` implementation.

**Recommendation to proceed:** Approve **Phase 1 YouTube `read_video_url`** as the only committed scope; keep multi-platform as adapter interface with empty/degraded stubs.
