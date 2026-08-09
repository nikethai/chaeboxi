package com.chaeboxi

import android.os.Bundle
import android.view.View
import androidx.activity.OnBackPressedCallback
import androidx.activity.OnBackPressedDispatcher
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat

internal fun resolveImeVisibility(rootImeVisible: Boolean?, wasImeVisible: Boolean): Boolean =
  rootImeVisible ?: wasImeVisible

internal fun createImeBackCallback(
  dispatcher: OnBackPressedDispatcher,
  isImeVisible: () -> Boolean,
  dismissIme: () -> Unit,
): OnBackPressedCallback = object : OnBackPressedCallback(true) {
  override fun handleOnBackPressed() {
    if (isImeVisible()) {
      dismissIme()
      return
    }

    // Step aside only for this dispatch so the callback immediately beneath
    // us—Tauri's AppPlugin callback—retains the normal Back behavior.
    isEnabled = false
    dispatcher.onBackPressed()
    isEnabled = true
  }
}

class MainActivity : TauriActivity() {
  private var wasImeVisible: Boolean = false
  private var imeBackCallbackRegistered: Boolean = false

  private val imeBackCallback by lazy {
    createImeBackCallback(onBackPressedDispatcher, ::isImeVisible, ::dismissIme)
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)

    val root = findViewById<View>(android.R.id.content) ?: return
    ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
      val imeVisible = insets.isVisible(WindowInsetsCompat.Type.ime())
      if (wasImeVisible && !imeVisible) {
        // Ensure WebView-backed text inputs lose focus when keyboard closes via
        // system back/close-key. Some WebView builds keep focus otherwise.
        view.post { currentFocus?.clearFocus() }
      }
      wasImeVisible = imeVisible
      insets
    }
    ViewCompat.requestApplyInsets(root)
  }

  override fun onPostResume() {
    super.onPostResume()
    if (!imeBackCallbackRegistered) {
      // AndroidX dispatches the most recently added enabled callback first.
      // Tauri registers AppPlugin's callback while creating its WebView, so
      // this gets the visible-IME Back event before Tauri can finish us.
      onBackPressedDispatcher.addCallback(this, imeBackCallback)
      imeBackCallbackRegistered = true
    }
  }

  @Suppress("DEPRECATION", "OVERRIDE_DEPRECATION")
  override fun onBackPressed() {
    if (isImeVisible()) {
      dismissIme()
    } else {
      // Wry 0.54.4's native Activity destruction path races WebView work and
      // aborts on a destroyed mutex. Root Back conventionally backgrounds an
      // Android task, which preserves Tauri's WebView navigation callback
      // while avoiding that teardown.
      moveTaskToBack(true)
    }
  }

  private fun isImeVisible(): Boolean = resolveImeVisibility(
    rootImeVisible = ViewCompat.getRootWindowInsets(window.decorView)
      ?.isVisible(WindowInsetsCompat.Type.ime()),
    wasImeVisible = wasImeVisible,
  )

  private fun dismissIme() {
    WindowInsetsControllerCompat(window, window.decorView).hide(WindowInsetsCompat.Type.ime())
  }
}
