# Video URL Reader (Agent Tool)

**Date:** 2026-08-10  
**Tool name:** `read_video_url`  
**Settings:** Settings → Video URL (`/settings/video-url`)  
**Status:** Shipped (RC). Desktop yt-dlp extractor + rich remote frames are partial / deferred.

## Purpose

Let agents read **public** video links from YouTube, Vimeo, TikTok, and Facebook without uploading the file. Returns metadata + transcript when available.

| Use case | Tool |
|---|---|
| Public platform URL | `read_video_url` |
| Local / uploaded file (`FILE_KEY`) | `read_video` (frame sample) |
| Generic web page | `parse_link` / `web_search` (weak for video players) |

## Capability matrix

| Platform | Free path | With BYOK provider / STT / desktop extractor |
|---|---|---|
| YouTube | Metadata + captions/auto-captions | Provider / STT / yt-dlp fallback |
| Vimeo | Metadata + public text tracks if any | Provider / STT / yt-dlp |
| TikTok | Metadata (oEmbed) | **Provider or STT required** for transcript |
| Facebook | Best-effort OG metadata | **Provider or STT required** for transcript |

## Waterfall

1. Native platform adapter (captions/meta)  
2. BYOK multi-platform provider (`supadata` or **Custom HTTP**)  
3. Desktop extractor (optional yt-dlp IPC; **stub in RC**, off by default)  
4. STT (OpenAI Whisper) when media URL is available  

First successful transcript wins; metadata may still come from earlier steps. Results are cached briefly; long transcripts are truncated to the configured budget.

## Tool input

| Field | Type | Notes |
|---|---|---|
| `url` | string | Public `https://` video URL |
| `mode` | `auto` \| `transcript` \| `metadata` \| `frames` | Default `auto` |
| `language` | string? | Preferred caption language (e.g. `en`) |
| `maxChars` | int? | 500–50_000; default 12_000 |
| `startSec` / `endSec` | number? | Transcript time window |
| `maxFrames` | int? | 0–8; remote frames limited in RC |
| `includeTimestamps` | boolean? | Default true when segments exist |

Enablement: `extension.videoUrl.enabled` (default **on**) and model must support tool use. Registered in `stream-text` with the same approval wrapping as other toolsets.

## Settings (`extension.videoUrl`)

| Key | Default | Description |
|---|---|---|
| `enabled` | `true` | Master switch |
| `provider` | `none` | `none` \| `supadata` \| `custom` |
| `apiKey` / `customEndpoint` | empty | BYOK credentials |
| `sttProvider` | `none` | `none` \| `openai` (reuses OpenAI provider key if STT key empty) |
| `preferCaptions` | `true` | Prefer platform captions over STT |
| `maxTranscriptChars` | `12_000` | Soft truncate budget |
| `maxSttDurationSec` | `1800` | STT duration cap |
| `desktopExtractorEnabled` | `false` | Desktop only; user-installed yt-dlp |
| `desktopExtractorPath` | empty | Optional binary path |

**yt-dlp install UX (desktop settings):** Settings → Video URL → Desktop extractor can **detect** yt-dlp (badge: Installed + version / Not installed), **install** via Homebrew (Mac), winget (Windows), or pipx (Linux) with progress, and re-**check** after install. If the package manager is missing (e.g. no Homebrew), the UI links to install it or the full yt-dlp guide. Does not bundle the binary.

### Custom HTTP contract

`POST` endpoint with `{ "url", "language?", "mode?" }`  
Response: `{ "transcript"|"text"|"segments", "title?", "author?", ... }`

## Errors (structured)

Tool returns `errorCode` + `errorMessage` (secrets scrubbed). Common codes:

`UNSUPPORTED_URL` · `PRIVATE_OR_UNAVAILABLE` · `NO_CAPTIONS` · `PROVIDER_REQUIRED` · `PROVIDER_FAILED` · `STT_FAILED` · `RATE_LIMITED` · `TIMEOUT` · `SSRF_BLOCKED` · `BUDGET_EXCEEDED` · `NETWORK_ERROR`

**Timeouts:** Desktop `http:request` cannot cancel mid-flight, but the video reader races AbortSignal + hard timers (per request ~12s, full waterfall ~60s, tool ~70s) so agent turns finish with `TIMEOUT` instead of spinning forever.

## Security

- Host allowlist for the four platforms only  
- Blocks localhost / private IPs (primary URL + caption tracks + custom endpoint + STT audio)  
- Public URLs only; no login bypass / DRM  
- API keys never returned in tool results (error text scrubbed)  

## Web vs desktop

Browser free-path scrapes may hit **CORS** limits. Desktop/app shells and BYOK providers are more reliable for captions. Capability matrix in settings notes this.

## Limitations (RC)

- Desktop extractor IPC is a **stub**; real `extractVideoUrl` / yt-dlp wiring deferred  
- Remote multi-frame sampling is limited (prefer local `read_video` for vision)  
- TikTok / Facebook transcripts generally need provider or STT  

## Related code

| Area | Path |
|---|---|
| Package | `src/renderer/packages/video-url/` (parse, guards, adapters, providers, STT, orchestrator) |
| Agent tool | `src/renderer/packages/model-calls/toolsets/video-url.ts` |
| Registration | `src/renderer/packages/model-calls/stream-text.ts` |
| Display name | `src/renderer/packages/tools/index.ts` (`read_video_url`) |
| Settings UI | `src/renderer/routes/settings/video-url.tsx` |
| Schema / defaults | `src/shared/types/settings.ts`, `src/shared/defaults.ts` |
| Local video (contrast) | `src/renderer/packages/model-calls/toolsets/video.ts`, `packages/video/` |

## See also

- Research notes: `claudedocs/research-agent-video-url-reader-2026-08-10.md`  
- Plan / reports: `plans/2026-08-10-agent-video-url-reader/`  
- Team rooms (when tools run): [agents-multi-agent-rooms.md](./agents-multi-agent-rooms.md)  
- Tool lifecycle hooks: [hooks-and-commands.md](./hooks-and-commands.md)  
