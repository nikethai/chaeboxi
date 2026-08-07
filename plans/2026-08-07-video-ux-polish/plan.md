# Plan: Video Feature UI/UX Polish

**Status:** phase 01–03 implemented  
**Date:** 2026-08-07  
**Repo:** chaeboxi  
**Depends on:** AI video read + upload (already shipped)  
**After approval:** copy to `plans/2026-08-07-video-ux-polish/` (plan.md + phase files)

---

## Goal

Make the **video attachment journey feel first-class** — quiet studio media lane (poster, duration, honest progress, thread tile, `read_video` filmstrip) without breaking Chaeboxi design contract (dark-first, no gradients, quiet tools, layered shadows).

---

## Locked product decisions (unresolved questions resolved)

| # | Decision | Why (best default) |
|---|----------|---------------------|
| 1 | **Playback:** In-app **VideoPlayer modal** (`AdaptiveModal` + native `<video controls playsInline>`) on desktop **and** mobile | Keeps user in chat; works offline on stored blobs; consistent UX. OS open is not primary (optional later fallback only if codec fails). |
| 2 | **Frame filmstrip:** Only for **`read_video` tool steps** when expanded | Auto frames on send stay under the hood. Avoids cluttering every video message. Matches quiet tools guideline. |
| 3 | **Non-vision models:** **Allow attach** + soft non-blocking banner under chips | User can switch model before send. Hard-block is hostile. Frame inject still vision-gated (existing engine). |
| 4 | **Ship scope:** **Phase 01 + 02** together; Phase 03 delight optional later | Highest ROI without gold-plating. |
| 5 | **Visual system:** Extend existing chip / tool patterns only | Design-guidelines tokens; CSS motion only (no new motion library). |
| 6 | **Reduced motion:** Opacity-only when `prefers-reduced-motion` | Accessibility gate. |

---

## Out of scope

- Video trim / scrub editor / ffmpeg UI
- Settings UI for limits
- User-message auto-frame filmstrip (Phase 03)
- Audio / captions
- Full redesign of image/PDF attachment chrome (shared chip polish only where it benefits video)

---

## Current friction (baseline)

| Stage | Today | Problem |
|-------|-------|---------|
| Composer chip | Poster + duration; spinner + duration both bottom-left | Collision |
| Delete | Hover-only opacity 0 | Mobile-hostile |
| Send | Blocks on frame enrich with only generic submitting | Silent freeze feel |
| Thread | Document row → content-viewer | No media identity; wrong open target |
| `read_video` | GeneralToolCallUI JSON | Magic invisible |
| Non-vision | Toast near send | Late; no soft pre-send cue |

---

## Phase 01 — Composer honesty + thread media

### Deliverables

1. **Video chip layout** (`Attachments.tsx` / `FileMiniCard` video branch)
   - Duration badge: bottom-**right**
   - Status: processing spinner/shimmer **not** same corner as duration (top-left or edge)
   - Success check optional; fade out ~1.2s
   - Delete: min 40×40 hit; always visible on small screen / coarse pointer; hover-reveal on fine desktop pointer
   - Keep concentric radius + pure black/white 10% image outline
   - Prefer `isVideo` branch in existing file (DRY) — not a third attachment system

2. **Send-time sampling progress** (`InputBox.tsx`)
   - Substate while `enrichUserMessageWithVideoFrames` runs
   - Send control: disabled + spinner; label/tooltip **Sampling video frames…**
   - Optional one-line status under chips
   - Double-submit blocked; on fail re-enable + existing toast
   - No fake % unless extract API gains real progress later

3. **Thread media tile** (`MessageAttachmentGrid` + `MessageAttachment`)
   - When `mediaKind === 'video'`: poster + duration + filename + size
   - Click → VideoPlayer modal (not content-viewer)
   - Documents/links unchanged

4. **VideoPlayer modal** (new)
   - `src/renderer/modals/VideoPlayer.tsx` + register in `modals/index.tsx`
   - `AdaptiveModal` + load blob → `URL.createObjectURL` → `<video controls playsInline>`
   - `revokeObjectURL` on close/unmount
   - Title = filename; load error state; Escape closes

5. **i18n** — EN keys for sampling / player errors

### Files (Phase 01)

| Path | Action |
|------|--------|
| `src/renderer/components/InputBox/Attachments.tsx` | Chip layout + message video branch |
| `src/renderer/components/InputBox/InputBox.tsx` | Sampling UI state |
| `src/renderer/components/chat/MessageAttachmentGrid.tsx` | Pass `mediaKind`, `posterStorageKey`, `durationSec` |
| `src/renderer/modals/VideoPlayer.tsx` | Create |
| `src/renderer/modals/index.tsx` | Register |
| `src/renderer/static/globals.css` | Shimmer / reduced-motion helpers if needed |
| `src/renderer/i18n/locales/en/translation.json` | Strings |

### Acceptance (Phase 01)

- Attach → poster + duration, no collision; delete works on touch
- Send with video shows Sampling…; no double-send
- Thread shows media tile; tap plays in-app

---

## Phase 02 — `read_video` tool UI + vision soft banner

### Deliverables

1. **Specialized tool step** (`ToolCallPartUI.tsx`)
   - Zod-parse result like web_search; fail → GeneralToolCallUI
   - Collapsed: `N frames · t0–t1` / Running… / Failed
   - Expanded: horizontal filmstrip (`ImageInStorage` on frame `storageKey`) + tabular timestamps; optional remaining budget mono line
   - Technical details remain under existing disclosure
   - `toolIconFor('read_video')` film/video icon
   - `getToolName`: **Read Video** (i18n)
   - Filmstrip stagger 30–50ms; reduced-motion off
   - **No** auto-send frame strip in this UI (decision #2)

2. **Soft non-vision banner** (`InputBox.tsx`)
   - Show when ≥1 OK video attachment **and** current model is non-vision
   - Quiet tertiary + small alert icon under chips
   - Copy: *This model can’t see video frames. Switch to a vision model to analyze them.*
   - Attach still allowed; optional local dismiss
   - Optional: dedupe with send toast if banner already visible

3. **Tools display map** (`packages/tools/index.ts`)

### Files (Phase 02)

| Path | Action |
|------|--------|
| `src/renderer/components/message-parts/ToolCallPartUI.tsx` | ReadVideoToolCallUI + router |
| `src/renderer/packages/tools/index.ts` | Display name |
| `src/renderer/components/InputBox/InputBox.tsx` | Banner |
| `src/renderer/i18n/locales/en/translation.json` | Strings |
| Optional CSS | Filmstrip row matching tool-step chrome |

### Acceptance (Phase 02)

- `read_video` shows human summary + expandable filmstrip
- Non-vision + video attach shows soft banner without blocking

---

## Phase 03 — Delight (optional, later)

- Multi-file attach stagger 30–50ms
- Poster crossfade from skeleton
- Drop overlay hint: MP4 · WebM · max duration/size
- Optional chip tap preview sheet (meta only) before full player

Do **not** start Phase 03 until 01+02 pass manual QA.

---

## Motion / feel tokens (make-interfaces-feel-better)

| Token | Value |
|-------|--------|
| Enter | 220–280ms `cubic-bezier(0.2,0,0,1)`; opacity + ~10px Y + blur 4→0 |
| Exit | 150ms ease-in; −8–12px Y |
| Press | `scale(0.96)` 150ms only |
| Numbers | `tabular-nums` on duration / frame counts |
| Transitions | Named properties only — never `transition: all` |
| Hit area | ≥40×40 interactive |

Anti-patterns: gradients, neon brand glow, bounce decoration, emoji icons, always-on video toolbar.

---

## Dependencies

```
Phase 01 ──► Phase 02
Phase 03 after 01+02 solid
```

Engine/storage already store `posterStorageKey`, `durationSec`, `mediaKind`, tool frame `storageKey`s — UI-only work; no schema migration expected.

---

## Risks

| Risk | Mitigation |
|------|------------|
| Large video blob as src | Blob URL + revoke; never dump multi-MB into content-viewer |
| Mobile hover delete | Always show delete on small/coarse pointer |
| Tool history missing frames (GC) | Empty filmstrip + text summary fallback |
| Main-thread sample cost | Honest Sampling label; no fake progress bar |
| Vision detect cost on banner | Reuse existing model capability path used on send |

---

## Rollback

Revert UI files listed above. No storage/schema migration.

---

## Implementation order (after approve)

1. Phase 01 chip + sampling + tile + VideoPlayer  
2. Phase 02 tool UI + banner  
3. Focused tests if helpers extracted; typecheck; manual video QA matrix  
4. Copy plan into `plans/2026-08-07-video-ux-polish/` for repo permanence  
5. Commit only if requested  

### Manual QA matrix

- Desktop dark + light  
- ~375px mobile width (delete, player sheet)  
- `prefers-reduced-motion`  
- Non-vision model attach  
- Multi-video limit toast  
- Long clip sample wait  
- `read_video` success + expand filmstrip  

---

## Brutal three (if scope must shrink)

1. Send **Sampling…** progress  
2. Thread media tile + in-app player  
3. `read_video` filmstrip tool UI  

Chip collision + mobile delete ride with #1/#2.
