import DesktopPlatform from './desktop_platform'
import type { Platform, PlatformType } from './interfaces'
import { createTauriIPCAdapter, isTauriRuntime } from './tauri_ipc_adapter'
import TestPlatform from './test_platform'
import WebPlatform from './web_platform'
import type { DesktopIPC } from '../../shared/desktop-ipc-types'
import { CHATBOX_BUILD_PLATFORM } from '@/variables'

function createDesktopPlatformWithFormFactor(api: DesktopIPC): DesktopPlatform {
  const p = new DesktopPlatform(api)
  if (CHATBOX_BUILD_PLATFORM === 'android') {
    p.formFactor = 'mobile'
  }
  return p
}

function initPlatform(): Platform {
  // 测试环境使用 TestPlatform
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
export default platform

/**
 * True when running inside a Capacitor mobile shell (not Tauri Android).
 * Use this to guard Capacitor-only APIs (CapacitorHttp, CapacitorSQLite, SplashScreen).
 */
export const isCapacitorMobile = platform.type === 'mobile' && !isTauriRuntime()

/**
 * The effective platform type for API headers / server-side classification.
 * Tauri Android reports 'mobile' even though platform.type is 'desktop'.
 */
export function getEffectivePlatformType(): PlatformType {
  return platform.formFactor === 'mobile' ? 'mobile' : platform.type
}
