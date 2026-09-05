export type WorkspaceBrokerError = Error & { code?: string }

export function unwrapWorkspaceBroker<T>(raw: unknown): T {
  if (raw && typeof raw === 'object' && 'ok' in raw) {
    const env = raw as { ok: boolean; value?: T; error?: { code?: string; message?: string } }
    if (env.ok) {
      return env.value as T
    }
    const code = env.error?.code || 'ERROR'
    const message = env.error?.message ? `${code}: ${env.error.message}` : code
    const err = new Error(message) as WorkspaceBrokerError
    err.code = code
    throw err
  }
  return raw as T
}
