# Plan: Diagram Workspace — Preview Polish + Split Pane

**Status:** Option B — workspace is HTML-only; Mermaid stays inline in chat  
**Date:** 2026-08-08  
**Scope:** Mermaid / diagram preview UX; optional general “workspace pane” for renderable artifacts  
**Skills applied:** make-interfaces-feel-better, high-end-visual-design, ui-ux-pro-max (as design constraints)  
**Research:** Claude Artifacts, ChatGPT Canvas, existing Chaeboxi `PictureDialog` + HTML `Artifact`  

---

## 1. My take (direct)

**Yes — split chat left / workspace right is the right product move** for mermaid (and later HTML/SVG artifacts). Your screenshot shows the **wrong chrome for iteration**: a fullscreen lightbox that:

- Hides the thread and composer  
- Rasterizes the diagram (PNG from SVG) so zoom is pixels, not vectors  
- Uses legacy MUI FABs (feels off-brand vs studio dock)  
- Forces “close → scroll chat → ask change → open again”

That matches **image viewer** UX, not **artifact workspace** UX.

| Pattern | Best for | Mermaid fit |
|---------|----------|-------------|
| **Fullscreen lightbox** (today `PictureDialog`) | Photos, one-shot export | Weak for diagrams |
| **Inline card** (current `Mermaid` shell) | In-thread glance + light zoom | Good v1 base — keep |
| **Split pane** (Claude Artifacts style) | Iterate while chatting | **Best for diagrams** |
| **Canvas editor** (ChatGPT Canvas) | Long docs/code edits | Overkill for mermaid v1 |

**Recommendation:**  
1. **Keep** polished inline mermaid card.  
2. **Replace** mermaid “Open preview” from image lightbox → **workspace side panel** (vector SVG, chat stays open).  
3. **Polish** remaining `PictureDialog` for actual images (photos).  
4. **Defer** full Canvas-style text editing; only **render + pan/zoom + source/export**.

---

## 2. Research summary (other apps)

### Claude Artifacts (closest match)
- Dual pane: **conversation left**, **artifact right**  
- Renders HTML, React, SVG, **Mermaid**, code  
- Composer stays available → “make the box green” while preview updates  
- Artifact chrome separate: Preview / Code, Copy, Publish  

### ChatGPT Canvas
- Dual pane too, but **editor-first** (doc/code collab)  
- Weaker as pure diagram renderer  
- Better metaphor for long writing, not architecture charts  

### Chaeboxi today

| Surface | Behavior |
|---------|----------|
| Inline `Mermaid.tsx` | Studio card, pan/zoom, copy source |
| Mermaid “Open preview” | `setPictureShow` → **PNG** in `PictureDialog` |
| `PictureDialog` | Fullscreen scrim + MUI Fab (save/close) |
| `Message.artifacts` | **HTML only** (`type: 'html'`) |
| `ArtifactPreview` modal | Fullscreen HTML iframe |
| `autoPreviewArtifacts` | Inline expand setting |

**Gap:** No persistent side workspace; mermaid is forced through an image dialog.

---

## 3. Product north star

```text
┌──────── rail ────┬────── chat (left) ──────┬── workspace (right) ──┐
│                  │  messages…              │  Diagram · Mermaid    │
│                  │  mermaid card [Open →]  │  [Preview] [Source]   │
│                  │  composer               │  pan/zoom SVG canvas  │
│                  │                         │  export · copy · close│
└──────────────────┴─────────────────────────┴───────────────────────┘
```

- Opening a diagram **does not** cover the chat  
- User can ask follow-ups while viewing the latest diagram  
- Prefer **live SVG** (sharp zoom), not PNG, in workspace  
- Mobile: workspace as **bottom sheet / full-route** (no tiny dual pane)

---

## 4. Design principles (studio, not Awwwards candy)

Align with `docs/design-guidelines.md`:

- Dark-first, indigo accent, **no** purple glows / gradient AI slop  
- Shadows over harsh borders; concentric radii  
- Toolbar island (like mermaid card); **no MUI Fab** in new chrome  
- Tabular-nums zoom; ≥40px hit targets; `prefers-reduced-motion`  
- Keyboard: `Esc` close workspace; optional `]` toggle  

---

## 5. Architecture

### 5.1 New UI state (workspace)

```ts
// uiStore or dedicated workspaceStore
type WorkspacePanel =
  | null
  | {
      kind: 'mermaid'
      source: string           // mermaid source
      title?: string
      messageId?: string
      theme: 'light' | 'dark'
    }
  | {
      kind: 'html'             // later: reuse existing artifacts
      htmlCode: string
      title?: string
      messageId?: string
    }
  | {
      kind: 'image'            // optional: photos stay fullscreen or dock
      picture: MessagePicture
    }
```

### 5.2 Layout

- Session shell (`session-shell` / `$sessionId.tsx` + quick):  
  `flex` row when `workspacePanel != null`  
  - Chat column: shrink (`flex-1 min-w-0`, min ~360px)  
  - Workspace: `min(48vw, 640px)` resizable later  
- Rail/sidebar unchanged  
- Empty workspace state: closed  

### 5.3 Mermaid open path change

| Today | Target |
|-------|--------|
| `setPictureShow({ url: png })` | `setWorkspacePanel({ kind: 'mermaid', source })` |
| Raster zoom | Vector SVG + same pan/zoom as inline (shared hook) |

### 5.4 Shared render core

Extract from `Mermaid.tsx`:

- `renderMermaidToSvg(source, theme)`  
- `MermaidCanvas` (viewport + pan/zoom/toolbar props)  
- Used by: inline card **and** workspace panel  

Avoid two divergent zoom implementations.

### 5.5 Key files

| File | Role |
|------|------|
| `src/renderer/pages/PictureDialog.tsx` | Polish **images only**; drop mermaid routing here |
| `src/renderer/components/Mermaid.tsx` | Open → workspace; share canvas |
| `src/renderer/components/workspace/*` | **New** panel shell + MermaidWorkspace |
| `src/renderer/stores/uiStore.ts` | `workspacePanel` state |
| `src/renderer/routes/session/$sessionId.tsx` | Split layout |
| `src/renderer/routes/quick.tsx` | Same if compact allows |
| `src/shared/types/session.ts` | Optional later: `MessageArtifact.type` += `mermaid` |
| `docs/design-guidelines.md` | Workspace pane contract |

---

## 6. Phases

### Phase 0 — Decision lock (0.25d)

Confirm:

1. **Default open** = side panel (not lightbox) for mermaid  
2. **Lightbox** remains only for photos / non-SVG images  
3. **Desktop first** split; mobile = full-screen sheet  

### Phase 1 — Picture preview polish (0.5–1d) — quick win

Even if split comes next, image lightbox should not stay MUI-Fab 2019:

1. Rebuild `PictureDialog` chrome with studio tokens (toolbar island, close, download)  
2. Scrim `rgba(0,0,0,0.72)` + subtle blur on backdrop only  
3. Zoom affordance hint; keep `react-zoom-pan-pinch`  
4. Stop using PictureDialog for mermaid (gate in `Mermaid.openPreview`)  
5. Esc / click-scrim / focus trap  

**Acceptance**

- [ ] Photos open polished lightbox  
- [ ] Mermaid “Open” no longer dumps PNG into PictureDialog  

### Phase 2 — Workspace panel shell + Mermaid (2–3d) — core

1. `workspacePanel` in `uiStore`  
2. `WorkspacePanel` component: header (title, Preview/Source tabs, actions, close)  
3. Layout split in session route when open  
4. Mermaid workspace: **live SVG** via shared canvas; pan/zoom/fit/copy/export PNG  
5. Source tab: read-only mono source + copy  
6. Inline card “Open” / double-click → open panel (not lightbox)  
7. Closing panel restores full-width chat  

**Acceptance**

- [ ] Chat + composer visible while diagram open  
- [ ] Zoom stays sharp (vector)  
- [ ] Follow-up message while panel open works  
- [ ] Esc closes panel  
- [ ] Mobile: full overlay sheet, not crushed split  

### Phase 3 — Artifact unification (1–2d) — done

1. Extend artifact kinds: `html | mermaid` (optional SVG later)  
2. HTML artifact “open” uses same workspace shell (iframe preview)  
3. Optional: auto-open workspace when `autoPreviewArtifacts` + generation finishes  
4. Message chip: “Open in workspace” for HTML + mermaid  

**Acceptance**

- [x] HTML + mermaid share one panel chrome  
- [x] Setting auto-open works without fighting user scroll (open on generating→done only)  
- [x] Enter/exit width + opacity motion; Esc closes; session leave clears panel  
- [x] Studio chrome (double-bezel, action island, no gradient card slop)  

### Phase 4 — Resize, history, polish (1d)

1. Drag resize handle (min chat width)  
2. Optional “pop out” fullscreen (workspace only)  
3. Last diagram in session: reopen from strip / message  
4. i18n + a11y (focus move into panel; restore on close)  
5. Docs  

**Total estimate:** ~5–7 focused days (Phase 1+2 shippable alone).

---

## 7. Explicit non-goals (v1 workspace)

- Collaborative multi-cursor Canvas editing  
- Publish/share public artifact URLs  
- Live MCP-driven artifacts  
- Auto-open on every code fence  
- Replacing rail with dual nav  

---

## 8. Risks

| Risk | Mitigation |
|------|------------|
| Narrow desktops / dual panels | Min widths + collapse to sheet under ~900px |
| Two zoom UIs diverge | Single `MermaidCanvas` component |
| PNG export still needed | Export action rasterizes on demand only |
| Virtuoso + layout shift | Workspace outside Virtuoso; chat column resizes once |
| Team multi-agent noise | Panel shows **last opened** diagram only |

---

## 9. Opinionated defaults

| Choice | Default |
|--------|---------|
| Open target for mermaid | **Side workspace** |
| Default width | ~42–48% of content area |
| Auto-open on stream end | **Off** (opt-in setting) |
| Source tab | Yes |
| Chat left / preview right | **Yes** (industry standard) |
| PictureDialog | Images only, redesigned |

---

## 10. Cook order

```text
Phase 1 (stop mermaid→PNG lightbox + polish image dialog)
  → Phase 2 (split workspace + vector mermaid)
  → Phase 3 (HTML artifacts share shell)
  → Phase 4 (resize / a11y / docs)
```

---

## 11. Success criteria

User story:  
*“I open a mermaid architecture diagram → it docks on the right, labels stay sharp, I keep chatting and ask for a change without closing the preview.”*

Matches Claude Artifacts mental model without inventing a full Canvas editor.

---

## Unresolved (defaults above apply)

1. Auto-open mermaid on generation complete? (default **off**)  
2. Quick chat / menubar: split or sheet-only? (default **sheet**)  
3. Persist panel width? (default **yes**, local only)  
