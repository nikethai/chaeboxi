import DesktopPlatform from './desktop_platform'
import type { Platform, PlatformType } from './interfaces'
import { createPlatformCapabilities } from './capabilities'
import { createTauriIPCAdapter, isTauriRuntime } from './tauri_ipc_adapter'
import TestPlatform from './test_platform'
import WebPlatform from './web_platform'
import type { DesktopIPC } from '../../shared/desktop-ipc-types'
import { CHATBOX_BUILD_PLATFORM, CHATBOX_BUILD_TARGET } from '@/variables'

function createDesktopPlatformWithFormFactor(api: DesktopIPC): DesktopPlatform {
  const p = new DesktopPlatform(api)
  if (CHATBOX_BUILD_PLATFORM === 'android') {
    p.formFactor = 'mobile'
  }
  return p
}

function initPlatform(): Platform {
  // TestPlatform
  if (process.env.NODE_ENV === 'test') {
    return new TestPlatform()
  }

  if (typeof window !== 'undefined') {
    if (window.desktopAPI) {
      return createDesktopPlatformWithFormFactor(window.desktopAPI)
    }

    if (isTauriRuntime()) {
      const tauriIPC = createTauriIPCAdapter()
      window.desktopAPI = tauriIPC
      return createDesktopPlatformWithFormFactor(tauriIPC)
    }
  }

  return new WebPlatform()
}

const platform = initPlatform()
export const platformCapabilities = createPlatformCapabilities({
  type: platform.type,
  formFactor: platform.formFactor,
  buildPlatform: CHATBOX_BUILD_PLATFORM,
})
export default platform

/**
 * True when running inside a Capacitor mobile shell (not Tauri Android).
 * Use this to guard Capacitor-only APIs (CapacitorHttp, CapacitorSQLite, SplashScreen).
 *
 * Detection order:
 * 1. Build-time mobile_app target (vite define during mobile:ios / mobile:android)
 * 2. Runtime platform.type === 'mobile' (WebPlatform sets this for mobile_app builds)
 * Never true under Tauri (including Tauri Android).
 */
export const isCapacitorMobile =
  !isTauriRuntime() && (CHATBOX_BUILD_TARGET === 'mobile_app' || platform.type === 'mobile')

/**
 * The effective platform type for API headers / server-side classification.
 * Tauri Android reports 'mobile' even though platform.type is 'desktop'.
 */
export function getEffectivePlatformType(): PlatformType {
  return platformCapabilities.isAndroidRuntime ? 'mobile' : platform.type
}
