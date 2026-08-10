# System Notifications

Local OS notifications when Chaeboxi finishes work while the app is unfocused or in the tray. This is **not** remote push (no FCM/APNs server, no device tokens, no cloud).

## Privacy

- Notifications include a short title and optional **session name** only.
- Message / model content is **never** placed in notification bodies or payloads.
- Default: **off** until the user enables the feature and grants OS permission.

## Platforms

| Platform | Implementation |
|----------|----------------|
| Desktop (Tauri) | `tauri-plugin-notification` |
| Web | Browser `Notification` API (secure context) |
| Capacitor iOS/Android | `@capacitor/local-notifications` (channel `chaeboxi-chat` on Android) |
| Tauri Android | Same Tauri notification plugin as desktop |

### Mobile detection

- Build: `CHATBOX_BUILD_TARGET=mobile_app` (see `pnpm mobile:ios` / `mobile:android`)
- `WebPlatform` sets `type: 'mobile'` and `formFactor: 'mobile'` for that target
- `isCapacitorMobile` is true for mobile_app builds (and never under Tauri)
- App active state uses Capacitor `App.appStateChange` when available

## Settings

Settings → **System Notifications** (`extension.notifications`):

- `enabled` — master toggle (default `false`)
- `notifyOnGenerationComplete` — reply finished
- `notifyOnRoomComplete` — multi-agent discuss/work/swarm pipeline finished
- `notifyOnUpdateAvailable` — update downloaded

## Behavior

- Suppressed when the app window is focused / active
- Deduplicated (~30s) by kind + session + message id
- Permission is requested only when the user enables the feature (not on first launch)
- Click (desktop/web) navigates to the related session when `sessionId` is present

## Architecture

- Policy: `src/renderer/packages/notifications/`
- Platform contract: `Platform.getSystemNotificationPermission` / `request…` / `show…`
- Triggers: generation finalize, multi-agent pipeline end, update-downloaded

## Out of scope (still deferred)

- **Remote push** (APNs / FCM / Web Push to a server when the process is fully killed)
- Self-hosted push relay / device token registry
- Message snippets in banners
- Quiet hours / custom sounds
- Marketing or system announcement channels

Remote push needs a product decision (who hosts the server, privacy model). Local notifications cover unfocused / tray / background while the app process is alive.
