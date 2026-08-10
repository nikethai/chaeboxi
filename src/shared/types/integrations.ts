import { z } from 'zod'

/** Built-in + future connector ids */
export const ConnectorIdSchema = z.string().min(1)
export type ConnectorId = z.infer<typeof ConnectorIdSchema>

export const IntegrationAuthTypeSchema = z.enum(['oauth', 'api_token'])
export type IntegrationAuthType = z.infer<typeof IntegrationAuthTypeSchema>

export const IntegrationAccountStatusSchema = z.enum([
  'active',
  'expired',
  'revoked',
  'needs_reauth',
  'disabled',
])
export type IntegrationAccountStatus = z.infer<typeof IntegrationAccountStatusSchema>

/** Non-secret account metadata (safe for app storage / export). */
export const IntegrationAccountSchema = z.object({
  id: z.string().min(1),
  connectorId: ConnectorIdSchema,
  label: z.string().min(1),
  accountHint: z.string().optional(),
  authType: IntegrationAuthTypeSchema,
  status: IntegrationAccountStatusSchema.default('active'),
  /** At most one default per connectorId (enforced by store). */
  isDefault: z.boolean().optional(),
  /** Non-secret connector config (site URL, workspace id, …). */
  config: z.record(z.string(), z.string()).default({}),
  scopes: z.array(z.string()).optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
  lastUsedAt: z.number().optional(),
  /** User-safe last error (never tokens). */
  lastError: z.string().optional(),
})
export type IntegrationAccount = z.infer<typeof IntegrationAccountSchema>

/**
 * Secrets for an account. Never put this in Settings, messages, or LLM context.
 * Stored only via secret backend (keychain / isolated secret store).
 */
export const IntegrationSecretSchema = z.object({
  accountId: z.string().min(1),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  expiresAt: z.number().optional(),
  tokenType: z.string().optional(),
  apiToken: z.string().optional(),
  extra: z.record(z.string(), z.string()).optional(),
})
export type IntegrationSecret = z.infer<typeof IntegrationSecretSchema>

/** Bind an MCP server config to a vault account for runtime env/header inject. */
export const IntegrationMcpBindingSchema = z.object({
  mcpServerId: z.string().min(1),
  accountId: z.string().min(1),
})
export type IntegrationMcpBinding = z.infer<typeof IntegrationMcpBindingSchema>

export const IntegrationsCatalogSchema = z.object({
  version: z.literal(1).default(1),
  accounts: z.array(IntegrationAccountSchema).default([]),
  /** MCP server id → account id (vault inject at start; never write tokens into MCP settings). */
  mcpBindings: z.array(IntegrationMcpBindingSchema).optional().catch(undefined),
  /** Optional per-connector OAuth client overrides (power users / OSS). */
  oauthClientOverrides: z
    .record(
      z.string(),
      z.object({
        clientId: z.string().optional(),
        clientSecret: z.string().optional(),
        redirectUri: z.string().optional(),
      })
    )
    .optional()
    .catch(undefined),
})
export type IntegrationsCatalog = z.infer<typeof IntegrationsCatalogSchema>

export function emptyIntegrationsCatalog(): IntegrationsCatalog {
  return { version: 1, accounts: [], mcpBindings: [] }
}

/** Max # credential chips per turn / session sticky set */
export const CREDENTIAL_EXPLICIT_MAX = 8

/** Input when creating/updating an account from the UI (secret optional on edit). */
export const IntegrationAccountWriteSchema = z.object({
  connectorId: ConnectorIdSchema,
  label: z.string().min(1),
  accountHint: z.string().optional(),
  authType: IntegrationAuthTypeSchema,
  isDefault: z.boolean().optional(),
  config: z.record(z.string(), z.string()).default({}),
  scopes: z.array(z.string()).optional(),
  /** PAT / API token (api_token auth). */
  apiToken: z.string().optional(),
  /** OAuth tokens when applicable. */
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  expiresAt: z.number().optional(),
  tokenType: z.string().optional(),
})
export type IntegrationAccountWrite = z.infer<typeof IntegrationAccountWriteSchema>

export type ResolveFailureCode =
  | 'not_connected'
  | 'ambiguous_account'
  | 'needs_reauth'
  | 'disabled'
  | 'not_found'

export type ResolveResult =
  | { ok: true; account: IntegrationAccount }
  | { ok: false; code: ResolveFailureCode; message: string; candidates?: IntegrationAccount[] }
