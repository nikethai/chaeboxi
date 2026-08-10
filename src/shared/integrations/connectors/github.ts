import type { ConnectorDefinition } from './types'

/**
 * GitHub connected account for coding agents.
 * Auth: PAT first-class; OAuth with user-supplied client id.
 */
export const githubConnector: ConnectorDefinition = {
  id: 'github',
  name: 'GitHub',
  description: 'Connect GitHub so AI tools can open issues, PRs, and read repos as the right identity.',
  icon: 'brand-github',
  authMethods: ['api_token', 'oauth'],
  oauthEnabled: true,
  configFields: [
    {
      key: 'login',
      label: 'Username (optional)',
      description: 'GitHub login shown as account hint',
      type: 'text',
      required: false,
      placeholder: 'octocat',
    },
  ],
  runtimeBinding: {
    kind: 'mcp_env',
    envMap: {
      GITHUB_TOKEN: 'apiToken',
      GITHUB_PERSONAL_ACCESS_TOKEN: 'apiToken',
      GH_TOKEN: 'apiToken',
      GITHUB_ACCESS_TOKEN: 'accessToken',
    },
  },
  docsUrl: 'https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens',
  recommendedMcp: [
    {
      name: 'GitHub MCP',
      packageHint: 'Configure MCP with GITHUB_TOKEN / GITHUB_PERSONAL_ACCESS_TOKEN from this account',
    },
  ],
  oauth: {
    authorizationUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    scopes: ['repo', 'read:user', 'user:email'],
    redirectUri: 'http://127.0.0.1:19847/oauth/callback',
    usesPkce: false,
    requiresClientId: true,
  },
}
