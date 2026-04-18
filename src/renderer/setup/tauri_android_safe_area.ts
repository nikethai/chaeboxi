// Tauri Android safe area setup.
// On Android with enableEdgeToEdge(), the WebView draws behind system bars.
// env(safe-area-inset-*) may return 0px on older WebViews (Chrome < 94),
// so we also detect the status bar height via a visual check and inject
// fallback pixel values when the env() values are zero.

import { invoke } from '@tauri-apps/api/core'

function applySafeAreaInsets() {
  const root = document.documentElement

  // First, try the standard env() approach
  root.style.setProperty('--mobile-safe-area-inset-top', 'env(safe-area-inset-top, 0px)')
  root.style.setProperty('--mobile-safe-area-inset-bottom', 'env(safe-area-inset-bottom, 0px)')
  root.style.setProperty('--mobile-safe-area-inset-left', 'env(safe-area-inset-left, 0px)')
  root.style.setProperty('--mobile-safe-area-inset-right', 'env(safe-area-inset-right, 0px)')

  // After a tick, check whether env() actually resolved to a nonzero value.
  // If not, apply a fallback for the status bar.
  requestAnimationFrame(() => {
    const probe = document.createElement('div')
    probe.style.cssText =
      'position:fixed;top:0;left:0;width:0;height:env(safe-area-inset-top, 0px);pointer-events:none;visibility:hidden;'
    document.body.appendChild(probe)

    const envTop = probe.getBoundingClientRect().height
    document.body.removeChild(probe)

    if (envTop === 0) {
      // env() returned 0 — the WebView doesn't expose safe area insets.
      // Use Android status bar height from Tauri, or a sensible default (24dp).
      const dpr = window.devicePixelRatio || 1
      // 24dp is the standard Android status bar height; 48dp for bottom nav bar
      const fallbackTop = Math.round(24 * dpr) / dpr
      const fallbackBottom = Math.round(48 * dpr) / dpr

      root.style.setProperty('--mobile-safe-area-inset-top', `${fallbackTop}px`)
      root.style.setProperty('--mobile-safe-area-inset-bottom', `${fallbackBottom}px`)

      // Also try to query the actual status bar height from the Rust side
      invoke<{ top: number; bottom: number }>('get_system_bar_insets')
        .then((insets) => {
          if (insets && insets.top > 0) {
            root.style.setProperty('--mobile-safe-area-inset-top', `${insets.top}px`)
          }
          if (insets && insets.bottom > 0) {
            root.style.setProperty('--mobile-safe-area-inset-bottom', `${insets.bottom}px`)
          }
        })
        .catch(() => {
          // Tauri command not available — keep the dp-based fallback
        })
    }
  })
}

applySafeAreaInsets()
