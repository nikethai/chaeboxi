import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/platform/tauri_ipc_adapter', () => ({ isTauriRuntime: () => true }))
vi.mock('@/platform', () => ({
  default: {
    getStoreValue: vi.fn(async () => null),
    setStoreValue: vi.fn(async () => undefined),
    delStoreValue: vi.fn(async () => undefined),
  },
}))

import {
  deleteIntegrationSecret,
  getIntegrationSecret,
  KEYCHAIN_SERVICE,
  LEGACY_KEYCHAIN_SERVICE,
} from './secret-store'

type Opts = { service: string; account: string; secret?: string }

function fakeKeychain() {
  const items = new Map<string, string>()
  const key = (o: Opts) => `${o.service}|${o.account}`
  const invoke = vi.fn((channel: string, opts: Opts) => {
    if (channel === 'secrets:set') items.set(key(opts), opts.secret ?? '')
    if (channel === 'secrets:get') return Promise.resolve({ secret: items.get(key(opts)) ?? null })
    if (channel === 'secrets:delete') items.delete(key(opts))
    return Promise.resolve(null)
  })
  return { items, invoke }
}

const secret = { accountId: 'acc-1', accessToken: 'old-token' }
const newer = { accountId: 'acc-1', accessToken: 'new-token' }

describe('integration secrets after the rename', () => {
  let keychain: ReturnType<typeof fakeKeychain>

  beforeEach(() => {
    keychain = fakeKeychain()
    ;(globalThis as { window?: unknown }).window = { desktopAPI: { invoke: keychain.invoke } }
  })

  afterEach(() => {
    delete (globalThis as { window?: unknown }).window
  })

  it('moves a secret from the old keychain service on first read', async () => {
    keychain.items.set(`${LEGACY_KEYCHAIN_SERVICE}|acc-1`, JSON.stringify(secret))

    expect(await getIntegrationSecret('acc-1')).toEqual(secret)
    expect(keychain.items.get(`${KEYCHAIN_SERVICE}|acc-1`)).toBe(JSON.stringify(secret))
    expect(keychain.items.has(`${LEGACY_KEYCHAIN_SERVICE}|acc-1`)).toBe(false)
  })

  it('prefers the new service and leaves the old item alone', async () => {
    keychain.items.set(`${KEYCHAIN_SERVICE}|acc-1`, JSON.stringify(newer))
    keychain.items.set(`${LEGACY_KEYCHAIN_SERVICE}|acc-1`, JSON.stringify(secret))

    expect(await getIntegrationSecret('acc-1')).toEqual(newer)
    expect(keychain.items.get(`${LEGACY_KEYCHAIN_SERVICE}|acc-1`)).toBe(JSON.stringify(secret))
  })

  it('deletes from both services', async () => {
    keychain.items.set(`${KEYCHAIN_SERVICE}|acc-1`, 'new')
    keychain.items.set(`${LEGACY_KEYCHAIN_SERVICE}|acc-1`, 'old')

    await deleteIntegrationSecret('acc-1')

    expect(keychain.items.size).toBe(0)
  })
})
