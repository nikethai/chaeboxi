import type { ConnectorDefinition } from './types'

/**
 * Google Workspace (Gmail / Drive / Calendar scope packs).
 * OAuth-first on desktop; PAT not applicable.
 */
export const googleWorkspaceConnector: ConnectorDefinition = {
  id: 'google_workspace',
  name: 'Google Workspace',
  description: 'Connect Google accounts with modular scopes (Mail, Drive, Calendar) for AI tools.',
  icon: 'brand-google',
  authMethods: ['oauth'],
  oauthEnabled: true,
  configFields: [
    {
      key: 'scopePack',
      label: 'Scope pack',
      description: 'Which Google APIs this account may use',
      type: 'select',
      required: true,
      options: [
        { value: 'mail', label: 'Gmail' },
        { value: 'drive', label: 'Drive' },
        { value: 'calendar', label: 'Calendar' },
        { value: 'mail_drive', label: 'Gmail + Drive' },
        { value: 'full', label: 'Gmail + Drive + Calendar' },
      ],
    },
  ],
  runtimeBinding: {
    kind: 'mcp_env',
    envMap: {
      GOOGLE_ACCESS_TOKEN: 'accessToken',
      GMAIL_ACCESS_TOKEN: 'accessToken',
      GOOGLE_CLIENT_EMAIL: 'config:email',
    },
  },
  docsUrl: 'https://developers.google.com/identity/protocols/oauth2',
  recommendedMcp: [
    {
      name: 'Google Workspace MCP',
      packageHint: 'Use GOOGLE_ACCESS_TOKEN from this account; prefer refresh via Integrations reconnect',
    },
  ],
  oauth: {
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: [
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/calendar',
    ],
    redirectUri: 'http://127.0.0.1:19847/oauth/callback',
    usesPkce: true,
    requiresClientId: true,
    extraAuthParams: {
      access_type: 'offline',
      prompt: 'consent',
    },
  },
  scopePacks: {
    mail: [
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/gmail.modify',
    ],
    drive: [
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/drive',
    ],
    calendar: [
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/calendar',
    ],
    mail_drive: [
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/drive',
    ],
    full: [
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/calendar',
    ],
  },
}
