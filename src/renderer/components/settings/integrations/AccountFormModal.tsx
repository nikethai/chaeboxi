import { Button, Checkbox, Collapse, Modal, PasswordInput, Stack, Text, TextInput, Textarea } from '@mantine/core'
import { listConnectors, type ConnectorDefinition } from '@shared/integrations'
import type { IntegrationAccount, IntegrationAccountWrite, IntegrationAuthType } from '@shared/types/integrations'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { AdaptiveSelect } from '@/components/AdaptiveSelect'
import {
  completeConnectorOAuth,
  normalizeSiteUrl,
  startConnectorOAuth,
  testJiraConnection,
  type OAuthFlowStart,
} from '@/packages/integrations'
import { ensureIntegrationsStoreInit, integrationsStore, useIntegrationsStore } from '@/stores/integrationsStore'
import type { PkceSession } from '@shared/integrations'

type Props = {
  opened: boolean
  onClose: () => void
  /** When set, edit mode */
  account?: IntegrationAccount | null
}

export function AccountFormModal({ opened, onClose, account }: Props) {
  const { t } = useTranslation()
  const connectors = useMemo(() => listConnectors(), [])
  const oauthOverrides = useIntegrationsStore((s) => s.catalog.oauthClientOverrides)
  const [connectorId, setConnectorId] = useState(account?.connectorId ?? connectors[0]?.id ?? 'jira')
  const [authType, setAuthType] = useState<IntegrationAuthType>(account?.authType ?? 'api_token')
  const [label, setLabel] = useState(account?.label ?? '')
  const [config, setConfig] = useState<Record<string, string>>(account?.config ?? {})
  const [apiToken, setApiToken] = useState('')
  const [isDefault, setIsDefault] = useState(Boolean(account?.isDefault))
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [oauthClientId, setOauthClientId] = useState('')
  const [oauthClientSecret, setOauthClientSecret] = useState('')
  const [oauthSession, setOauthSession] = useState<PkceSession | null>(null)
  const [oauthRedirect, setOauthRedirect] = useState('')
  const [oauthStarting, setOauthStarting] = useState(false)

  const connector: ConnectorDefinition | undefined = connectors.find((c) => c.id === connectorId)
  const isEdit = Boolean(account)
  const supportsToken = connector?.authMethods.includes('api_token')
  const supportsOauth = Boolean(connector?.oauthEnabled && connector.authMethods.includes('oauth'))

  useEffect(() => {
    if (!opened) return
    setConnectorId(account?.connectorId ?? connectors[0]?.id ?? 'jira')
    setAuthType(account?.authType ?? 'api_token')
    setLabel(account?.label ?? '')
    setConfig(account?.config ?? {})
    setApiToken('')
    setIsDefault(Boolean(account?.isDefault))
    setOauthSession(null)
    setOauthRedirect('')
    const ov = oauthOverrides?.[account?.connectorId ?? connectors[0]?.id ?? 'jira']
    setOauthClientId(ov?.clientId || '')
    setOauthClientSecret(ov?.clientSecret || '')
  }, [opened, account, connectors, oauthOverrides])

  useEffect(() => {
    if (!connector) return
    if (authType === 'oauth' && !supportsOauth) setAuthType('api_token')
    if (authType === 'api_token' && !supportsToken && supportsOauth) setAuthType('oauth')
  }, [connectorId, connector, authType, supportsOauth, supportsToken])

  const setConfigField = (key: string, value: string) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }

  const buildWrite = (token: string): IntegrationAccountWrite => {
    const nextConfig = { ...config }
    if (connectorId === 'jira' && nextConfig.siteUrl) {
      nextConfig.siteUrl = normalizeSiteUrl(nextConfig.siteUrl)
    }
    return {
      connectorId,
      label: label.trim() || `${connector?.name ?? 'Account'}`,
      accountHint:
        nextConfig.email?.trim() ||
        nextConfig.login?.trim() ||
        account?.accountHint ||
        undefined,
      authType: 'api_token',
      isDefault,
      config: nextConfig,
      apiToken: token || undefined,
    }
  }

  const onTest = async () => {
    if (connectorId !== 'jira') {
      toast.message(t('Test connection is available for Jira; other services verify on first tool use.'))
      return
    }
    let token = apiToken.trim()
    if (!token && account) {
      const secret = await integrationsStore.getState().peekSecret(account.id)
      token = secret?.apiToken?.trim() || secret?.accessToken?.trim() || ''
    }
    if (!token) {
      toast.error(t('Enter an API token to test the connection.'))
      return
    }
    setTesting(true)
    try {
      const result = await testJiraConnection({
        siteUrl: config.siteUrl || '',
        email: config.email || '',
        apiToken: token,
      })
      if (result.ok) {
        toast.success(
          t('Connected as {{name}}', {
            name: result.displayName || result.emailAddress || config.email,
          })
        )
        if (!label.trim() && result.displayName) {
          setLabel(`${result.displayName} (Jira)`)
        }
      } else {
        toast.error(result.message)
      }
    } finally {
      setTesting(false)
    }
  }

  const onSaveToken = async () => {
    if (!label.trim() && !config.email && !config.login) {
      toast.error(t('Add a label for this account.'))
      return
    }
    for (const field of connector?.configFields || []) {
      if (field.required && !config[field.key]?.trim() && authType === 'api_token') {
        toast.error(t('{{field}} is required.', { field: field.label }))
        return
      }
    }
    if (!isEdit && !apiToken.trim() && authType === 'api_token') {
      toast.error(t('API token is required.'))
      return
    }

    setSaving(true)
    try {
      await ensureIntegrationsStoreInit()
      let token = apiToken.trim()
      if (!token && account) {
        const secret = await integrationsStore.getState().peekSecret(account.id)
        token = secret?.apiToken?.trim() ?? ''
      }

      if (connectorId === 'jira' && token) {
        const result = await testJiraConnection({
          siteUrl: config.siteUrl || '',
          email: config.email || '',
          apiToken: token,
        })
        if (!result.ok) {
          toast.error(result.message)
          setSaving(false)
          return
        }
      }

      const write = buildWrite(token)
      if (account) {
        await integrationsStore.getState().updateAccount(account.id, write)
        toast.success(t('Account updated'))
      } else {
        await integrationsStore.getState().addAccount(write)
        toast.success(t('Account connected'))
      }
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('Failed to save account'))
    } finally {
      setSaving(false)
    }
  }

  const onStartOAuth = async () => {
    setOauthStarting(true)
    try {
      await ensureIntegrationsStoreInit()
      if (oauthClientId.trim()) {
        await integrationsStore.getState().setOAuthClientOverride(connectorId, {
          clientId: oauthClientId.trim(),
          clientSecret: oauthClientSecret.trim() || undefined,
        })
      }
      const scopes =
        connectorId === 'google_workspace' && config.scopePack && connector?.scopePacks?.[config.scopePack]
          ? connector.scopePacks[config.scopePack]
          : undefined
      const started: OAuthFlowStart = await startConnectorOAuth({
        connectorId,
        clientId: oauthClientId.trim() || undefined,
        clientSecret: oauthClientSecret.trim() || undefined,
        scopes,
      })
      setOauthSession(started.session)
      toast.message(t('Browser opened. Sign in, then paste the redirect URL below.'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('Could not start OAuth'))
    } finally {
      setOauthStarting(false)
    }
  }

  const onCompleteOAuth = async () => {
    if (!oauthSession) {
      toast.error(t('Start OAuth first.'))
      return
    }
    setSaving(true)
    try {
      const nextConfig = { ...config }
      if (connectorId === 'jira' && nextConfig.siteUrl) {
        nextConfig.siteUrl = normalizeSiteUrl(nextConfig.siteUrl)
      }
      await completeConnectorOAuth({
        session: oauthSession,
        redirectOrCode: oauthRedirect,
        label: label.trim() || undefined,
        config: nextConfig,
        clientSecret: oauthClientSecret.trim() || undefined,
        isDefault,
      })
      toast.success(t('Account connected'))
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('OAuth failed'))
    } finally {
      setSaving(false)
    }
  }

  const authOptions = useMemo(() => {
    const opts: Array<{ value: IntegrationAuthType; label: string }> = []
    if (supportsToken) opts.push({ value: 'api_token', label: t('API token') })
    if (supportsOauth) opts.push({ value: 'oauth', label: t('OAuth (desktop)') })
    return opts
  }, [supportsToken, supportsOauth, t])

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={isEdit ? t('Edit connected account') : t('Connect account')}
      size="md"
      centered
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          {t('Tokens are stored separately from chat settings. They are never sent to the model context.')}
        </Text>

        <AdaptiveSelect
          label={t('Service')}
          data={connectors.map((c) => ({ value: c.id, label: c.name }))}
          value={connectorId}
          onChange={(v) => v && setConnectorId(v)}
          disabled={isEdit}
        />

        {authOptions.length > 1 && !isEdit ? (
          <AdaptiveSelect
            label={t('Auth method')}
            data={authOptions}
            value={authType}
            onChange={(v) => v && setAuthType(v as IntegrationAuthType)}
          />
        ) : null}

        <TextInput
          label={t('Label')}
          description={t('Shown in chat when you pick an account (e.g. Work Jira)')}
          value={label}
          onChange={(e) => setLabel(e.currentTarget.value)}
          placeholder={connector ? t('Work {{name}}', { name: connector.name }) : t('Work account')}
        />

        {(connector?.configFields || []).map((field) => {
          if (field.type === 'select' && field.options) {
            return (
              <AdaptiveSelect
                key={field.key}
                label={t(field.label)}
                description={field.description ? t(field.description) : undefined}
                data={field.options.map((o) => ({ value: o.value, label: o.label }))}
                value={config[field.key] || field.options[0]?.value || ''}
                onChange={(v) => v && setConfigField(field.key, v)}
              />
            )
          }
          return (
            <TextInput
              key={field.key}
              label={t(field.label)}
              description={field.description ? t(field.description) : undefined}
              value={config[field.key] || ''}
              onChange={(e) => setConfigField(field.key, e.currentTarget.value)}
              placeholder={field.placeholder}
              required={field.required && authType === 'api_token'}
            />
          )
        })}

        {authType === 'api_token' && supportsToken ? (
          <PasswordInput
            label={t('API token')}
            description={
              isEdit
                ? t('Leave blank to keep the current token')
                : connector?.docsUrl
                  ? t('Create a token in your {{name}} account settings', { name: connector.name })
                  : t('Paste your personal access token')
            }
            value={apiToken}
            onChange={(e) => setApiToken(e.currentTarget.value)}
            required={!isEdit}
          />
        ) : null}

        {authType === 'oauth' && supportsOauth ? (
          <Stack gap="sm">
            <Text size="sm" c="dimmed">
              {t(
                'Desktop OAuth uses your own app client id (no Chaeboxi cloud broker). After browser sign-in, paste the full redirect URL.'
              )}
            </Text>
            <TextInput
              label={t('OAuth client ID')}
              description={t('From your {{name}} developer console', { name: connector?.name || 'provider' })}
              value={oauthClientId}
              onChange={(e) => setOauthClientId(e.currentTarget.value)}
              required={connector?.oauth?.requiresClientId}
            />
            <PasswordInput
              label={t('OAuth client secret (if required)')}
              value={oauthClientSecret}
              onChange={(e) => setOauthClientSecret(e.currentTarget.value)}
            />
            <Button variant="default" loading={oauthStarting} onClick={() => void onStartOAuth()}>
              {t('Connect with OAuth')}
            </Button>
            {oauthSession ? (
              <>
                <Text size="xs" c="dimmed" style={{ wordBreak: 'break-all' }}>
                  {t('If the browser did not open:')} {oauthSession.authUrl}
                </Text>
                <Textarea
                  label={t('Paste redirect URL')}
                  description={t('Copy the full URL from the browser address bar after authorize')}
                  value={oauthRedirect}
                  onChange={(e) => setOauthRedirect(e.currentTarget.value)}
                  minRows={2}
                />
                <Button loading={saving} onClick={() => void onCompleteOAuth()}>
                  {t('Finish connect')}
                </Button>
              </>
            ) : null}
          </Stack>
        ) : null}

        <Checkbox
          label={t('Default account for this service')}
          description={t('Used automatically when you have more than one account and do not tag one in chat')}
          checked={isDefault}
          onChange={(e) => setIsDefault(e.currentTarget.checked)}
        />

        <Button variant="subtle" size="compact-sm" onClick={() => setAdvancedOpen((v) => !v)}>
          {advancedOpen ? t('Hide advanced') : t('Advanced')}
        </Button>
        <Collapse in={advancedOpen}>
          <Text size="xs" c="dimmed">
            {connector?.recommendedMcp?.[0]
              ? t('MCP tip: {{hint}}', { hint: connector.recommendedMcp[0].packageHint })
              : t('Link this account to an MCP server from the Integrations list after connecting.')}
          </Text>
          {connector?.docsUrl ? (
            <Text size="xs" c="dimmed">
              {t('Docs')}: {connector.docsUrl}
            </Text>
          ) : null}
        </Collapse>

        {authType === 'api_token' ? (
          <Stack gap="xs">
            <Button variant="default" loading={testing} onClick={() => void onTest()}>
              {t('Test connection')}
            </Button>
            <Button loading={saving} onClick={() => void onSaveToken()}>
              {isEdit ? t('Save') : t('Connect')}
            </Button>
          </Stack>
        ) : null}

        {isEdit && account?.authType === 'oauth' ? (
          <Button loading={saving} onClick={() => void onSaveToken()}>
            {t('Save label & config')}
          </Button>
        ) : null}
      </Stack>
    </Modal>
  )
}
