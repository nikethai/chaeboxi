import { describe, expect, it } from 'vitest'
import type { IntegrationAccount, IntegrationSecret } from '../types/integrations'
import { clearEnsureFreshMutexes, ensureFreshSecret, isTokenExpired } from './ensure-fresh'

const account: IntegrationAccount = {
  id: 'a1',
  connectorId: 'google_workspace',
  label: 'Work Gmail',
  authType: 'oauth',
  status: 'active',
  config: {},
  createdAt: 1,
  updatedAt: 1,
}

describe('ensureFreshSecret', () => {
  it('accepts PAT without expiry', async () => {
    clearEnsureFreshMutexes()
    const secret: IntegrationSecret = { accountId: 'a1', apiToken: 'pat' }
    const r = await ensureFreshSecret({ ...account, authType: 'api_token' }, secret)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.refreshed).toBe(false)
  })

  it('refreshes oauth near expiry once', async () => {
    clearEnsureFreshMutexes()
    const secret: IntegrationSecret = {
      accountId: 'a1',
      accessToken: 'old',
      refreshToken: 'r',
      expiresAt: Date.now() + 30_000,
    }
    const r = await ensureFreshSecret(account, secret, {
      refresh: async () => ({
        accountId: 'a1',
        accessToken: 'new',
        refreshToken: 'r',
        expiresAt: Date.now() + 3_600_000,
      }),
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.refreshed).toBe(true)
      expect(r.secret.accessToken).toBe('new')
    }
  })

  it('isTokenExpired respects skew', () => {
    const now = 1_000_000
    expect(isTokenExpired(now + 60_000, now, 120_000)).toBe(true)
    expect(isTokenExpired(now + 300_000, now, 120_000)).toBe(false)
  })
})
