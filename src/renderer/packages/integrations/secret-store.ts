/**
 * Isolated secret backend for integration credentials.
 *
 * - Never writes into Settings / Integrations catalog metadata.
 * - Desktop (Tauri): prefers OS keychain via IPC when available, else isolated storage.
 * - Web / mobile: isolated platform storage keys (product-honest weaker threat model).
 */
import type { IntegrationSecret } from '@shared/types/integrations'
import { IntegrationSecretSchema } from '@shared/types/integrations'
import { isTauriRuntime } from '@/platform/tauri_ipc_adapter'
import platform from '@/platform'

const STORAGE_PREFIX = 'integration-secret:'

function storageKey(accountId: string): string {
  return `${STORAGE_PREFIX}${accountId}`
}

async function keychainSet(accountId: string, payload: string): Promise<boolean> {
  if (!isTauriRuntime() || typeof window.desktopAPI?.invoke !== 'function') return false
  try {
    await window.desktopAPI.invoke('secrets:set', {
      service: 'chaeboxi.integrations',
      account: accountId,
      secret: payload,
    })
    return true
  } catch {
    return false
  }
}

async function keychainGet(accountId: string): Promise<string | null> {
  if (!isTauriRuntime() || typeof window.desktopAPI?.invoke !== 'function') return null
  try {
    const result = (await window.desktopAPI.invoke('secrets:get', {
      service: 'chaeboxi.integrations',
      account: accountId,
    })) as { secret?: string | null } | string | null
    if (result == null) return null
    if (typeof result === 'string') return result
    return result.secret ?? null
  } catch {
    return null
  }
}

async function keychainDelete(accountId: string): Promise<boolean> {
  if (!isTauriRuntime() || typeof window.desktopAPI?.invoke !== 'function') return false
  try {
    await window.desktopAPI.invoke('secrets:delete', {
      service: 'chaeboxi.integrations',
      account: accountId,
    })
    return true
  } catch {
    return false
  }
}

export async function setIntegrationSecret(secret: IntegrationSecret): Promise<void> {
  const parsed = IntegrationSecretSchema.parse(secret)
  const payload = JSON.stringify(parsed)
  const usedKeychain = await keychainSet(parsed.accountId, payload)
  if (!usedKeychain) {
    await platform.setStoreValue(storageKey(parsed.accountId), payload)
  } else {
    // Drop any legacy storage copy after successful keychain write
    try {
      await platform.delStoreValue(storageKey(parsed.accountId))
    } catch {
      /* ignore */
    }
  }
}

export async function getIntegrationSecret(accountId: string): Promise<IntegrationSecret | null> {
  const fromKeychain = await keychainGet(accountId)
  const raw = fromKeychain ?? (await platform.getStoreValue(storageKey(accountId)))
  if (raw == null || raw === '') return null
  try {
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw
    return IntegrationSecretSchema.parse(obj)
  } catch {
    return null
  }
}

export async function deleteIntegrationSecret(accountId: string): Promise<void> {
  await keychainDelete(accountId)
  try {
    await platform.delStoreValue(storageKey(accountId))
  } catch {
    /* ignore */
  }
}

/** Whether secrets prefer OS keychain (desktop with IPC). Product copy uses this. */
export function integrationsSecretBackendLabel(): 'os_keychain' | 'isolated_storage' {
  if (isTauriRuntime() && typeof window !== 'undefined' && typeof window.desktopAPI?.invoke === 'function') {
    return 'os_keychain'
  }
  return 'isolated_storage'
}
