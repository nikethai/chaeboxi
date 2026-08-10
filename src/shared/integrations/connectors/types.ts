import type { ConnectorId, IntegrationAuthType } from '../../types/integrations'

export type ConfigFieldType = 'text' | 'url' | 'email' | 'password' | 'select'

export type ConnectorConfigField = {
  key: string
  label: string
  description?: string
  type: ConfigFieldType
  required?: boolean
  placeholder?: string
  /** For select fields */
  options?: Array<{ value: string; label: string }>
}

/**
 * How a resolved secret maps into MCP env/headers at runtime (Phase 3).
 * Phase 1 stores the spec; inject is not wired yet.
 */
export type RuntimeBindingSpec =
  | {
      kind: 'mcp_env'
      /** env var name → secret field or config:field */
      envMap: Record<
        string,
        'accessToken' | 'apiToken' | 'refreshToken' | `config:${string}`
      >
    }
  | {
      kind: 'mcp_headers'
      /** header name → template with {{accessToken}} / {{apiToken}} / {{config.key}} */
      headerMap: Record<string, string>
    }
  | {
      kind: 'http_client'
      baseUrlFrom: 'config' | 'fixed'
      fixedBaseUrl?: string
      configBaseUrlKey?: string
    }

/** OAuth app metadata for desktop PKCE / code flows (no hosted broker). */
export type ConnectorOAuthSpec = {
  authorizationUrl: string
  tokenUrl: string
  scopes: string[]
  redirectUri: string
  usesPkce?: boolean
  /** When true, user must supply client id (or catalog override). */
  requiresClientId?: boolean
  /** Default public client id when product ships one (optional). */
  defaultClientId?: string
  extraAuthParams?: Record<string, string>
  userInfoUrl?: string
}

export type ConnectorDefinition = {
  id: ConnectorId
  name: string
  description: string
  /** Tabler / lucide-ish icon key for UI */
  icon: string
  authMethods: IntegrationAuthType[]
  configFields: ConnectorConfigField[]
  runtimeBinding: RuntimeBindingSpec
  /** Docs / help */
  docsUrl?: string
  /** Whether OAuth UI is enabled (Phase 4). */
  oauthEnabled?: boolean
  /** Suggested MCP packages for golden path (product docs). */
  recommendedMcp?: Array<{ name: string; packageHint: string }>
  /** OAuth endpoints when supported. */
  oauth?: ConnectorOAuthSpec
  /** Named scope packs (e.g. Google Mail / Drive / Calendar). */
  scopePacks?: Record<string, string[]>
}
