import type { IntegrationAccount, IntegrationsCatalog } from '../types/integrations'
import { getConnector } from './connectors'

/**
 * Build LLM-facing context for available accounts this turn.
 * Must never include tokens, refresh tokens, or API keys.
 */
export function buildIntegrationsContextBlock(
  catalog: IntegrationsCatalog,
  options?: {
    credentialIds?: string[]
    maxAccounts?: number
  }
): string {
  const max = options?.maxAccounts ?? 12
  let accounts = catalog.accounts.filter((a) => a.status !== 'disabled' && a.status !== 'revoked')

  if (options?.credentialIds && options.credentialIds.length > 0) {
    const idSet = new Set(options.credentialIds)
    accounts = accounts.filter((a) => idSet.has(a.id))
  }

  if (accounts.length === 0) {
    return ''
  }

  const lines = accounts.slice(0, max).map((a) => formatAccountLine(a))
  return [
    'Connected accounts available this turn (labels only — never request or invent tokens):',
    ...lines,
    'Use tools only with these accounts. Prefer credential_id when calling tools.',
    'If multiple accounts match a service and none is default, ask the user to pick.',
  ].join('\n')
}

function formatAccountLine(account: IntegrationAccount): string {
  const connector = getConnector(account.connectorId)
  const name = connector?.name ?? account.connectorId
  const hint = account.accountHint ? ` ${account.accountHint}` : ''
  const flags: string[] = []
  if (account.isDefault) flags.push('default')
  if (account.status !== 'active') flags.push(account.status)
  const flagStr = flags.length ? ` (${flags.join(', ')})` : ''
  return `- ${account.label} [${name}/${account.connectorId}] id=${account.id}${hint}${flagStr}`
}

/** Scrub accidental secret-like keys from a plain object (defense in depth). */
export function scrubSecretFields<T extends Record<string, unknown>>(obj: T): T {
  const banned = /^(apiToken|accessToken|refreshToken|password|secret|authorization|token)$/i
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (banned.test(k)) continue
    out[k] = v
  }
  return out as T
}
