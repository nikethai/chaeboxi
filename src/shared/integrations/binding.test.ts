import { describe, expect, it } from 'vitest'
import type { IntegrationAccount, IntegrationSecret } from '../types/integrations'
import { buildMcpInjectPayload, mergeStdioEnv, redactInjectForLog } from './binding'

const account: IntegrationAccount = {
  id: 'a1',
  connectorId: 'jira',
  label: 'Work Jira',
  authType: 'api_token',
  status: 'active',
  config: { siteUrl: 'https://acme.atlassian.net', email: 'u@acme.com' },
  createdAt: 1,
  updatedAt: 1,
}

const secret: IntegrationSecret = {
  accountId: 'a1',
  apiToken: 'secret-token',
}

describe('buildMcpInjectPayload', () => {
  it('maps mcp_env binding without leaking into log redact', () => {
    const payload = buildMcpInjectPayload(
      {
        kind: 'mcp_env',
        envMap: {
          JIRA_URL: 'config:siteUrl',
          JIRA_EMAIL: 'config:email',
          JIRA_API_TOKEN: 'apiToken',
        },
      },
      account,
      secret
    )
    expect(payload.env.JIRA_API_TOKEN).toBe('secret-token')
    expect(payload.env.JIRA_URL).toBe('https://acme.atlassian.net')
    const redacted = redactInjectForLog(payload)
    expect(JSON.stringify(redacted)).not.toContain('secret-token')
    expect(redacted.envKeys).toContain('JIRA_API_TOKEN')
  })

  it('merges env with vault winning', () => {
    expect(mergeStdioEnv({ JIRA_URL: 'old', KEEP: '1' }, { JIRA_URL: 'new' })).toEqual({
      JIRA_URL: 'new',
      KEEP: '1',
    })
  })
})
