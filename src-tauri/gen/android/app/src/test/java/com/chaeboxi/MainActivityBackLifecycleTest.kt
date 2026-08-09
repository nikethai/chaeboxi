package com.chaeboxi

import androidx.activity.OnBackPressedCallback
import androidx.activity.OnBackPressedDispatcher
import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class MainActivityBackLifecycleTest {
  @Test
  fun `manifest delivers font scale changes to the existing Tauri activity`() {
    val manifest = File("src/main/AndroidManifest.xml").readText()
    val configChanges = Regex("""<activity\s+[\s\S]*?android:configChanges="([^"]+)"""")
      .find(manifest)
      ?.groupValues
      ?.get(1)

    assertTrue("MainActivity configChanges must include fontScale", configChanges?.split('|')?.contains("fontScale") == true)
  }

  @Test
  fun `root Back backgrounds the activity instead of calling unsafe native teardown`() {
    val activity = File("src/main/java/com/chaeboxi/MainActivity.kt").readText()

    assertTrue("MainActivity must move the root task to background", activity.contains("moveTaskToBack(true)"))
  }

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
