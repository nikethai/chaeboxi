## Code Review Summary

### Scope
- Files reviewed:
  - `src/renderer/packages/video-url/**` (new)
  - `src/renderer/packages/model-calls/toolsets/video-url.ts` (new)
  - `src/renderer/routes/settings/video-url.tsx` (new)
  - `src/renderer/packages/model-calls/stream-text.ts` (+ tests)
  - `src/shared/types/settings.ts`, `src/shared/defaults.ts`
  - `src/renderer/components/message-parts/ToolCallPartUI.tsx`
  - `src/renderer/packages/tools/index.ts`, settings nav
  - `docs/video-url-reader.md`
- Lines of code analyzed: ~2.8k (package + tool + settings UI + wiring)
- Review focus: Agent Video URL Reader — SSRF, secrets, error handling, registration, completeness
- Updated plans: `plans/2026-08-10-agent-video-url-reader/plan.md`

### Overall Assessment
Solid RC architecture: host allowlist + private-IP guards, waterfall (native → BYOK → desktop → STT), structured errors, settings UI, ToolCallPartUI, unit tests. Typecheck clean; full suite 1212 pass. Not auto-approve: residual SSRF on secondary fetches, web free-path CORS risk, Gate 4 frames/desktop stub, cache/transient-error policy, biome format debt.

**Score: 8.4/10 · Critical: 0 · Auto-approve: NO** (needs ≥9.5 and 0 critical)

---

### Critical Issues
None (no secret-in-tool-output confirmed; primary agent URL SSRF allowlisted; no crash/data-loss bugs found).

---

### High Priority Findings

1. **Web free-path likely broken by CORS**  
   YouTube/Vimeo/Facebook free adapters use renderer `ofetch` to third-party origins. Web build will hit browser CORS; `parse_link` avoids this via `remote.parseUserLinkFree`. Plan acceptance: “Web works without yt-dlp.”  
   **Impact:** Web users get NETWORK_ERROR for free YT captions unless BYOK provider used.  
   **Fix:** Route platform scrapes through Tauri `http_request` / existing remote proxy on web; document matrix if web free path deferred.

2. **Secondary fetch URLs not re-validated (defense-in-depth SSRF)**  
   - YouTube caption `track.baseUrl` fetched as-is  
   - Vimeo text-track URLs fetched after soft prefix join  
   - STT `fetchArrayBuffer(audioUrl)` trusts desktop extractor only today  
   Primary `guardVideoUrl` is good; poisoned/unexpected secondary hosts not re-checked.  
   **Fix:** Allowlist host suffixes (`youtube.com`, `googlevideo.com`, `ytimg.com`, `vimeo.com`, `vimeocdn.com`, …) before any secondary `fetchText`/`fetchArrayBuffer`.

3. **Custom HTTP endpoint has no SSRF/private-IP guard**  
   User-configured `customEndpoint` + Test connection POSTs anywhere (incl. localhost / metadata IPs) with optional Bearer key. BYOK intentional, but settings-sync or shared configs amplify risk.  
   **Fix:** Reuse private-IP / blocked-host checks on `customEndpoint` (and optional user confirm for non-HTTPS).

---

### Medium Priority Improvements

4. **`stripSecrets` is a no-op**  
   `toolsets/video-url.ts` returns `{ ...result }` only. Keys never placed on `NormalizedVideoRead` (good), but ofetch error strings / future fields lack redaction.  
   **Fix:** Explicit omit + scrub `errorMessage` for `api[_-]?key|bearer|authorization` patterns.

5. **Transient failures cached 15m**  
   `setCachedVideoRead` skips PROVIDER_REQUIRED / TIMEOUT / NETWORK_ERROR but **caches** PROVIDER_FAILED, RATE_LIMITED, STT_FAILED, NO_CAPTIONS.  
   **Fix:** Also skip RATE_LIMITED / PROVIDER_FAILED / STT_FAILED; shorter TTL for partial failures.

6. **Gate 4 partial vs plan ship bar**  
   Desktop extractor = IPC stub with honest error; `mode=frames` only warns + thumbnail note. Documented in implementation-summary — product incomplete for “frames in v1” plan decision.

7. **No max response body size**  
   Security checklist: timeouts ✓, max response size ✗. YouTube HTML brace scan up to 2MB; unbounded `fetchText` for pages/tracks.

8. **Disabled tool uses `PROVIDER_REQUIRED`**  
   Misleading error code when `enabled: false`. Prefer dedicated code or clearer message-only mapping.

9. **Biome not clean on new files**  
   Import sort, format, `noNonNullAssertion`, `noAssignInExpressions` (youtube XML loop), `useExhaustiveDependencies` (settings capability memo). Run `biome check --write` on package before merge.

10. **Files >200 LOC** (project modularization rule)  
    `orchestrator.ts` ~335, `youtube.ts` ~284, settings page ~326. Split waterfall steps / caption parsers when next touched.

---

### Low Priority Suggestions

- IPv6 block heuristic incomplete (`fe80`, v4-mapped); mitigated by platform host allowlist for agent input.
- HTTP (non-HTTPS) allowed for platform URLs — prefer HTTPS-only or warn.
- Global concurrency cap (plan: 1–2 in flight) not implemented beyond same-key inflight dedupe.
- No i18n catalog entries for new settings strings (English fallback via `t()` keys).
- Supadata chunk time unit heuristic (`> 1000`) is brittle.
- `enabled !== false` default-on expands tool surface for all tool-capable models — intentional per plan, watch prompt bloat.

---

### Positive Observations

- Clear separation: parse → guard → cache → waterfall → truncate.
- Host allowlist + localhost/private IPv4/CGNAT/metadata host blocks with tests.
- Honest TT/FB `PROVIDER_REQUIRED` + dynamic capability summary in tool description.
- API keys only in headers (Supadata `x-api-key`, custom Bearer, Whisper Bearer); not in query/tool result fields.
- Schema + defaults + settings nav + ToolCallPartUI + display name wiring complete.
- `stream-text` registration independent of local `read_video` attachments; tests mocked correctly.
- Truncation + time windows + maxChars clamps well tested.
- Docs (`docs/video-url-reader.md`) match architecture.

---

### Recommended Actions
1. **Before merge (High):** Document or fix web CORS free path; add secondary-URL host allowlist helper used by YT captions + Vimeo tracks + STT download.
2. Guard `customEndpoint` with same private-host rules as `guardVideoUrl`.
3. Fix cache skip list for transient provider/STT failures; implement real `stripSecrets` / error scrub.
4. `biome check --write` on new package + format-touched files.
5. Follow-ups OK post-merge: Tauri `extractVideoUrl`, real remote frames, live optional integration tests.

### Metrics
- Type Coverage: `pnpm check` clean (tsc --noEmit)
- Test Coverage: video-url unit tests present; full suite **1212 passed** / 73 skipped / 2 todo
- Linting Issues: ~20 biome errors on new package (mostly format/import sort) + several style warnings
- Security: primary SSRF OK; secondary SSRF / custom endpoint residual

### Unresolved questions
1. Is web free-path (no BYOK) a hard release requirement, or desktop-first acceptable for RC?
2. Should custom endpoints allow private IPs for power users (local transcript servers)?
3. Confirm Supadata response contract vs production API (chunk units / fields) with live key.

---

**Status:** DONE_WITH_CONCERNS  
**Summary:** Feature is well-structured RC with strong primary SSRF guards and no secret leakage in tool results; hold auto-approve for web CORS risk, secondary-fetch allowlist, and Gate 4 stubs.  
**Score:** 8.4/10  
**Critical:** 0  
**Auto-approve:** NO  
