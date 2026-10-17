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

/** Keychain service for integration secrets. */
export const KEYCHAIN_SERVICE = 'dango.integrations'
/** Service used before the rename to Dango; read once, then moved. */
export const LEGACY_KEYCHAIN_SERVICE = 'chaeboxi.integrations'

function storageKey(accountId: string): string {
  return `${STORAGE_PREFIX}${accountId}`
}

async function keychainSet(service: string, accountId: string, payload: string): Promise<boolean> {
  if (!isTauriRuntime() || typeof window.desktopAPI?.invoke !== 'function') return false
  try {
    await window.desktopAPI.invoke('secrets:set', {
      service,
      account: accountId,
      secret: payload,
    })
    return true
  } catch {
    return false
  }
}

async function keychainGet(service: string, accountId: string): Promise<string | null> {
  if (!isTauriRuntime() || typeof window.desktopAPI?.invoke !== 'function') return null
  try {
    const result = (await window.desktopAPI.invoke('secrets:get', {
      service,
      account: accountId,
    })) as { secret?: string | null } | string | null
    if (result == null) return null
    if (typeof result === 'string') return result
    return result.secret ?? null
  } catch {
    return null
  }
}

async function keychainDelete(service: string, accountId: string): Promise<boolean> {
  if (!isTauriRuntime() || typeof window.desktopAPI?.invoke !== 'function') return false
  try {
    await window.desktopAPI.invoke('secrets:delete', {
      service,
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
  const usedKeychain = await keychainSet(KEYCHAIN_SERVICE, parsed.accountId, payload)
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
  const fromKeychain = (await keychainGet(KEYCHAIN_SERVICE, accountId)) ?? (await moveLegacyKeychainSecret(accountId))
  const raw = fromKeychain ?? (await platform.getStoreValue(storageKey(accountId)))
  if (raw == null || raw === '') return null
  try {
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw
    return IntegrationSecretSchema.parse(obj)
  } catch {
    return null
  }
}

/**
 * Secrets saved before the rename live under the old keychain service. Copy
 * one to the new service the first time it is read, then remove the old item.
 * The old item is kept if the copy fails, so nothing is lost.
 */
async function moveLegacyKeychainSecret(accountId: string): Promise<string | null> {
  const legacy = await keychainGet(LEGACY_KEYCHAIN_SERVICE, accountId)
  if (legacy == null) return null
  if (await keychainSet(KEYCHAIN_SERVICE, accountId, legacy)) {
    await keychainDelete(LEGACY_KEYCHAIN_SERVICE, accountId)
  }
  return legacy
}

export async function deleteIntegrationSecret(accountId: string): Promise<void> {
  await keychainDelete(KEYCHAIN_SERVICE, accountId)
  await keychainDelete(LEGACY_KEYCHAIN_SERVICE, accountId)
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
