import { describe, expect, it } from 'vitest'
import type { IntegrationAccount, IntegrationsCatalog } from '../types/integrations'
import { normalizeDefaults, resolveAccount, setDefaultAccount } from './resolve'

function account(partial: Partial<IntegrationAccount> & Pick<IntegrationAccount, 'id' | 'connectorId' | 'label'>): IntegrationAccount {
  return {
    authType: 'api_token',
    status: 'active',
    config: {},
    createdAt: 1,
    updatedAt: 1,
    ...partial,
  }
}

function catalog(accounts: IntegrationAccount[]): IntegrationsCatalog {
  return { version: 1, accounts }
}

describe('resolveAccount', () => {
  it('returns not_connected when empty', () => {
    const r = resolveAccount(catalog([]), { connectorId: 'jira' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('not_connected')
  })

  it('auto-picks single active account', () => {
    const a = account({ id: '1', connectorId: 'jira', label: 'Work' })
    const r = resolveAccount(catalog([a]), { connectorId: 'jira' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.account.id).toBe('1')
  })

  it('fails ambiguous when multiple and no default', () => {
    const r = resolveAccount(
      catalog([
        account({ id: '1', connectorId: 'jira', label: 'Work' }),
        account({ id: '2', connectorId: 'jira', label: 'Personal' }),
      ]),
      { connectorId: 'jira' }
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('ambiguous_account')
  })

  it('uses isDefault when multiple', () => {
    const r = resolveAccount(
      catalog([
        account({ id: '1', connectorId: 'jira', label: 'Work', isDefault: true }),
        account({ id: '2', connectorId: 'jira', label: 'Personal' }),
      ]),
      { connectorId: 'jira' }
    )
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.account.id).toBe('1')
  })

  it('prefers explicit credentialIds', () => {
    const r = resolveAccount(
      catalog([
        account({ id: '1', connectorId: 'jira', label: 'Work', isDefault: true }),
        account({ id: '2', connectorId: 'jira', label: 'Personal' }),
      ]),
      { connectorId: 'jira', credentialIds: ['2'] }
    )
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.account.id).toBe('2')
  })

  it('needs_reauth when selected is expired', () => {
    const r = resolveAccount(
      catalog([account({ id: '1', connectorId: 'jira', label: 'Work', status: 'needs_reauth' })]),
      { connectorId: 'jira' }
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('needs_reauth')
  })
})

describe('setDefaultAccount / normalizeDefaults', () => {
  it('keeps one default per connector', () => {
    const accounts = setDefaultAccount(
      [
        account({ id: '1', connectorId: 'jira', label: 'A', isDefault: true }),
        account({ id: '2', connectorId: 'jira', label: 'B' }),
        account({ id: '3', connectorId: 'asana', label: 'C', isDefault: true }),
      ],
      '2'
    )
    expect(accounts.find((a) => a.id === '2')?.isDefault).toBe(true)
    expect(accounts.find((a) => a.id === '1')?.isDefault).toBe(false)
    expect(accounts.find((a) => a.id === '3')?.isDefault).toBe(true)
  })

  it('normalizeDefaults collapses multiple defaults', () => {
    const out = normalizeDefaults([
      account({ id: '1', connectorId: 'jira', label: 'A', isDefault: true, updatedAt: 10 }),
      account({ id: '2', connectorId: 'jira', label: 'B', isDefault: true, updatedAt: 20 }),
    ])
    const defaults = out.filter((a) => a.isDefault)
    expect(defaults).toHaveLength(1)
    expect(defaults[0].id).toBe('2')
  })
})
