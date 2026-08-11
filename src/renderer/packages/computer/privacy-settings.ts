/**
 * Deep links / guidance to open OS privacy panes for computer-use permissions.
 * Pattern used by many macOS apps: explain → Open Settings → user toggles app → Recheck.
 */

export type PrivacyPane = 'screen-recording' | 'accessibility'

/** Prefer legacy security pane first — most reliable with `open` across macOS versions. */
const MAC_SCREEN_LEGACY = 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'
const MAC_ACCESSIBILITY_LEGACY =
  'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'

/** Ventura+ Privacy & Security extension (fallback). */
const MAC_SCREEN =
  'x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_ScreenCapture'
const MAC_ACCESSIBILITY =
  'x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_Accessibility'

export type OsFamily = 'Mac' | 'Windows' | 'Linux' | 'Unknown'

export function privacySettingsUrls(os: OsFamily, pane: PrivacyPane): string[] {
  if (os === 'Mac') {
    // Legacy first: works with /usr/bin/open on current macOS; modern extension second.
    return pane === 'screen-recording'
      ? [MAC_SCREEN_LEGACY, MAC_SCREEN]
      : [MAC_ACCESSIBILITY_LEGACY, MAC_ACCESSIBILITY]
  }
  if (os === 'Windows') {
    // No exact “accessibility” privacy URI; open privacy hub.
    return ['ms-settings:privacy']
  }
  return []
}

export function privacySettingsPathLabel(os: OsFamily, pane: PrivacyPane): string {
  if (os === 'Mac') {
    return pane === 'screen-recording'
      ? 'System Settings → Privacy & Security → Screen & System Audio Recording'
      : 'System Settings → Privacy & Security → Accessibility'
  }
  if (os === 'Windows') {
    return pane === 'screen-recording'
      ? 'Settings → Privacy & security → Screen recording / capture'
      : 'Settings → Accessibility (and allow app input as needed)'
  }
  if (os === 'Linux') {
    return pane === 'screen-recording'
      ? 'Install gnome-screenshot or ImageMagick; grant portal capture if prompted'
      : 'Install xdotool (experimental act)'
  }
  return 'Open your system privacy settings for this app'
}

export function permissionBadgeColor(status: string | undefined): string {
  switch ((status || '').toLowerCase()) {
    case 'granted':
      return 'green'
    case 'denied':
      return 'red'
    case 'unknown':
      return 'yellow'
    case 'unsupported':
      return 'gray'
    default:
      return 'gray'
  }
}

export function permissionLabel(status: string | undefined): string {
  switch ((status || '').toLowerCase()) {
    case 'granted':
      return 'Allowed'
    case 'denied':
      return 'Blocked'
    case 'unknown':
      return 'Required'
    case 'unsupported':
      return 'Unavailable'
    default:
      return status || 'Required'
  }
}
