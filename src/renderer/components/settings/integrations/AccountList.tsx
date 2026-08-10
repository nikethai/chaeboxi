import { ActionIcon, Badge, Button, Group, Menu, Stack, Text } from '@mantine/core'
import { getConnector } from '@shared/integrations'
import type { IntegrationAccount } from '@shared/types/integrations'
import { IconDots, IconPencil, IconStar, IconStarFilled, IconTrash } from '@tabler/icons-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { SettingsCard } from '@/components/settings/SettingsCard'
import { integrationsStore } from '@/stores/integrationsStore'
import { IntegrationStatusBadge } from './status-badge'

type Props = {
  accounts: IntegrationAccount[]
  onEdit: (account: IntegrationAccount) => void
  onAdd: () => void
}

export function AccountList({ accounts, onEdit, onAdd }: Props) {
  const { t } = useTranslation()

  const grouped = useMemo(() => {
    const map = new Map<string, IntegrationAccount[]>()
    for (const a of accounts) {
      const list = map.get(a.connectorId) ?? []
      list.push(a)
      map.set(a.connectorId, list)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [accounts])

  if (accounts.length === 0) {
    return (
      <SettingsCard>
        <Stack gap="md" align="flex-start" py="lg" px="sm">
          <Text fw={600} size="lg">
            {t('Connect accounts for AI tools')}
          </Text>
          <Text c="dimmed" size="sm" maw={480}>
            {t(
              'Save Jira, Asana, Google Workspace, and GitHub accounts so the AI can use the right identity. Connect once, set a default, bind MCP servers, and tag with # in chat when you need to switch.'
            )}
          </Text>
          <Button onClick={onAdd}>{t('Connect account')}</Button>
        </Stack>
      </SettingsCard>
    )
  }

  return (
    <Stack gap="lg">
      {grouped.map(([connectorId, list]) => {
        const connector = getConnector(connectorId)
        return (
          <SettingsCard key={connectorId}>
            <Stack gap="sm">
              <Group justify="space-between">
                <div>
                  <Text fw={600}>{connector?.name ?? connectorId}</Text>
                  <Text size="xs" c="dimmed">
                    {connector?.description}
                  </Text>
                </div>
                <Button size="xs" variant="light" onClick={onAdd}>
                  {t('Add account')}
                </Button>
              </Group>

              <Stack gap="xs">
                {list.map((account) => (
                  <Group
                    key={account.id}
                    justify="space-between"
                    wrap="nowrap"
                    className="rounded-md border border-[var(--mantine-color-default-border)] px-3 py-2"
                  >
                    <Stack gap={2} style={{ minWidth: 0 }}>
                      <Group gap="xs">
                        <Text fw={500} truncate>
                          {account.label}
                        </Text>
                        {account.isDefault ? (
                          <Badge size="xs" variant="outline" leftSection={<IconStarFilled size={10} />}>
                            {t('Default')}
                          </Badge>
                        ) : null}
                        <IntegrationStatusBadge status={account.status} />
                      </Group>
                      <Text size="xs" c="dimmed" truncate>
                        {[account.accountHint, account.config?.siteUrl].filter(Boolean).join(' · ')}
                      </Text>
                      {account.lastError ? (
                        <Text size="xs" c="orange">
                          {account.lastError}
                        </Text>
                      ) : null}
                    </Stack>

                    <Menu shadow="md" width={200} position="bottom-end">
                      <Menu.Target>
                        <ActionIcon variant="subtle" aria-label={t('Account actions')}>
                          <IconDots size={16} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item leftSection={<IconPencil size={14} />} onClick={() => onEdit(account)}>
                          {t('Edit')}
                        </Menu.Item>
                        {!account.isDefault ? (
                          <Menu.Item
                            leftSection={<IconStar size={14} />}
                            onClick={() => {
                              void integrationsStore
                                .getState()
                                .setDefault(account.id)
                                .then(() => toast.success(t('Default updated')))
                            }}
                          >
                            {t('Set as default')}
                          </Menu.Item>
                        ) : null}
                        <Menu.Item
                          color="red"
                          leftSection={<IconTrash size={14} />}
                          onClick={() => {
                            if (
                              !window.confirm(
                                t('Remove “{{label}}”? The stored secret will be deleted.', {
                                  label: account.label,
                                })
                              )
                            ) {
                              return
                            }
                            void integrationsStore
                              .getState()
                              .removeAccount(account.id)
                              .then(() => toast.success(t('Account removed')))
                          }}
                        >
                          {t('Remove')}
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  </Group>
                ))}
              </Stack>
            </Stack>
          </SettingsCard>
        )
      })}
    </Stack>
  )
}
