// Tauri Android safe area setup using CSS env() variables.
// Android WebView (Chromium) supports env(safe-area-inset-*) when viewport-fit=cover is set.

function applySafeAreaInsets() {
  const root = document.documentElement
  root.style.setProperty('--mobile-safe-area-inset-top', 'env(safe-area-inset-top, 0px)')
  root.style.setProperty('--mobile-safe-area-inset-bottom', 'env(safe-area-inset-bottom, 0px)')
  root.style.setProperty('--mobile-safe-area-inset-left', 'env(safe-area-inset-left, 0px)')
  root.style.setProperty('--mobile-safe-area-inset-right', 'env(safe-area-inset-right, 0px)')
}

applySafeAreaInsets()
