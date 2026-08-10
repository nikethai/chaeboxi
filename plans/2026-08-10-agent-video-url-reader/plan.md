---
title: Agent Video URL Reader
description: Production agent tool to read public video URLs (YT/Vimeo/TikTok/Facebook) with captions, BYOK provider, STT, settings, and frames.
status: completed
priority: high
effort: 3-4 weeks
branch: main
tags:
  - agent-tools
  - video-url
  - byok
  - stt
created: 2026-08-10
---

# Plan: Agent Video URL Reader (Full Product)

**Status:** IMPLEMENTED (RC) — re-review DONE_WITH_CONCERNS (9.2/10, 0 critical, not auto-approve)  
**Plan lifecycle:** `completed` (RC ship bar met; auto-approve follow-ups open)  
**Date:** 2026-08-10  
**Product bar:** Full ship — YouTube, Vimeo, TikTok, Facebook  
**Research:** `claudedocs/research-agent-video-url-reader-2026-08-10.md`  
**Docs:** `docs/video-url-reader.md`  
**Gate 0 ADR:** `plans/2026-08-10-agent-video-url-reader/reports/gate-0-provider-adr.md`  
**Code review:** `plans/2026-08-10-agent-video-url-reader/reports/code-review-2026-08-10.md`  
**Re-review:** `plans/2026-08-10-agent-video-url-reader/reports/code-review-2026-08-10-rereview.md`  
**Implementation report:** `plans/2026-08-10-agent-video-url-reader/reports/implementation-summary.md`  
**Status closeout:** `plans/2026-08-10-agent-video-url-reader/reports/plan-status-2026-08-10.md`

### Review follow-ups (auto-approve ≥9.5)

| Priority | Item | Status |
|---|---|---|
| High | Web free-path CORS (proxy or document matrix) | Done (docs + capability note) |
| High | Secondary URL private-IP guard (captions/tracks/STT) | Done (`assertSafeHttpUrl`) |
| High | Custom endpoint private-IP (agent provider path) | Done (`custom-http.ts`) |
| Medium | Real `stripSecrets` + cache skip transient fails | Done |
| Medium | Biome format/import-sort on `packages/video-url` | Open (9 errors) |
| Medium | Settings Test connection uses `assertSafeHttpUrl` | Open |
| Low | Host-suffix allowlist; max body size; disabled error code | Open |
| Low | Gate 4: real desktop IPC + remote frames | Deferred |

### Gate completion (RC)

| Gate | Status | Exit criteria met? | Notes |
|---|---|---|---|
| 0 Provider bake-off | **Done** | Yes | Custom HTTP + Supadata; STT OpenAI reuse |
| 1 Core + YouTube + tool | **Done** | Yes | `packages/video-url`, `read_video_url`, stream-text |
| 2 Vimeo + BYOK + settings UI | **Done** | Yes | adapters + settings page + provider registry |
| 3 TikTok/FB + STT | **Done** | Yes | `PROVIDER_REQUIRED` path + STT module |
| 4 Desktop + frames | **Partial** | Partial | Desktop extractor IPC **stub**; frames warn + thumbnail note only |
| 5 Polish + QA + docs | **Done** | Yes | ToolCallPartUI, tests (1212 pass), docs, SSRF guards |

**RC decision:** Accept gate 4 partial for RC. Real Tauri `extractVideoUrl` / yt-dlp + rich multi-frame sampling deferred (documented, non-blocking).

### Review follow-ups (blocking for auto-approve ≥9.5 — post-RC)

| Priority | Item | Status |
|---|---|---|
| High | Web free-path CORS (proxy or document matrix) | Open |
| High | Secondary URL host allowlist (captions/tracks/STT media) | Open |
| High | Custom endpoint private-IP / SSRF guard | Open |
| Medium | Real `stripSecrets` + error scrub; cache skip transient fails | Open |
| Medium | Biome format/import-sort on `packages/video-url` | Open |
| Low | Gate 4: real desktop IPC + remote frames | Deferred (documented) |

---

## 1. Goal

Ship a production **agent tool** so Chaeboxi agents can **read public video URLs** from YouTube, Vimeo, TikTok, and Facebook: metadata + transcript (captions or STT), optional frames, with settings, UI, caching, tests, and honest errors.

**Not in scope:** private/login-gated content, DRM bypass, bulk channel scraping, replacing local upload `read_video`.

---

## 2. Product decisions (locked for this plan)

| Decision | Choice |
|---|---|
| Platforms at launch | YouTube, Vimeo, TikTok, Facebook |
| Tool model | One tool: `read_video_url` (separate from local `read_video`) |
| Free/default path | Native captions/meta where reliable (YT strong; Vimeo partial) |
| Multi-platform reliability | BYOK multi-platform provider **required for pro TT/FB** |
| STT fallback | In v1 (BYOK Whisper/OpenAI/AssemblyAI-class via existing or new keys) |
| Desktop yt-dlp | Optional desktop toggle; not required for web |
| Frames from remote | In v1, gated by mode + budget |
| Web / desktop / mobile | Web+desktop full; mobile best-effort (HTTP paths only) |
| Legal posture | Public URLs only; user responsibility; no login bypass |

---

## 3. Architecture

```text
Agent  →  read_video_url tool
              │
              ▼
       VideoUrlService (orchestrator)
         parse URL · SSRF guard · cache · budget · truncate
              │
              ▼
       Waterfall (first success wins for transcript)
         1. Platform native adapter (YT captions, Vimeo tracks/meta, …)
         2. BYOK multi-platform provider (TT/FB primary; all platforms backup)
         3. Desktop extractor (yt-dlp) + STT  [desktop, if enabled]
         4. URL-to-STT via provider  [if audio/transcript API supports URL]
              │
              ├── mode metadata|transcript|auto → text result
              └── mode frames|auto + maxFrames → optional media → packages/video frames
```

### Normalized contract

```ts
type NormalizedVideoRead = {
  platform: 'youtube' | 'vimeo' | 'tiktok' | 'facebook' | 'unknown'
  url: string
  videoId?: string
  title?: string
  author?: string
  durationSec?: number
  description?: string
  thumbnailUrl?: string
  transcript?: {
    source: 'captions' | 'provider' | 'stt'
    language?: string
    text: string
    segments?: Array<{ startSec: number; endSec?: number; text: string }>
  } | null
  frames?: Array<{ timestampSec: number; storageKey: string; width: number; height: number }>
  warnings: string[]
  partial: boolean
  errorCode?:
    | 'UNSUPPORTED_URL'
    | 'PRIVATE_OR_UNAVAILABLE'
    | 'NO_CAPTIONS'
    | 'PROVIDER_REQUIRED'
    | 'PROVIDER_FAILED'
    | 'STT_FAILED'
    | 'RATE_LIMITED'
    | 'TIMEOUT'
    | 'SSRF_BLOCKED'
    | 'BUDGET_EXCEEDED'
}
```

### Capability matrix (ship bar)

| Platform | Metadata | Transcript free path | Transcript pro path | Frames |
|---|---|---|---|---|
| YouTube | Yes | Captions/auto-captions | Provider / STT / yt-dlp | Desktop+provider media |
| Vimeo | Yes | Public text tracks if any | Provider / STT / yt-dlp | Same |
| TikTok | Yes (best-effort) | Weak/none alone | **Provider + STT required** | Same |
| Facebook | Yes (best-effort) | Weak/none alone | **Provider + STT required** | Same |

If provider+STT not configured and free path fails → structured `PROVIDER_REQUIRED` with settings CTA (not silent failure).

---

## 4. Tool API

```text
read_video_url
  url: string (required)
  mode?: 'auto' | 'transcript' | 'metadata' | 'frames'   // default auto
  language?: string
  maxChars?: number          // default 12000, clamp 500–50000
  startSec?: number
  endSec?: number
  maxFrames?: number         // 0–8, budgeted
  includeTimestamps?: boolean // default true
```

**Enablement:** When `extension.videoUrl.enabled` and model supports tool use.  
Unlike local `read_video`, **do not require a video attachment** — enable on web-browsing sessions and/or always when setting enabled (prefer: **always when enabled + tool-capable model**, so agent can open links without web-browse toggle).

**toModelOutput:** text summary + optional image frames (same pattern as `read_video`).

---

## 5. Settings

Extend `ExtensionSettingsSchema` in `src/shared/types/settings.ts`:

```ts
videoUrl: {
  enabled: boolean                    // default true
  provider: 'none' | 'supadata' | 'custom' | …  // lock vendor after bake-off
  apiKey?: string
  customEndpoint?: string             // Custom HTTP webhook
  sttProvider: 'none' | 'openai' | 'assemblyai' | …
  sttApiKey?: string                  // or reuse provider keys where applicable
  preferCaptions: boolean             // default true
  maxTranscriptChars: number          // default 12000
  maxSttDurationSec: number           // default 1800 (30m)
  desktopExtractorEnabled: boolean    // default false
  desktopExtractorPath?: string       // optional yt-dlp path
}
```

**UI:** new route `src/renderer/routes/settings/video-url.tsx` (mirror `web-search.tsx`):

- Enable toggle  
- Provider select + API key + Test connection  
- STT select + key  
- Caps (max chars, max STT duration)  
- Desktop extractor toggle + path (desktop only)  
- Privacy / public-URL notice  
- Capability table (what works with current config)

Register in settings nav (`settings/route.tsx` / index).

---

## 6. Module layout

```text
src/renderer/packages/video-url/
  index.ts
  types.ts
  parse-url.ts              # host → platform + videoId
  parse-url.test.ts
  guards.ts                 # allowlist hosts, block private IPs
  guards.test.ts
  cache.ts                  # session + short TTL
  truncate.ts
  truncate.test.ts
  orchestrator.ts           # waterfall
  orchestrator.test.ts
  adapters/
    types.ts
    youtube.ts
    youtube.test.ts
    vimeo.ts
    tiktok.ts
    facebook.ts
  providers/
    types.ts
    registry.ts
    custom-http.ts
    <chosen-vendor>.ts      # after bake-off
  stt/
    fallback.ts
  desktop/
    extractor.ts            # platform IPC wrapper

src/renderer/packages/model-calls/toolsets/video-url.ts
src/renderer/routes/settings/video-url.tsx

src-tauri/src/…             # optional: yt_dlp_extract command (desktop)
src/renderer/platform/…     # expose extractor on DesktopPlatform only
```

---

## 7. Files to modify (existing)

| File | Change |
|---|---|
| `src/shared/types/settings.ts` | `videoUrl` extension schema + defaults |
| `src/renderer/packages/model-calls/stream-text.ts` | Register toolset + instructions when enabled |
| `src/renderer/packages/tools/index.ts` | `read_video_url` display name |
| `src/renderer/components/message-parts/ToolCallPartUI.tsx` | Icon, summary, result renderer |
| Settings nav / route tree | Link to video-url settings |
| i18n locales (as project requires) | Labels for tool + settings |
| `docs/` (if user-facing tools documented) | Capability matrix + setup |
| Tests mocking toolsets | Mock new toolset where other toolsets mocked |

**Do not change** local `toolsets/video.ts` behavior except clarifying docs that it is upload-only.

---

## 8. Implementation phases (one release, sequential gates)

Phases are **release gates**, not “ship YT only.” All platforms are in the release. Some gates can run in parallel after Gate 0.

### Gate 0 — Provider bake-off + schema freeze (1–2 days)

**Do:**

- Evaluate ≥2 multi-platform transcript APIs (coverage YT/TT/FB/Vimeo, pricing, ToS, latency)
- Lock primary provider + Custom HTTP JSON schema
- Freeze `NormalizedVideoRead` + error codes
- Draft privacy copy

**Exit:** ADR snippet in plan reports: chosen provider + fallback Custom HTTP.

### Gate 1 — Core + YouTube + tool skeleton (3–4 days)

**Do:**

- `packages/video-url` skeleton: parse, guards, cache, truncate, orchestrator
- YouTube adapter: metadata + captions/auto-captions
- `read_video_url` toolset + `stream-text` registration
- Settings schema (enabled + provider stubs)
- Unit tests: parse-url, guards, truncate, youtube adapter (fixtures)

**Exit:** Agent can summarize a public captioned YouTube URL without BYOK.

### Gate 2 — Vimeo + BYOK provider + settings UI (3–4 days)

**Do:**

- Vimeo adapter (oEmbed/meta + public tracks when available)
- Provider client(s) + registry
- Settings page (keys, test button)
- Orchestrator: native → provider waterfall
- Integration tests with recorded HTTP fixtures

**Exit:** YT + Vimeo work free path; any platform works when provider key set.

### Gate 3 — TikTok + Facebook product path + STT (3–4 days)

**Do:**

- TikTok/Facebook adapters: metadata best-effort + always try provider
- STT fallback module (duration caps, clear cost/timeout errors)
- `PROVIDER_REQUIRED` UX when TT/FB and no key/STT
- Tool description documents capability matrix dynamically from settings

**Exit:** All 4 platforms return usable transcript or actionable error.

### Gate 4 — Desktop extractor + frames (2–4 days)

**Do:**

- Desktop: optional yt-dlp path (user-installed or documented); Tauri command if needed
- Wire extractor → audio/subs → STT/captions
- Remote frames path: obtain short media or provider thumbnails/frames → reuse `packages/video` budget
- `mode=frames` / `auto` frame sampling limits

**Exit:** Desktop power path works; frames mode works at least for YT desktop and wherever media available.

### Gate 5 — Product polish + QA + docs (2–3 days)

**Do:**

- ToolCallPartUI: platform, title, source badge, expandable transcript, errors
- Rate limits, concurrency (1–2 in flight), timeouts
- Cache invalidation / TTL
- Fixture suite: sample public URLs per platform (CI-safe mocks; live optional)
- Docs: settings guide + capability matrix web vs desktop
- Security review: SSRF, key logging, no secret in tool results

**Exit:** RC checklist green (section 10).

---

## 9. Parallelization map

```text
Gate 0 ──► Gate 1 ──► Gate 2 ──► Gate 3 ──► Gate 4 ──► Gate 5
              │          │          │          │
              │          ├─ UI settings (with Gate 2)
              │          └─ provider client
              └─ ToolCallPartUI basic (can start Gate 1)
```

Safe parallel after Gate 1:

- Settings UI + provider client  
- ToolCallPartUI  
- Fixture recording  
- Desktop IPC spike (merge Gate 4)

Avoid parallel edits to: `stream-text.ts`, `settings.ts` schema (serialize those).

---

## 10. Release acceptance checklist

**RC status (2026-08-10):** Core checklist met for gates 0–3 + 5. Gate 4 partial (desktop stub / frames limited). Review follow-ups remain open for merge hardening.

### Functional

- [x] YouTube public + captions → transcript + meta  
- [x] YouTube no captions → STT or clear configure path  
- [x] Vimeo public → meta; transcript when tracks/provider/STT  
- [x] TikTok public → meta + transcript via provider/STT  
- [x] Facebook public → meta + transcript via provider/STT  
- [x] Private/deleted → structured error, no crash  
- [x] Truncation + time window (`startSec`/`endSec`)  
- [x] Frames mode respects budget; does not break local `read_video` *(frames limited: warn + thumbnail note)*  
- [x] Web works without yt-dlp  
- [ ] Desktop optional extractor works when enabled *(partial: IPC stub only — deferred)*  

### Product

- [x] Settings persist; keys never logged or returned in tool output *(harden stripSecrets post-RC)*  
- [x] Tool result CTA when provider missing for TT/FB  
- [x] Tool names i18n + UI card  
- [x] Docs/capability matrix  

### Quality

- [x] Unit tests for parse/guards/truncate/orchestrator/adapters  
- [x] Fixture-based provider tests  
- [x] `pnpm test` for touched packages green *(1212 passed)*  
- [ ] `pnpm check` / lint on touched files *(biome format open on packages/video-url)*  

### Security

- [x] Host allowlist (youtube, youtu.be, vimeo, tiktok, facebook/fb.watch variants)  
- [x] Block localhost / private IP / non-https (except allowlisted schemes if any)  
- [x] Timeouts + max response size  
- [ ] Secondary fetch host re-validation + custom endpoint SSRF *(open post-RC)*  

---

## 11. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Platform scrapers break | Provider primary for TT/FB; native YT isolated adapter |
| Vendor lock-in | Custom HTTP provider + interface |
| Legal/ToS | Public only; BYOK vendor; no login bypass; user notice |
| Huge transcripts | Default maxChars + windows |
| STT cost surprise | Caps, prefer captions, show source in result |
| SSRF | Allowlist + IP checks |
| Web/desktop confusion | Capability matrix in settings + tool description |

---

## 12. Effort estimate

| Gate | Calendar (solo) | Parallel team |
|---|---|---|
| 0 | 1–2 d | 1–2 d |
| 1 | 3–4 d | 2–3 d |
| 2 | 3–4 d | 2–3 d |
| 3 | 3–4 d | 2–3 d |
| 4 | 2–4 d | 2 d |
| 5 | 2–3 d | 2 d |
| **Total** | **~3–4 weeks** | **~2–3 weeks to RC** |

---

## 13. Out of scope (explicit)

- Instagram / X / Bilibili (adapter interface can extend later)  
- Auto-download full library / playlists  
- Knowledge-base auto-ingest of transcripts (follow-up)  
- MCP server export of this tool (follow-up)  
- Changing local upload video UX  

---

## 14. Implementation order when approved

1. Gate 0 bake-off (or skip if user pre-selects vendor)  
2. Gate 1 core + YT + tool  
3. Gate 2 Vimeo + provider + settings  
4. Gate 3 TT/FB + STT  
5. Gate 4 desktop + frames  
6. Gate 5 polish + QA  
7. Optional: copy plan into `plans/2026-08-10-agent-video-url-reader/` for repo history  

---

## 15. Open items (resolve at Gate 0, not blockers for plan approval)

1. **Primary BYOK vendor** — pick during bake-off (Supadata-class vs Firecrawl-class vs other)  
2. **STT key reuse** — new `sttApiKey` vs reuse OpenAI/AssemblyAI already in provider settings  
3. **Default `enabled`** — `true` (discoverable) vs `false` (opt-in) — plan assumes `true` with safe free YT path  
4. **Exact Facebook URL patterns** supported at launch (watch, reel, share redirects)

---

## 16. Success metric

> User pastes a public YT/Vimeo/TikTok/Facebook URL → agent answers content questions correctly from transcript/meta without the user uploading the file; failures are rare and actionable.
