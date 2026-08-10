import type { IntegrationAccount, IntegrationSecret } from '../types/integrations'
import type { RuntimeBindingSpec } from './connectors/types'

export type McpInjectPayload = {
  env: Record<string, string>
  headers: Record<string, string>
  accountId: string
  accountLabel: string
  connectorId: string
}

function resolveBindingValue(
  key: 'accessToken' | 'apiToken' | 'refreshToken' | `config:${string}`,
  account: IntegrationAccount,
  secret: IntegrationSecret
): string | undefined {
  if (key === 'accessToken') return secret.accessToken || secret.apiToken
  if (key === 'apiToken') return secret.apiToken || secret.accessToken
  if (key === 'refreshToken') return secret.refreshToken
  if (key.startsWith('config:')) {
    const field = key.slice('config:'.length)
    return account.config[field]
  }
  return undefined
}

function applyTemplate(
  template: string,
  account: IntegrationAccount,
  secret: IntegrationSecret
): string {
  return template.replace(/\{\{(\w+(?:\.\w+)?)\}\}/g, (_, raw: string) => {
    if (raw === 'accessToken') return secret.accessToken || secret.apiToken || ''
    if (raw === 'apiToken') return secret.apiToken || secret.accessToken || ''
    if (raw.startsWith('config.')) {
      return account.config[raw.slice('config.'.length)] || ''
    }
    return ''
  })
}

/**
 * Build MCP env/headers from connector binding + resolved secret.
 * Never logs values. Callers must not write result into persisted MCP settings.
 */
export function buildMcpInjectPayload(
  binding: RuntimeBindingSpec,
  account: IntegrationAccount,
  secret: IntegrationSecret
): McpInjectPayload {
  const env: Record<string, string> = {}
  const headers: Record<string, string> = {}

  if (binding.kind === 'mcp_env') {
    for (const [envKey, source] of Object.entries(binding.envMap)) {
      const value = resolveBindingValue(source, account, secret)
      if (value !== undefined && value !== '') {
        env[envKey] = value
      }
    }
  } else if (binding.kind === 'mcp_headers') {
    for (const [headerName, template] of Object.entries(binding.headerMap)) {
      const value = applyTemplate(template, account, secret)
      if (value) headers[headerName] = value
    }
  } else if (binding.kind === 'http_client') {
    // HTTP client bindings surface as headers when possible (Authorization).
    const token = secret.accessToken || secret.apiToken
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }
  }

  return {
    env,
    headers,
    accountId: account.id,
    accountLabel: account.label,
    connectorId: account.connectorId,
  }
}

/** Merge vault inject over static MCP transport env (vault wins for bound keys). */
export function mergeStdioEnv(
  base: Record<string, string> | undefined,
  inject: Record<string, string>
): Record<string, string> {
  return { ...(base || {}), ...inject }
}

/** Merge vault inject over static HTTP headers (vault wins). */
export function mergeHttpHeaders(
  base: Record<string, string> | undefined,
  inject: Record<string, string>
): Record<string, string> {
  return { ...(base || {}), ...inject }
}

/**
 * Scrub known secret env/header keys from an object for logging/debug.
 */
export function redactInjectForLog(payload: McpInjectPayload): {
  accountId: string
  accountLabel: string
  connectorId: string
  envKeys: string[]
  headerKeys: string[]
} {
  return {
    accountId: payload.accountId,
    accountLabel: payload.accountLabel,
    connectorId: payload.connectorId,
    envKeys: Object.keys(payload.env),
    headerKeys: Object.keys(payload.headers),
  }
}
