import type { ConnectorDefinition } from './types'

/**
 * Asana connected account.
 * Auth: Personal Access Token first-class; OAuth when client configured.
 */
export const asanaConnector: ConnectorDefinition = {
  id: 'asana',
  name: 'Asana',
  description: 'Connect Asana workspaces so AI tools can manage tasks as the right account.',
  icon: 'brand-asana',
  authMethods: ['api_token', 'oauth'],
  oauthEnabled: true,
  configFields: [
    {
      key: 'workspaceGid',
      label: 'Workspace GID (optional)',
      description: 'Asana workspace id if you want tools scoped to one workspace',
      type: 'text',
      required: false,
      placeholder: '1234567890',
    },
  ],
  runtimeBinding: {
    kind: 'mcp_env',
    envMap: {
      ASANA_ACCESS_TOKEN: 'accessToken',
      ASANA_TOKEN: 'apiToken',
      ASANA_PAT: 'apiToken',
      ASANA_WORKSPACE: 'config:workspaceGid',
    },
  },
  docsUrl: 'https://developers.asana.com/docs/personal-access-token',
  recommendedMcp: [
    {
      name: 'Asana MCP',
      packageHint: 'Configure MCP with ASANA_ACCESS_TOKEN or ASANA_PAT from this account',
    },
  ],
  oauth: {
    authorizationUrl: 'https://app.asana.com/-/oauth_authorize',
    tokenUrl: 'https://app.asana.com/-/oauth_token',
    scopes: ['default'],
    redirectUri: 'http://127.0.0.1:19847/oauth/callback',
    usesPkce: true,
    requiresClientId: true,
  },
}
