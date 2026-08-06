# Plan: Menu Bar Floating Chat + Screenshot

**Status:** Implemented (Phases 1–4 code landed)  
**Date:** 2026-08-06

## Phases

| Phase | Status | Notes |
|---|---|---|
| 1 Tray + close-to-hide + global shortcuts | Done | `desktop_shell.rs`, keepInTray |
| 2 Floating quick window | Done | Window `quick`, route `/quick` |
| 3 Screenshot + clipboard | Done | macOS screencapture, Win snip+clipboard, Linux tools |
| 4 Polish | Done | Settings UI, first-run toast, hotkeys |

## Research

See `reports/2026-08-06-research-menubar-floating-chat-screenshots.md`

## Key files

- `src-tauri/src/desktop_shell.rs`
- `src-tauri/src/lib.rs` (wire-up)
- `src/renderer/routes/quick.tsx`
- `src/renderer/hooks/useDesktopShell.ts`
- Settings: `keepInTray`, `quickWindowAlwaysOnTop`, `shortcuts.screenshotToChat`

## Manual QA remaining

- [ ] macOS: close → tray, Alt+`, Alt+Shift+S, quick window send
- [ ] Windows: tray + snip flow
- [ ] Linux: tray menu + hotkey
