import type { ConnectorDefinition } from './types'

/**
 * Jira Cloud / Data Center connected account.
 * Auth Phase 1: API token (email + token + site URL).
 * OAuth (Atlassian) lands in Phase 4.
 */
export const jiraConnector: ConnectorDefinition = {
  id: 'jira',
  name: 'Jira',
  description: 'Connect one or more Jira sites so AI tools can create and manage issues as the right account.',
  icon: 'brand-jira',
  authMethods: ['api_token', 'oauth'],
  oauthEnabled: true,
  configFields: [
    {
      key: 'siteUrl',
      label: 'Site URL',
      description: 'Your Jira Cloud site, e.g. https://your-domain.atlassian.net',
      type: 'url',
      required: true,
      placeholder: 'https://your-domain.atlassian.net',
    },
    {
      key: 'email',
      label: 'Account email',
      description: 'Atlassian account email used with the API token',
      type: 'email',
      required: false,
      placeholder: 'you@company.com',
    },
    {
      key: 'cloudId',
      label: 'Cloud ID (OAuth)',
      description: 'Optional Atlassian cloud id when using OAuth',
      type: 'text',
      required: false,
    },
  ],
  runtimeBinding: {
    kind: 'mcp_env',
    envMap: {
      JIRA_URL: 'config:siteUrl',
      JIRA_HOST: 'config:siteUrl',
      JIRA_EMAIL: 'config:email',
      JIRA_API_TOKEN: 'apiToken',
      JIRA_API_MAIL: 'config:email',
      JIRA_TOKEN: 'apiToken',
      ATLASSIAN_ACCESS_TOKEN: 'accessToken',
      JIRA_OAUTH_TOKEN: 'accessToken',
    },
  },
  docsUrl: 'https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/',
  recommendedMcp: [
    {
      name: 'Atlassian / Jira MCP',
      packageHint: 'Configure MCP with JIRA_URL + JIRA_EMAIL + JIRA_API_TOKEN from this account',
    },
  ],
  oauth: {
    authorizationUrl: 'https://auth.atlassian.com/authorize',
    tokenUrl: 'https://auth.atlassian.com/oauth/token',
    scopes: ['read:jira-work', 'write:jira-work', 'read:jira-user', 'offline_access'],
    redirectUri: 'http://127.0.0.1:19847/oauth/callback',
    usesPkce: true,
    requiresClientId: true,
    extraAuthParams: {
      audience: 'api.atlassian.com',
      prompt: 'consent',
    },
  },
}
