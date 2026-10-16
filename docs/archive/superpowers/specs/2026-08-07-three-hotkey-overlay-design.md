# Three-Hotkey Overlay Design

**Date:** 2026-08-07
**Status:** Approved for implementation

## Goal

Make the desktop quick-chat overlay immediately available from anywhere with three distinct global hotkeys:

1. `screenshotToChat` — capture an interactive screen region, open quick chat, and attach the captured image. This existing behavior remains unchanged.
2. `quickAttachOrOpen` — open quick chat and import the current clipboard content. Clipboard text is inserted into the composer; clipboard images are attached as image input. This action is open-and-attach, not a toggle, so pressing it while quick chat is visible does not hide the window or duplicate content; it processes one clipboard snapshot per invocation.
3. `quickOpen` — open quick chat without reading or importing the clipboard, then focus the composer so the user can type immediately.

The existing `quickToggle` remains a pure show/hide toggle. It is not repurposed for clipboard import.

## Defaults and settings

- `quickToggle`: existing default `Alt+\``; preserve the existing setting and behavior.
- `screenshotToChat`: existing default `Alt+Shift+S`.
- `quickAttachOrOpen`: new editable global shortcut, default `Alt+Shift+V`.
- `quickOpen`: new editable global shortcut, default `Alt+Shift+Space`.

The two new shortcuts are free strings, like `screenshotToChat`, rather than members of the closed `shortcutToggleWindowValues` enum. Settings validation and default merging must allow older persisted settings that lack these fields by applying the new defaults.

## Architecture and data flow

The Tauri desktop shell remains responsible for global shortcut registration and reading the native clipboard. The renderer remains responsible for converting image payloads into existing input-box storage and updating the existing preconstructed-message atom.

### Clipboard payload

Add a tagged clipboard payload event:

- `{ type: 'text', text: string }`
- `{ type: 'image', mimeType: string, base64: string, fileName: string }`

On `quickAttachOrOpen`, the Rust handler reads the clipboard once. It prefers an image when one is available, otherwise reads non-empty text. It then shows quick chat and emits `shell:clipboard-captured` with the payload. If no supported content exists, it still opens quick chat and emits no attachment payload, allowing normal typing.

Existing `shell:screenshot-captured` is left intact. Existing manual “Attach clipboard image” continues to use the image-only IPC path.

### Renderer handling

Add a platform listener for `shell:clipboard-captured`. In `useDesktopShell`, route the event to the active chat surface and apply exactly one payload:

- Text: set the target session's preconstructed message `text` to the clipboard text. The implementation must ensure the visible `InputBox` receives the text and is focused.
- Image: reuse `attachScreenshotToComposer` and add the image storage key to the target session's `pictureKeys`.

Only one renderer path applies each native event. Do not add a second “reattach on window open” effect, which would duplicate images or text.

`quickOpen` only invokes `show_quick`; it never reads the clipboard or emits a clipboard event. The quick route's existing session initialization and focus behavior provide the type-immediately experience.

## Error handling and privacy

- Clipboard read failures are non-fatal: show the quick window and allow typing.
- Empty clipboard content is treated as no import.
- Native clipboard data is read only when the user invokes `quickAttachOrOpen`; there is no background clipboard watcher.
- Image conversion/storage failures show the existing failure toast without preventing the overlay from opening.
- Text is not persisted beyond the existing composer draft behavior after it is intentionally inserted by the user shortcut.

## Settings UI

Add two rows to the shortcut settings table:

- “Open quick chat with clipboard” → `quickAttachOrOpen`
- “Open quick chat” → `quickOpen`

Both use the existing shortcut recorder/display component so users can edit them. The conflict indicator must include the new rows and detect duplicate non-empty accelerators before registration.

## Testing

- Schema/default compatibility: old settings without the new fields receive the two defaults; explicit empty strings disable registration.
- Shortcut registration: each configured accelerator registers a distinct action; duplicate accelerators are rejected or surfaced by the existing conflict UI rather than silently treated as the same action.
- Clipboard event handling: text updates the composer; image adds one picture key; unsupported/failed clipboard reads still open quick chat.
- `quickOpen` never emits or applies clipboard content.
- Existing screenshot-to-chat behavior remains unchanged.

## Scope exclusions

This change does not add dock-icon hiding, tray redesign, background clipboard monitoring, new screenshot capture implementations, or changes to the quick-chat layout.
