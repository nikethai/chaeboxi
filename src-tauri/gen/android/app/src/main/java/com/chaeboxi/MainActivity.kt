package com.chaeboxi

import android.os.Bundle
import android.view.View
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

class MainActivity : TauriActivity() {
  private var wasImeVisible: Boolean = false

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
}
