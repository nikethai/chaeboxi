# Research: OS permission onboarding UX

Date: 2026-08-11  
Topic: How apps guide users to enable Screen Recording / Accessibility (and what we shipped)

## Consensus pattern (Apple + production apps)

1. **Just-in-time** — don’t demand capture on first launch; ask when the feature is used / enabled.
2. **Pre-prompt copy** — short “why we need this” before OS dialog (Screen Recording / Accessibility).
3. **Cannot auto-toggle** — only the user can enable the app in System Settings.
4. **Deep link recovery** — “Open Settings” → exact Privacy pane when denied/missing.
5. **Recheck + restart note** — macOS often needs **app restart** after first Screen Recording grant.
6. **Status in product** — Granted / Denied / Not checked badges (mirrors our Notifications settings).

## Industry references

| Source | Takeaway |
|--------|----------|
| Apple ScreenCapture / media capture docs | JIT auth; system UI for capture sources; recovery path in Privacy |
| Raycast / automation apps | Accessibility under Privacy & Security; open Settings if missing |
| CleanShot-class tools | Screen Recording + clear “open privacy” recovery |
| Claude desktop / agent safety docs | Explicit local permissions + user control for computer use |
| Chromium / app deep links | `x-apple.systempreferences:…Privacy_ScreenCapture` / `Privacy_Accessibility` |

## Applied in Chaeboxi

- **Computer Use → Permissions**: ordered “How to enable”, status badges, **Open Settings**, **Recheck**, path labels per OS.
- Helpers: `src/renderer/packages/computer/privacy-settings.ts`
- **Browser Agent → Safety**: ordered “How to use safely” (no OS privacy panes; isolation + approvals instead).
- Existing parallel: **General → system notifications** Request permission row.

## Residual

- Accessibility status probe is often `unknown` until first act (no private AX API).
- Deep links may vary by macOS version — dual modern + legacy URLs tried.
- Linux: no deep link; show package/tool install guidance only.
