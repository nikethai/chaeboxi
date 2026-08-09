// Tauri Android safe-area setup.
//
// With enableEdgeToEdge(), the WebView draws behind Android system bars.
// Modern WebViews expose the bar sizes through CSS env(safe-area-inset-*), but
// older WebViews can resolve those values to 0px. This module makes the
// CSS/JS fallback explicit: when the top inset resolves to 0px, use standard
// Android 24px status-bar and 48px navigation-bar fallbacks. There is no
// native command because no corresponding Tauri/Rust implementation exists.

function applySafeAreaInsets() {
  const root = document.documentElement

  root.style.setProperty('--mobile-safe-area-inset-top', 'env(safe-area-inset-top, 0px)')
  root.style.setProperty('--mobile-safe-area-inset-bottom', 'env(safe-area-inset-bottom, 0px)')
  root.style.setProperty('--mobile-safe-area-inset-left', 'env(safe-area-inset-left, 0px)')
  root.style.setProperty('--mobile-safe-area-inset-right', 'env(safe-area-inset-right, 0px)')

  // Evaluate the env() value after styles are applied. If the WebView does not
  // expose safe-area insets, retain the explicit CSS/JS fallback above rather
  // than invoking an unimplemented native command.
  requestAnimationFrame(() => {
    const probe = document.createElement('div')
    probe.style.cssText =
      'position:fixed;top:0;left:0;width:0;height:env(safe-area-inset-top, 0px);pointer-events:none;visibility:hidden;'
    document.body.appendChild(probe)

    const envTop = probe.getBoundingClientRect().height
    document.body.removeChild(probe)

    if (envTop === 0) {
      // Standard Android system-bar dimensions in CSS pixels. These are only
      // used where the WebView cannot provide env(safe-area-inset-*) values.
      root.style.setProperty('--mobile-safe-area-inset-top', '24px')
      root.style.setProperty('--mobile-safe-area-inset-bottom', '48px')
    }
  })
}

applySafeAreaInsets()

export {}
