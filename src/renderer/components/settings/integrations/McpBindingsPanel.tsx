import { Stack, Text } from '@mantine/core'
import { getConnector } from '@shared/integrations'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { AdaptiveSelect } from '@/components/AdaptiveSelect'
import { SettingsCallout } from '@/components/settings/SettingsCallout'
import { useIntegrationsStore } from '@/stores/integrationsStore'
import { useMcpSettings } from '@/stores/settingsStore'

/**
 * Link MCP servers to vault accounts. Tokens inject at runtime only.
 */
export function McpBindingsPanel() {
  const { t } = useTranslation()
  const accounts = useIntegrationsStore((s) => s.catalog.accounts)
  const bindings = useIntegrationsStore((s) => s.catalog.mcpBindings) || []
  const setMcpBinding = useIntegrationsStore((s) => s.setMcpBinding)
  const mcp = useMcpSettings()
  const mcpServers = mcp?.servers || []

  const accountOptions = useMemo(
    () =>
      accounts
        .filter((a) => a.status !== 'revoked' && a.status !== 'disabled')
        .map((a) => {
          const name = getConnector(a.connectorId)?.name ?? a.connectorId
          return {
            value: a.id,
            label: `${a.label} (${name})${a.isDefault ? ' · default' : ''}`,
          }
        }),
    [accounts]
  )

  if (mcpServers.length === 0) {
    return (
      <SettingsCallout>
        <Text size="sm">
          {t(
            'Add MCP servers under Settings → MCP, then return here to power them with a connected account (no pasting tokens into env).'
          )}
        </Text>
      </SettingsCallout>
    )
  }

  if (accounts.length === 0) {
    return (
      <SettingsCallout>
        <Text size="sm">{t('Connect an account above, then bind it to an MCP server.')}</Text>
      </SettingsCallout>
    )
  }

  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">
        {t(
          'When an MCP server starts, Chaeboxi injects the linked account’s credentials into env/headers at runtime. Tokens are never written into saved MCP settings.'
        )}
      </Text>
      {mcpServers.map((server) => {
        const bound = bindings.find((b) => b.mcpServerId === server.id)?.accountId || null
        return (
          <AdaptiveSelect
            key={server.id}
            label={server.name}
            description={t('Connected account for this MCP server')}
            clearable
            data={accountOptions}
            value={bound}
            onChange={(v) => {
              void setMcpBinding(server.id, v || null)
            }}
            placeholder={t('None (use MCP config env as-is)')}
          />
        )
      })}
    </Stack>
  )
}
