/**
 * Desktop local OAuth callback helper (Tauri IPC → Rust TCP listener).
 * Used by Gemini Antigravity PKCE so Google redirect to localhost:51121 is captured automatically.
 */

export type LocalOAuthCallbackResult = {
  redirectUrl: string
}

function hasDesktopInvoke(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.desktopAPI?.invoke === 'function'
  } catch {
    return false
  }
}

/** True when we can bind a local callback server (desktop Tauri). */
export function canUseLocalOAuthCallback(): boolean {
  return hasDesktopInvoke()
}

/**
 * Wait for browser redirect to 127.0.0.1:port (default 51121).
 * Cancels previous listener if any. AbortSignal cancels via oauth:cancelLocalCallback.
 */
export async function waitForLocalOAuthCallback(
  options: {
    port?: number
    timeoutMs?: number
    signal?: AbortSignal
  } = {}
): Promise<LocalOAuthCallbackResult> {
  if (!hasDesktopInvoke()) {
    throw new Error('Local OAuth callback requires the desktop app')
  }

  if (options.signal?.aborted) {
    throw new Error('OAuth callback cancelled')
  }

  const port = options.port ?? 51121
  const timeoutMs = options.timeoutMs ?? 5 * 60 * 1000

  const onAbort = () => {
    void window.desktopAPI!.invoke('oauth:cancelLocalCallback').catch(() => {})
  }
  options.signal?.addEventListener('abort', onAbort, { once: true })

  try {
    const result = (await window.desktopAPI!.invoke('oauth:waitForLocalCallback', {
      port,
      timeoutMs,
    })) as LocalOAuthCallbackResult | string

    if (typeof result === 'string') {
      return { redirectUrl: result }
    }
    if (result && typeof result.redirectUrl === 'string' && result.redirectUrl) {
      return { redirectUrl: result.redirectUrl }
    }
    throw new Error('Invalid OAuth callback response from desktop')
  } finally {
    options.signal?.removeEventListener('abort', onAbort)
  }
}

export async function cancelLocalOAuthCallback(): Promise<void> {
  if (!hasDesktopInvoke()) return
  try {
    await window.desktopAPI!.invoke('oauth:cancelLocalCallback')
  } catch {
    // ignore
  }
}
