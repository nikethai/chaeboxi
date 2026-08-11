# Phase 6 — Computer observe OS matrix

| OS | Capture | Permission probe | Notes |
|----|---------|------------------|-------|
| macOS | screencapture -x full display | granted/denied via probe | Separate from region snip |
| Windows | PowerShell PrimaryScreen | assumed granted | |
| Linux | gnome-screenshot / import | experimental | |

Tool: `computer_screenshot` — vision required, rate limited per turn, master+arm required.
