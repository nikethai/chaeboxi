import {
  emptyIntegrationsCatalog,
  type IntegrationAccount,
  type IntegrationAccountWrite,
  type IntegrationsCatalog,
  IntegrationsCatalogSchema,
} from '@shared/types/integrations'
import { normalizeDefaults, setDefaultAccount } from '@shared/integrations'
import { v4 as uuidv4 } from 'uuid'
import { createStore, useStore } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import {
  deleteIntegrationSecret,
  getIntegrationSecret,
  setIntegrationSecret,
} from '@/packages/integrations/secret-store'
import storage, { StorageKey } from '@/storage'
import { getLogger } from '@/lib/utils'

const log = getLogger('integrations-store')

type IntegrationsState = {
  ready: boolean
  catalog: IntegrationsCatalog
  lastError?: string
}

type IntegrationsActions = {
  init: () => Promise<void>
  listAccounts: (connectorId?: string) => IntegrationAccount[]
  getAccount: (id: string) => IntegrationAccount | undefined
  addAccount: (input: IntegrationAccountWrite) => Promise<IntegrationAccount>
  updateAccount: (id: string, input: Partial<IntegrationAccountWrite>) => Promise<IntegrationAccount>
  removeAccount: (id: string) => Promise<void>
  setDefault: (id: string) => Promise<void>
  markStatus: (id: string, status: IntegrationAccount['status'], lastError?: string) => Promise<void>
  touchUsed: (id: string) => Promise<void>
  /** Load secret for edit/reconnect flows only — never log. */
  peekSecret: (id: string) => Promise<Awaited<ReturnType<typeof getIntegrationSecret>>>
  exportMetadata: () => IntegrationsCatalog
  setMcpBinding: (mcpServerId: string, accountId: string | null) => Promise<void>
  setOAuthClientOverride: (
    connectorId: string,
    override: { clientId?: string; clientSecret?: string; redirectUri?: string } | null
  ) => Promise<void>
}

export type IntegrationsStore = IntegrationsState & IntegrationsActions

async function loadCatalog(): Promise<IntegrationsCatalog> {
  const raw = await storage.getItem<unknown>(StorageKey.Integrations, emptyIntegrationsCatalog())
  try {
    const parsed = IntegrationsCatalogSchema.parse(raw ?? emptyIntegrationsCatalog())
    return {
      ...parsed,
      accounts: normalizeDefaults(parsed.accounts),
    }
  } catch (err) {
    log.error('invalid integrations catalog, resetting', err)
    return emptyIntegrationsCatalog()
  }
}

async function persistCatalog(catalog: IntegrationsCatalog): Promise<void> {
  const safe = IntegrationsCatalogSchema.parse({
    version: 1,
    accounts: normalizeDefaults(catalog.accounts),
    mcpBindings: catalog.mcpBindings ?? [],
    oauthClientOverrides: catalog.oauthClientOverrides,
  })
  await storage.setItemNow(StorageKey.Integrations, safe)
}

function buildSecretFromWrite(
  accountId: string,
  input: Partial<IntegrationAccountWrite>,
  existing?: Awaited<ReturnType<typeof getIntegrationSecret>>
) {
  return {
    accountId,
    apiToken: input.apiToken ?? existing?.apiToken,
    accessToken: input.accessToken ?? existing?.accessToken,
    refreshToken: input.refreshToken ?? existing?.refreshToken,
    expiresAt: input.expiresAt ?? existing?.expiresAt,
    tokenType: input.tokenType ?? existing?.tokenType,
  }
}

export const integrationsStore = createStore<IntegrationsStore>()(
  subscribeWithSelector((set, get) => ({
    ready: false,
    catalog: emptyIntegrationsCatalog(),

    init: async () => {
      if (get().ready) return
      const catalog = await loadCatalog()
      set({ ready: true, catalog })
    },

    listAccounts: (connectorId) => {
      const accounts = get().catalog.accounts
      if (!connectorId) return accounts
      return accounts.filter((a) => a.connectorId === connectorId)
    },

    getAccount: (id) => get().catalog.accounts.find((a) => a.id === id),

    addAccount: async (input) => {
      const now = Date.now()
      const id = uuidv4()
      let account: IntegrationAccount = {
        id,
        connectorId: input.connectorId,
        label: input.label.trim(),
        accountHint: input.accountHint?.trim() || undefined,
        authType: input.authType,
        status: 'active',
        isDefault: input.isDefault,
        config: input.config ?? {},
        scopes: input.scopes,
        createdAt: now,
        updatedAt: now,
      }

      const hasSecret =
        Boolean(input.apiToken?.trim()) || Boolean(input.accessToken?.trim()) || Boolean(input.refreshToken?.trim())
      if (!hasSecret && input.authType === 'api_token') {
        throw new Error('API token is required')
      }

      if (hasSecret) {
        await setIntegrationSecret(buildSecretFromWrite(id, input))
      }

      let accounts = [...get().catalog.accounts, account]
      if (input.isDefault || accounts.filter((a) => a.connectorId === account.connectorId).length === 1) {
        accounts = setDefaultAccount(accounts, id)
        account = accounts.find((a) => a.id === id)!
      }

      const catalog = {
        ...get().catalog,
        version: 1 as const,
        accounts: normalizeDefaults(accounts),
      }
      await persistCatalog(catalog)
      set({ catalog, lastError: undefined })
      return account
    },

    updateAccount: async (id, input) => {
      const existing = get().catalog.accounts.find((a) => a.id === id)
      if (!existing) throw new Error('Account not found')

      const now = Date.now()
      let account: IntegrationAccount = {
        ...existing,
        label: input.label?.trim() ?? existing.label,
        accountHint: input.accountHint !== undefined ? input.accountHint.trim() || undefined : existing.accountHint,
        authType: input.authType ?? existing.authType,
        config: input.config ?? existing.config,
        scopes: input.scopes ?? existing.scopes,
        updatedAt: now,
        status: 'active',
        lastError: undefined,
      }

      const secretPatch =
        input.apiToken !== undefined ||
        input.accessToken !== undefined ||
        input.refreshToken !== undefined ||
        input.expiresAt !== undefined

      if (secretPatch) {
        const prev = await getIntegrationSecret(id)
        const next = buildSecretFromWrite(id, input, prev ?? undefined)
        if (next.apiToken || next.accessToken || next.refreshToken) {
          await setIntegrationSecret(next)
        }
      }

      let accounts = get().catalog.accounts.map((a) => (a.id === id ? account : a))
      if (input.isDefault === true) {
        accounts = setDefaultAccount(accounts, id)
        account = accounts.find((a) => a.id === id)!
      } else if (input.isDefault === false) {
        accounts = accounts.map((a) => (a.id === id ? { ...a, isDefault: false, updatedAt: now } : a))
        account = accounts.find((a) => a.id === id)!
      }

      const catalog = {
        ...get().catalog,
        version: 1 as const,
        accounts: normalizeDefaults(accounts),
      }
      await persistCatalog(catalog)
      set({ catalog, lastError: undefined })
      return account
    },

    removeAccount: async (id) => {
      await deleteIntegrationSecret(id)
      const accounts = get().catalog.accounts.filter((a) => a.id !== id)
      const mcpBindings = (get().catalog.mcpBindings || []).filter((b) => b.accountId !== id)
      const catalog = {
        ...get().catalog,
        version: 1 as const,
        accounts: normalizeDefaults(accounts),
        mcpBindings,
      }
      await persistCatalog(catalog)
      set({ catalog })
    },

    setDefault: async (id) => {
      const accounts = setDefaultAccount(get().catalog.accounts, id)
      const catalog = { ...get().catalog, version: 1 as const, accounts }
      await persistCatalog(catalog)
      set({ catalog })
    },

    markStatus: async (id, status, lastError) => {
      const now = Date.now()
      const accounts = get().catalog.accounts.map((a) =>
        a.id === id ? { ...a, status, lastError, updatedAt: now } : a
      )
      const catalog = { ...get().catalog, version: 1 as const, accounts }
      await persistCatalog(catalog)
      set({ catalog })
    },

    touchUsed: async (id) => {
      const now = Date.now()
      const accounts = get().catalog.accounts.map((a) => (a.id === id ? { ...a, lastUsedAt: now } : a))
      const catalog = { ...get().catalog, version: 1 as const, accounts }
      await persistCatalog(catalog)
      set({ catalog })
    },

    peekSecret: async (id) => getIntegrationSecret(id),

    exportMetadata: () => {
      const { catalog } = get()
      return {
        version: 1,
        accounts: catalog.accounts.map((a) => ({
          ...a,
          // ensure no accidental secret fields on export
        })),
        mcpBindings: catalog.mcpBindings,
        // omit oauth client secrets from casual export
        oauthClientOverrides: catalog.oauthClientOverrides
          ? Object.fromEntries(
              Object.entries(catalog.oauthClientOverrides).map(([k, v]) => [
                k,
                { clientId: v.clientId, redirectUri: v.redirectUri },
              ])
            )
          : undefined,
      }
    },

    setMcpBinding: async (mcpServerId, accountId) => {
      const catalog = get().catalog
      const rest = (catalog.mcpBindings || []).filter((b) => b.mcpServerId !== mcpServerId)
      const mcpBindings =
        accountId === null ? rest : [...rest, { mcpServerId, accountId }]
      const next = { ...catalog, version: 1 as const, mcpBindings }
      await persistCatalog(next)
      set({ catalog: next })
    },

    setOAuthClientOverride: async (connectorId, override) => {
      const catalog = get().catalog
      const oauthClientOverrides = { ...(catalog.oauthClientOverrides || {}) }
      if (override === null) {
        delete oauthClientOverrides[connectorId]
      } else {
        oauthClientOverrides[connectorId] = override
      }
      const next = { ...catalog, version: 1 as const, oauthClientOverrides }
      await persistCatalog(next)
      set({ catalog: next })
    },
  }))
)

export function useIntegrationsStore<T>(selector: (s: IntegrationsStore) => T): T {
  return useStore(integrationsStore, selector)
}

let initPromise: Promise<void> | null = null

export async function ensureIntegrationsStoreInit(): Promise<void> {
  if (integrationsStore.getState().ready) return
  if (!initPromise) {
    initPromise = integrationsStore.getState().init().finally(() => {
      initPromise = null
    })
  }
  await initPromise
}
