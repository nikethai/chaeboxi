/**
 * Desktop shell bootstrap: tray lifecycle, screenshot attach, quick-window navigation,
 * and cross-window session sync (quick ↔ main).
 */
import { getDefaultStore } from 'jotai'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { ScreenshotImagePayload } from '@/platform/interfaces'
import platform from '@/platform'
import { router } from '@/router'
import storage from '@/storage'
import { StorageKeyGenerator } from '@/storage/StoreStorage'
import * as atoms from '@/stores/atoms'
import { invalidateAndRefetchSession, listSessionsMeta } from '@/stores/chatStore'
import { settingsStore } from '@/stores/settingsStore'
import * as toastActions from '@/stores/toastActions'

async function base64PayloadToStorageKey(payload: ScreenshotImagePayload): Promise<string> {
  const dataUrl = payload.base64.startsWith('data:')
    ? payload.base64
    : `data:${payload.mimeType || 'image/png'};base64,${payload.base64}`
  const key = StorageKeyGenerator.picture('input-box')
  await storage.setBlob(key, dataUrl)
  return key
}

async function resolveTargetSessionId(): Promise<string> {
  // Prefer current route session
  const path = router.state.location.pathname
  const match = path.match(/^\/session\/([^/]+)/)
  if (match?.[1]) {
    return match[1]
  }
  // Quick chat or elsewhere: use same cached current session as full app
  try {
    const cached = JSON.parse(localStorage.getItem('_currentSessionIdCachedAtom') || 'null') as string | null
    if (cached) {
      return cached
    }
  } catch {
    // ignore
  }
  try {
    const list = await listSessionsMeta()
    const chat = list.find((s) => !s.type || s.type === 'chat')
    if (chat?.id) {
      return chat.id
    }
  } catch {
    // ignore
  }
  return 'new'
}

export async function attachScreenshotToComposer(payload: ScreenshotImagePayload): Promise<void> {
  const sessionId = await resolveTargetSessionId()
  const key = await base64PayloadToStorageKey(payload)
  const store = getDefaultStore()
  const familyAtom = atoms.inputBoxPreConstructedMessageFamily(sessionId)
  const prev = store.get(familyAtom)
  store.set(familyAtom, {
    ...prev,
    pictureKeys: [...(prev.pictureKeys || []), key].slice(-8),
  })
}

/**
 * Call once from root layout on desktop.
 */
export function useDesktopShell() {
  const { t } = useTranslation()
  const bootstrapped = useRef(false)

  useEffect(() => {
    if (platform.type !== 'desktop') {
      return
    }

    // Register global shortcuts + shell flags after settings hydrate
    if (!bootstrapped.current) {
      bootstrapped.current = true
      const state = settingsStore.getState()
      void platform.ensureShortcutConfig(state.shortcuts)
      void platform.setKeepInTray?.(state.keepInTray !== false)
      void platform.setQuickWindowAlwaysOnTop?.(state.quickWindowAlwaysOnTop !== false)
    }

    // Route when shell asks (quick window load)
    const unsubNav = platform.onShellNavigate?.((path) => {
      void router.navigate({ to: path })
    })

    // Also honor generic navigate-to for shell
    const unsubPlatformNav = platform.onNavigate?.((path) => {
      if (path === '/quick' || path.startsWith('/session/') || path === '/') {
        void router.navigate({ to: path })
      }
    })

    // Quick window should land on /quick once label is known
    void (async () => {
      const label = await platform.getWindowLabel?.()
      if (label === 'quick' && router.state.location.pathname !== '/quick') {
        void router.navigate({ to: '/quick' })
      }
    })()

    const unsubShot = platform.onScreenshotCaptured?.(async (payload) => {
      try {
        // Ensure we are on a chat surface
        const label = await platform.getWindowLabel?.()
        if (label === 'quick' || router.state.location.pathname === '/quick') {
          if (router.state.location.pathname !== '/quick') {
            await router.navigate({ to: '/quick' })
          }
        } else {
          const sid = await resolveTargetSessionId()
          if (sid !== 'new') {
            await router.navigate({ to: `/session/${sid}` })
          } else {
            await router.navigate({ to: '/' })
          }
        }
        await attachScreenshotToComposer(payload)
        toastActions.add(t('Screenshot attached to chat'))
      } catch (err) {
        console.error('[shell] attach screenshot failed', err)
        toastActions.add(t('Failed to attach screenshot'))
      }
    })

    const unsubErr = platform.onScreenshotError?.((message) => {
      toastActions.add(message || t('Screenshot failed'))
    })

    const unsubHide = platform.onHiddenToTray?.(() => {
      const settings = settingsStore.getState()
      if (!settings.trayIntroSeen) {
        toastActions.add(
          t('Chaeboxi is still running in the menu bar. Click the icon or use the hotkey to reopen.'),
          6000
        )
        settingsStore.getState().setSettings({ trayIntroSeen: true })
      }
    })

    // Cross-window session sync: other webview wrote a session → reload from shared store
    let unsubSession: (() => void) | undefined
    let sessionListenDisposed = false
    void (async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event')
        const dispose = await listen<{ sessionId?: string | null }>('session:changed', (event) => {
          const sid = event.payload?.sessionId
          void invalidateAndRefetchSession(sid || null)
        })
        if (sessionListenDisposed) {
          dispose()
        } else {
          unsubSession = dispose
        }
      } catch {
        // non-tauri
      }
    })()

    // When this window is focused/shown again, force-refetch active session
    // (staleTime: Infinity would otherwise keep pre-hide messages forever)
    const refetchActiveSession = () => {
      const path = router.state.location.pathname
      const match = path.match(/^\/session\/([^/]+)/)
      let sid: string | null = match?.[1] || null
      if (!sid && path === '/quick') {
        try {
          sid = JSON.parse(localStorage.getItem('_currentSessionIdCachedAtom') || 'null') as string | null
        } catch {
          sid = null
        }
      }
      void invalidateAndRefetchSession(sid)
    }

    const unsubFocus = platform.onWindowFocused?.(refetchActiveSession)
    const unsubShow = platform.onWindowShow?.(refetchActiveSession)

    return () => {
      sessionListenDisposed = true
      unsubNav?.()
      unsubPlatformNav?.()
      unsubShot?.()
      unsubErr?.()
      unsubHide?.()
      unsubSession?.()
      unsubFocus?.()
      unsubShow?.()
    }
  }, [t])
}
