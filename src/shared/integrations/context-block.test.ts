import { describe, expect, it } from 'vitest'
import type { IntegrationsCatalog } from '../types/integrations'
import { buildIntegrationsContextBlock, scrubSecretFields } from './context-block'

describe('buildIntegrationsContextBlock', () => {
  it('returns empty when no accounts', () => {
    expect(buildIntegrationsContextBlock({ version: 1, accounts: [] })).toBe('')
  })

  it('never includes token-like fields', () => {
    const catalog: IntegrationsCatalog = {
      version: 1,
      accounts: [
        {
          id: 'acc-1',
          connectorId: 'jira',
          label: 'Work Jira',
          accountHint: 'you@acme.com',
          authType: 'api_token',
          status: 'active',
          isDefault: true,
          config: { siteUrl: 'https://acme.atlassian.net' },
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    }
    const block = buildIntegrationsContextBlock(catalog)
    expect(block).toContain('Work Jira')
    expect(block).toContain('acc-1')
    expect(block).not.toMatch(/apiToken|accessToken|refreshToken|Bearer /i)
  })
})

describe('scrubSecretFields', () => {
  it('strips secret keys', () => {
    expect(
      scrubSecretFields({
        label: 'x',
        apiToken: 'secret',
        accessToken: 'a',
        siteUrl: 'https://x',
      })
    ).toEqual({ label: 'x', siteUrl: 'https://x' })
  })
})
