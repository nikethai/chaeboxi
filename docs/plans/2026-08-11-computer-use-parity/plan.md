# Plan: Computer Use Harness v2 (Industry Parity)

**Date:** 2026-08-11  
**Research:** `docs/research/2026-08-11-computer-use-industry-parity.md`  
**Goal:** Reliable desktop flows (Calculator → WhatsApp message) without Finder/Spotlight thrash.  
**Principles:** YAGNI · KISS · DRY · no cloud VM

## Implementation status (2026-08-11)

| Phase | Status |
|-------|--------|
| 0 Measure | Deferred to live demo on dev binary |
| 1 Loop fidelity | **Done in repo** — auto-screenshot after act, `computer_wait`, prepareStep force-shot + prune, docs |
| 2 App scope | **Done in repo** — target tracking, re-activate on drift, block Finder open + Spotlight keys, playbook text |
| 3 Deep links | **Moved** → residual plan |
| 4 AX | **Moved** → residual plan |
| 5 Ship | **Moved** → residual plan |

**Residual full plan (measure → ship):** `plans/2026-08-11-computer-use-residual/`

## Success criteria

| Demo | Pass condition |
|------|----------------|
| Calculator | open → click 7 + 8 = → correct result on screenshot |
| WhatsApp | open → **in-app** find contact → type message → send (or stop at confirm) |
| Negative | No `search_file_content` / Finder / Spotlight for “find contact” |
| Budget | Completes within step/screenshot limits or clear “blocked: …” |

## Non-goals (now)

- Full Operator-style remote VM  
- Universal RPA for every Mac app  
- Replacing user model with a private CU-only model  

---

## Phase 0 — Measure (½ day)

**Why:** Don’t fix the wrong layer.

1. On **dev binary** (not App Store), run Calculator + WhatsApp demos.  
2. Export tool cards: names, errors, step count, whether UI lock stripped tools.  
3. Classify failure:
   - **Routing** → more lock / hierarchy  
   - **Vision/coords** → scaling / zoom  
   - **Loop stop** → auto-screenshot / maxSteps  
   - **Permissions** → TCC / wrong binary  

**Exit:** 1-page failure class logged in plan notes.

---

## Phase 1 — Loop fidelity (highest ROI) — 2–3 days

### 1.1 Host-enforced observe after act

After successful `computer_click|type|key|scroll|open_app`:

- Option A (KISS): tool result always includes a **fresh screenshot image part** (if vision + budget).  
- Option B: if model doesn’t call screenshot next, harness **injects** a synthetic “must screenshot” system nudge once.

Prefer **A** for open_app + click + type (matches Anthropic “evaluate after step”).

### 1.2 `computer_wait`

- New act/observe helper: sleep 0.3–2s then optional auto-screenshot.  
- Use after open app / animations.

### 1.3 Screenshot context prune

- Keep last **N=3** full screenshots in model messages; older → `[screenshot omitted]`.  
- Align with Anthropic rolling buffer (batch prune to preserve cache if we add caching later).

### 1.4 Coordinate / image contract audit

- Assert `display` / reported width×height === image bytes dimensions for every provider path.  
- Document Retina: act space = points; model space = JPEG size.  
- Optional: downscale to 1280 long-edge consistently (already ~1280 max width — verify height/aspect).

### 1.5 Stronger stop condition

- Don’t end turn on `open_app` alone if user goal incomplete (detect via incomplete-goal heuristic or remaining plan).  
- Soft: if last tool was open_app and steps remain, force continue.

**Exit:** Calculator 3/3 runs pass on vision model.

---

## Phase 2 — App-scoped desktop (anti-Finder) — 2 days

### 2.1 Target app session state

- Already: `setComputerUiTargetApp` on open.  
- Add: before click/type, if `frontmost` available and ≠ target (and not Chaeboxi), **re-activate target** once + screenshot.

### 2.2 Messaging goal guard

If user intent matches message/contact/chat (simple classifier or keyword):

- Deny / high-friction: `computer_open_app(Finder)`, `cmd+space` for people search.  
- Prefer playbook string for WhatsApp/Telegram/Slack.

### 2.3 Tool hierarchy (product rule)

When Computer Use armed:

1. Prefer computer tools for desktop goals  
2. Keep browser only if URL/web explicit  
3. Keep UI lock (strip `search_file_content`, coding tools unless coding on)

### 2.4 Optional app allowlist (settings)

- Mirror Claude Desktop: only act on allowlisted apps (default: all when armed, or user picks).  
- YAGNI until free-roam causes real damage.

**Exit:** WhatsApp “find contact” never opens Finder in 5/5 intentional runs (may still fail click).

---

## Phase 3 — App playbooks + deep links — 2–3 days

### 3.1 Static playbooks (system inject)

```
whatsapp:
  find_contact: open → wait → screenshot → click search (left sidebar) → type → screenshot → click row
  send: type message → screenshot → click send / key enter → screenshot
```

Same for Calculator. Inject when open target matches.

### 3.2 Deep links (when phone/id known)

- `whatsapp://send?text=` / phone schemes if available on macOS WhatsApp.  
- Skip UI find when user provides phone.

### 3.3 Optional: browser WhatsApp Web path

- If Desktop UI unstable, offer “use Browser Agent on web.whatsapp.com” as fallback skill.

**Exit:** Name-based contact find works ≥3/5; phone-based ≥5/5.

---

## Phase 4 — Hybrid AX assist (only if Phase 1–3 insufficient) — 3–5 days

1. macOS Accessibility: frontmost app, focused element, find by role `search field` / AXDescription.  
2. Tool: `computer_focus_search` or internal pre-step before type.  
3. Fallback to vision if AX empty (Electron).  

**Exit:** Search field focus succeeds without click coordinates for WhatsApp ≥4/5.

---

## Phase 5 — Ship & permissions UX — 1–2 days

1. Local release / TestFlight so App Store users get harness.  
2. Settings: clear “which binary has TCC” (dev vs store).  
3. Docs: demo prompts, failure checklist.  
4. Trajectory debug: optional save last N screenshots + actions under session debug.

---

## Implementation map (files)

| Area | Likely touch |
|------|----------------|
| Tools | `toolsets/computer.ts`, `computer-ui-lock.ts` |
| Loop | `stream-text.ts`, `stores/session/generation.ts` |
| Capture | `src-tauri/src/computer_manager.rs` |
| Types | `platform/interfaces.ts` |
| Docs | `docs/computer-use.md` |
| Tests | tool unit tests; optional integration smoke |

## Decision framework

| If… | Then… |
|-----|--------|
| Calculator fails clicks | Phase 1.4 coords first |
| Opens app then text-only | Phase 1.1 / 1.5 loop |
| Opens Finder for contact | Phase 2 + keep UI lock |
| Clicks wrong area in WhatsApp | Phase 1 zoom/wait + Phase 3 playbook |
| Still can’t find search box | Phase 4 AX |
| User wants cloud isolation | Separate product; not this plan |

## Effort summary

| Phase | Effort | Priority |
|-------|--------|----------|
| 0 Measure | 0.5d | P0 |
| 1 Loop fidelity | 2–3d | **P0** |
| 2 App scope | 2d | P0 |
| 3 Playbooks / deep links | 2–3d | P1 |
| 4 AX | 3–5d | P2 |
| 5 Ship | 1–2d | P0 with 1–2 |

**Recommended start:** Phase 0 → Phase 1.1 (auto-screenshot after act) → Phase 2.1 (re-activate target) → WhatsApp playbook.

## Unresolved

- Confirm live failure class on **dev** binary after harness v2.  
- Whether WhatsApp Desktop exposes stable deep links on user’s install.  
- Product choice settled: auto-screenshot after open/click/type/key/scroll/wait (not mouse_move).  
- `ensureTargetFrontmost` only re-opens when last known frontmost drifted (not every click).
