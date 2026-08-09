package com.chaeboxi

import androidx.activity.OnBackPressedCallback
import androidx.activity.OnBackPressedDispatcher
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class MainActivityBackLifecycleTest {
  @Test
  fun `later IME callback consumes visible IME Back before downstream Tauri callback`() {
    val dispatcher = OnBackPressedDispatcher()
    var dismissCount = 0
    var tauriBackCount = 0

    dispatcher.addCallback(object : OnBackPressedCallback(true) {
      override fun handleOnBackPressed() {
        tauriBackCount += 1
      }
    })
    val imeCallback = createImeBackCallback(dispatcher, { true }) { dismissCount += 1 }
    dispatcher.addCallback(imeCallback)

    dispatcher.onBackPressed()

    assertEquals(1, dismissCount)
    assertEquals(0, tauriBackCount)
    assertTrue(imeCallback.isEnabled)
  }

  @Test
  fun `later IME callback delegates hidden IME Back once and re-enables itself`() {
    val dispatcher = OnBackPressedDispatcher()
    var dismissCount = 0
    var tauriBackCount = 0

    dispatcher.addCallback(object : OnBackPressedCallback(true) {
      override fun handleOnBackPressed() {
        tauriBackCount += 1
      }
    })
    val imeCallback = createImeBackCallback(dispatcher, { false }) { dismissCount += 1 }
    dispatcher.addCallback(imeCallback)

    dispatcher.onBackPressed()

    assertEquals(0, dismissCount)
    assertEquals(1, tauriBackCount)
    assertTrue(imeCallback.isEnabled)
  }

  @Test
  fun `current hidden root insets override stale visible IME cache`() {
    assertEquals(false, resolveImeVisibility(rootImeVisible = false, wasImeVisible = true))
  }

  @Test
  fun `cached IME visibility is only used when root insets are unavailable`() {
    assertEquals(true, resolveImeVisibility(rootImeVisible = null, wasImeVisible = true))
  }
}
