# Computer Use (use_computer)

Desktop-only agent capability to **observe** the screen and optionally **act** (mouse/keyboard) under explicit consent.

**Train B** — ship after browser M2. Master switch defaults **off**.

## User guide

### Permission onboarding (in-app)

Settings → **Computer Use → Permissions** follows the same pattern as Raycast / CleanShot / system notifications:

1. Explain **why** (observe vs act).
2. **Open Settings** deep-links to the OS privacy pane (macOS `Privacy_ScreenCapture` / `Privacy_Accessibility`).
3. User enables **Chaeboxi** in the list (apps cannot flip the switch for you).
4. **Recheck** status in Chaeboxi (first Screen Recording grant may need app restart on macOS).
5. Arm Computer Use per chat; use a vision model for screenshots.

### Steps

1. **Settings → Computer Use** → enable master.
2. Use **Open Settings** + **Recheck** for Screen Recording / Accessibility.
3. Arm **Computer Use** in the composer tools menu for the chat.
4. Use a **vision** model for `computer_screenshot`.
5. Approvals: act tools are **CRITICAL** and never session-auto-approve.
6. Abort via HUD **Stop** or chat Stop (sets backend abort flag).

### Dev builds (`pnpm dev`) on macOS

`tauri dev` runs `src-tauri/target/debug/chaeboxi` — **not** a packaged `Chaeboxi.app`.

macOS Screen Recording is keyed to **code identity** (signing team + identifier), not just the path. Linker **ad-hoc** signatures change CDHash on every rebuild, so a grant can look “on” in Settings while the *current* process still fails `CGPreflight` / capture.

Mitigations in this repo:

- `pnpm dev` / `pnpm tauri:dev` wraps Tauri with `scripts/tauri-dev-macos.mjs`, which re-signs the debug binary after rebuilds (`scripts/macos-sign-dev-binary.sh`) using your Apple Development identity and fixed identifier `com.chaeboxi`.
- Manual: `pnpm dev:sign` after a rebuild if needed.
- After **first** enabling Screen Recording for the signed binary: **fully quit** the app and start `pnpm dev` again (macOS often applies Screen Recording only after relaunch).
- If multiple “chaeboxi” rows exist, remove old ones, keep the entry for the currently running binary (use **Reveal** in settings), toggle on, relaunch.
- **Recheck / screenshots both use in-process CoreGraphics.** Do not expect the `screencapture` CLI (or Terminal) to share the same TCC grant as Chaeboxi.

## Tools

### Observe

| Tool | Risk |
|------|------|
| `computer_screenshot` | MEDIUM |
| `computer_wait` | LOW — settle then auto-screenshot |
| `computer_frontmost` | LOW — macOS frontmost process name |

### Act (when armed)

| Tool | Risk |
|------|------|
| `computer_open_app` | CRITICAL — launch desktop app by name (`open -a` on macOS) |
| `computer_open_uri` | CRITICAL — allowlisted URI (`whatsapp://`, `sms:`, `http(s)`, `mailto:`) |
| `computer_click` | CRITICAL |
| `computer_type` | CRITICAL |
| `computer_key` | CRITICAL |
| `computer_scroll` | CRITICAL |
| `computer_mouse_move` | HIGH (intent) / CRITICAL patterns may apply |

Coordinates are in the **last screenshot / verification image pixel space** returned to the model. Each capture includes a **`frameId`**; click/move may pin to that id — stale frames are rejected with `STALE_FRAME`.

When Computer Use is armed, **`browser_*` tools are stripped** for the turn so the model does not thrash between DOM refs and pixels.

## Coordinate mapping

Model tools pass coordinates in **last screenshot image space** (`width`×`height` returned with the capture).

Backend maps to actuator space before click/move:

```
x_act = x_model * (actWidth / screenshotWidth)
y_act = y_model * (actHeight / screenshotHeight)
```

On macOS, `actWidth`/`actHeight` are **display points** (`CGDisplayBounds`) — the space used by cliclick / System Events — not raw retina pixels. On Windows/Linux, actuator space is the native capture pixel size before model downscale.

Capture pipeline resizes toward max width (~1280) and encodes **JPEG** for the model. Screenshots are sent as multimodal `image-data` (not raw base64 JSON text) so providers like Gemini do not hit the 1M input-token cap.

## Open / activate

`computer_open_app` launches the app **and** activates it (macOS: `open -a` + AppleScript `activate`). `{ok:true}` means launch/activate was requested, not that the target UI is verified. Always follow with `computer_screenshot` before clicking.

## Hotkeys

`computer_key` accepts chords with `+` (or `-`): `cmd+space`, `meta+f`, `ctrl+c`, `shift+tab`, plus singles like `enter` / `escape` / arrows.

## Separation from snip-to-chat

| | Snip-to-chat | computer_screenshot |
|--|--------------|---------------------|
| Trigger | Human hotkey/tray | Agent tool |
| Region | Interactive region | Full display |
| Destination | User message | Tool result to model |

IPC channels: `computer:*` (not `shell:captureScreenshot`).

## Agent loop & step budget

Computer tasks need many tool steps (open → screenshot → click → screenshot…).

- Default chat `maxSteps` is **5** (copilot default).
- When **Computer Use is armed** for the session, generation raises the floor to **16** steps so the model does not die after open/screenshot.
- Screenshot budget default is **16** per turn (`extension.computerUse.maxScreenshotsPerTurn`) — aligned with the 16-step floor so auto-verify shots do not starve mid-task.
- Tool results include a `nextAction` nudge: after open/click/type/key, the model is instructed to screenshot again.

If the agent still stops early: check the model is vision-capable, approvals are not blocking the next tool, and `maxSteps` is not overridden lower by a copilot profile.

## Computer UI space lock

When Computer Use tools are active for a turn, the runtime **locks the agent into desktop UI space**:

- Strips `search_file_content` (name collides with “find contact”).
- Strips workspace write/terminal (`create_file`, `edit_file`, `delete_file`, `terminal`) unless agent coding is also enabled for that turn.
- Injects hard policy: no Finder, no Spotlight for people/chats; in-app search only after screenshot proves the target app.
- `computer_open_app` records the target app and tells the model to stay inside that UI.

This is intentional tool routing, not a full app sandbox. Attachment `read_file`, memory, and (when enabled) browser tools may still be present.

## Harness v2 (loop fidelity)

Industry-style host loop (see `docs/research/2026-08-11-computer-use-industry-parity.md`):

1. **Auto verification screenshot** after `open_app` / `open_uri` / `click` / `type` / `key` / `scroll` / `wait` (embedded as multimodal `image-data` via `toModelOutput`).
2. **`computer_wait`** — settle 0.3–2s then auto-screenshot.
3. **`prepareStep`** — if last act did not embed a shot, force `toolChoice: computer_screenshot`; prune older images (keep last 3).
4. **Messaging guards** — block open Finder / Spotlight (`cmd+space`) while a target app is set.
5. **Re-activate target** before click/type when last known `frontmost` drifted.
6. **Playbooks + deep links** — WhatsApp/Calculator/… skills; phone → `whatsapp://send?phone=…`.
7. **Optional allowlist + trajectory** — Settings → Computer Use (empty allowlist = all apps).

Coordinate contract: model coords = verification/screenshot width×height; backend maps to act points (`CGDisplayBounds`). Capture resizes with aspect preserved (max width ~1280); reported `width`/`height` must match JPEG pixels the model sees.

## Residual plan

Full remaining roadmap (measure → ship): `plans/2026-08-11-computer-use-residual/`.

**AX note:** full accessibility-tree search-field focus is **not** implemented; `computer_frontmost` is the thin probe. Use vision playbooks + deep links first.

## Ship / binary identity

- App Store Chaeboxi ≠ `pnpm dev` debug binary for TCC.
- After enabling Screen Recording / Accessibility for the **running** executable, fully quit and relaunch.
- Settings shows path + Reveal; use Recheck after changes.
- New harness features require a **new build** for store users.

## Demo path

1. Arm computer use + vision model.
2. Ask: "What is on my primary display?"
3. Approve screenshot if prompted.
4. For act: open Calculator, ask agent to click digits with approvals + HUD visible.
5. Abort mid-run → no further injection.

### App Store / packaged macOS

Screen Recording and Accessibility must list **Chaeboxi** (the installed app). If Settings shows Allowed but screenshots fail: toggle Chaeboxi off/on in System Settings → Privacy & Security → Screen Recording, fully quit Chaeboxi, relaunch, Recheck. Dev binaries (`target/debug/chaeboxi`) are a different TCC identity from the App Store app — grants do not transfer.

## OS matrix

| OS | Observe | Act | Notes |
|----|---------|-----|-------|
| macOS | Supported (in-process `CGDisplayCreateImage`, not `screencapture` CLI) | Supported (cliclick / osascript) | Screen Recording for *this* process; Accessibility for act |
| Windows | Supported (PowerShell GDI) | Supported (SendInput/SendKeys) | |
| Linux | Experimental | Experimental | Needs gnome-screenshot/import + xdotool |

## Residual risks

- On-screen text can inject into vision models (same class as DOM injection).
- Full user-equivalent control when act is armed — keep approvals and HUD.
- Never log keystrokes that look like passwords.

## Related

- Browser agent: [browser-agent.md](./browser-agent.md)
- Threat model: `plans/260811-1011-use-browser-use-computer/reports/phase-01-threat-model.md`
