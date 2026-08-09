package com.chaeboxi

import org.junit.Assert.assertEquals
import org.junit.Test

class MainActivityBackLifecycleTest {
  @Test
  fun `visible IME dismisses it without delegating Back`() {
    var dismissCount = 0
    var delegateCount = 0

    dispatchBackForImeVisibility(
      isImeVisible = true,
      dismissIme = { dismissCount += 1 },
      delegateBack = { delegateCount += 1 },
    )

    assertEquals(1, dismissCount)
    assertEquals(0, delegateCount)
  }

  @Test
  fun `hidden IME delegates normal Back without dismissing an IME`() {
    var dismissCount = 0
    var delegateCount = 0

    dispatchBackForImeVisibility(
      isImeVisible = false,
      dismissIme = { dismissCount += 1 },
      delegateBack = { delegateCount += 1 },
    )

    assertEquals(0, dismissCount)
    assertEquals(1, delegateCount)
  }
}
