# Plan: Rail Projects Tree + Recents (Unfiled Chats)

**Status:** implemented (pending visual QA)  
**Date:** 2026-08-06  
**Branch context:** `feat/desktop-menubar-quick-chat` (or follow-up UI branch)  
**Mode:** implementation plan (no code until approved)

## Goal

Make the left rail read as a clear **Projects tree + Recents inbox**, not a flat “Uncategorized dump.” Improve hierarchy, empty states, row density, and the escape hatch from unfiled → project — without inventing a synthetic Uncategorized project in storage.

## Locked product decisions (confirmed)

| # | Decision |
|---|----------|
| 1 | **No real “Uncategorized” project** in `Folder` storage. Unfiled = `folderId` missing/null. |
| 2 | Unfiled section label: **Recents** (replace user-facing **History**). Avoid permanent “Uncategorized.” |
| 3 | **Projects section always visible**, even when zero projects (empty coaching + create). |
| 4 | New chat from nav lands in Recents; New Chat from project `+` keeps `folderId`. |
| 5 | Visual language stays inside `docs/design-guidelines.md`: tight radii 7/9/11, no gradients, no emoji project icons, studio quiet selection (not brand wash). |
| 6 | Polish principles from make-interfaces-feel-better applied to **rail only** (hit targets, concentric nest, shadows-over-hard-borders, tabular nums, scale 0.96, no `transition: all`). |
| 7 | **Ship scope: full Phase 0–3 in one implementation effort** (correctness + hierarchy + DnD + Recents intelligence). |
| 8 | **New Project:** both **Projects section trailing `+`** and existing **rail-tools** folder icon (redundant, discoverable). |

## Non-goals

- Full shell redesign (brand, account foot, topbar).
- Glass / double-bezel on every list row.
- Multi-select bulk move.
- Day-grouping inside projects.
- Auto-creating system folders.

## Current architecture (baseline)

| Piece | Location | Today |
|---|---|---|
| Shell tools | `src/renderer/Sidebar.tsx` | New Project + archive live in orphan `rail-tools` |
| Tree | `src/renderer/components/session/SessionList.tsx` | Virtuoso flat rows: section / folder / session; Projects hidden if no folders; unfiled labeled History |
| Project row | `FolderItem.tsx` | Collapse, stack icon, count, hover `+` / ⋯ |
| Chat row | `SessionItem.tsx` | Title only; route-based selected; ⋯ menu (incl. Move to Project modal) |
| Styles | `src/renderer/static/globals.css` | `.rail-section`, `.studio-rail-row*`, `.project-folder-*` |
| Meta | `SessionMeta` | has `folderId`, `createdAt` (optional) — time not shown in row |

**Key gap:** dnd-kit reorders only **within** same folder key; cannot drag unfiled → project.

---

## Phases

### Phase 0 — Correctness & copy lock

**Why first:** Selected row + empty main kills trust; copy must be locked before i18n churn.

**Steps**

1. Reproduce: lit session row while main shows “Select a conversation or create a new one.” Trace `switchCurrentSession` vs `/` vs `/session/:id`.
2. Fix if desync is real (selection must match route; missing session shows explicit empty, not home blank).
3. Lock strings: `Projects`, `Recents`, empty Project copy, empty Recents copy.
4. Update `docs/design-guidelines.md` Projects/History bullet → Projects/Recents (only when strings land).

**Files**

- `src/renderer/components/session/SessionItem.tsx` (selection)
- `src/renderer/stores/sessionActions.ts` / router entry points (as needed)
- `src/renderer/routes/index.tsx` (blank copy only if wrong)
- i18n locales (en minimum; mirror existing locale set pattern)
- `docs/design-guidelines.md`

**Acceptance**

- [ ] Selecting a chat always shows that session thread (or honest loading/missing state).
- [ ] No user-facing “History” for unfiled; **Recents** used.
- [ ] No synthetic folder written to storage.

---

### Phase 1 — IA + visual hierarchy (feel better)

**Why:** Hierarchy and empty states are most of the screenshot pain.

**Steps**

1. **Always mount Projects section** in `SessionList` `rowItems` (even if `projectGroups.length === 0`).
2. Empty Projects body: quiet line + reliance on section `+` (see step 3).
3. Add **New Project** on Projects **section trailing** (hover desktop; always on small screens). **Keep** existing `rail-tools` folder+ (dual entry). Archive control stays in rail-tools.
4. **Recents section** for unfiled sessions (same data as today’s History group / `ALL_FOLDER_KEY`).
5. **Nested indent** for sessions under expanded projects (`padding-inline-start` ~28–32px or dedicated class). Recents sessions stay base inset.
6. Optional soft expanded project group shell: outer radius 11 + pad 4 + inner row radius 7 (concentric). No glass stack.
7. **Session row:** title + relative time (`createdAt` / `updatedAt` if available) with `tabular-nums`; mono muted.
8. **Active/hover:** quiet tertiary + hairline shadow (`0 0 0 1px rgba(255,255,255,0.06)` dark); avoid loud indigo wash. Light mode: neutral hairline, not brand slab.
9. Hit targets ≥40 for section, chevron, `+`, ⋯; unify `active:scale-[0.96]`; chevron `transform` only with existing ease family.
10. Project count stays `tabular-nums`, muted.

**Files**

- `SessionList.tsx`, `FolderItem.tsx`, `SessionItem.tsx`
- `Sidebar.tsx` (rail-tools shrink / wire create project from section if callback needed)
- `globals.css` (rail section/row/nested classes)
- i18n

**Acceptance**

- [ ] Projects visible with zero projects; create is obvious.
- [ ] Nested project chats optically under parent; Recents not identical nesting.
- [ ] Rows show time; duplicate titles still distinguishable by time.
- [ ] Light + dark: selection quiet, hit targets usable, no gradient chrome.

---

### Phase 2 — Escape hatch: drag into / out of projects

**Why:** Without this, Recents remains a permanent junk drawer.

**Steps**

1. Extend dnd-kit: sessions remain sortable; **project rows (and Recents section zone) are droppable**.
2. Drop on project → `updateSession(id, { folderId })`; expand target project; refetch list.
3. Drop on Recents zone → clear `folderId`.
4. Drop indicator: soft fill / hairline on valid target; reject same-folder no-op cleanly.
5. Keep **Move to Project** modal as keyboard/a11y fallback.
6. Tests: reorder within group still works; assign folder; unfile.

**Files**

- `SessionList.tsx` (primary)
- Possibly thin helper `sessionListDnd.ts` if logic grows
- `chatStore` / `updateSession` existing APIs
- `*.test.ts` colocated or under `src/renderer/components/session/`

**Acceptance**

- [ ] Drag unfiled chat onto project moves it (no modal).
- [ ] Drag project chat to Recents unfiles it.
- [ ] Within-project reorder still works.
- [ ] Modal move still works.

---

### Phase 3 — Recents intelligence (in scope)

**Steps**

1. Day headers in **Recents only** (Today / Yesterday / older) if `createdAt` coverage is good enough on meta list.
2. Soft coaching when `projects.length > 0 && unfiled.length >= threshold` (e.g. 8): short line under Recents label, not a modal.
3. Starred ordering audit (pin starred at top of Recents if product already intends that).

**Acceptance**

- [ ] Day groups only in Recents; projects keep manual order.
- [ ] Coaching dismissible or low-noise (no nag every frame).

---

### Phase 4 — Verify & docs

**Steps**

1. `pnpm test` focused on session list / store if new tests.
2. `pnpm check` / lint on touched files.
3. Manual visual QA: empty projects, nested project, long titles, narrow rail (~200px), light/dark.
4. Update design guidelines only for user-visible rail IA (Projects + Recents, drag, no Uncategorized folder).

---

## Implementation notes

### Virtual vs real project (recap)

```
Projects          ← user Folder[] only
  {name}
    sessions...
Recents           ← virtual section; folderId empty
  sessions...
```

Do **not**:

```
Projects
  Uncategorized   ← synthetic Folder  ❌
```

Optional later: style Recents header like `FolderItem` (`implicit`) for folder-feel without storing a folder — still **outside** Projects list.

### Suggested CSS classes (illustrative)

- `.rail-session-nested` — indent under project
- `.rail-project-group` — optional expanded shell
- `.studio-rail-row-active` — add hairline shadow token, tune light/dark
- Section trail `.rail-section-add` — New Project

### Risk

| Risk | Mitigation |
|---|---|
| Virtuoso + nested droppables flaky | Drop only on folder/section rows, not every pixel of list |
| `createdAt` missing on old meta | Fallback hide time or “—”; no layout jump |
| i18n key renames | Keep old History key temporarily or dual-key migration per locale files |
| Scope creep into full mock day-list | Phase 3 optional; Phase 1–2 ship alone |

---

## Success metrics (qualitative)

- User can explain “Projects vs Recents” in one sentence.
- Cleaning unfiled does not require the Move modal for the common path.
- Rail matches studio contract (quiet, tight radius, no SaaS glass).
- Empty Projects is actionable, not missing.

---

## Suggested execution order after approval

Single implementation effort (user confirmed **Phase 0–3**):

1. Phase 0 — selection/route fix + Recents copy.  
2. Phase 1 — always Projects, dual New Project controls, nest, times, quiet selection.  
3. Phase 2 — drag into project / back to Recents + tests.  
4. Phase 3 — Recents day groups + coaching when many unfiled.  
5. Phase 4 — verify + design-guidelines touch.

**Cook entry:** implement full stack in one pass; keep commits logical by phase if multi-commit.

---

## Open questions

**Resolved with user**

| Q | Answer |
|---|---|
| Label | **Recents** |
| Ship scope | **Phase 0–3 full** |
| New Project placement | **Both section `+` and rail-tools** |

**No blockers remaining** — ready to implement after plan approval.

---

## File touch map (summary)

| File | Phases |
|---|---|
| `SessionList.tsx` | 0–3 |
| `SessionItem.tsx` | 0–1 |
| `FolderItem.tsx` | 1 |
| `Sidebar.tsx` | 1 |
| `globals.css` | 1–2 |
| i18n locales | 0–1 |
| `docs/design-guidelines.md` | 0 / 4 |
| session DnD helper (new, optional) | 2 |
| tests | 2 |

## Status protocol for implementer

```
Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
Summary: …
```
