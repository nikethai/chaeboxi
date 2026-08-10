import { Badge, Button, Flex, Stack, Text } from '@mantine/core'
import type { ProviderUsageStatus } from '@shared/providers/usage'
import { IconExternalLink, IconRefresh, IconSettings } from '@tabler/icons-react'
import { Link } from '@tanstack/react-router'
import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { LocalUsageBreakdown } from './LocalUsageBreakdown'
import { QuotaMeter } from './QuotaMeter'

export const ProviderUsageCard: FC<{
  status: ProviderUsageStatus
  onRefresh?: () => void
  refreshing?: boolean
}> = ({ status, onRefresh, refreshing }) => {
  const { t } = useTranslation()

  return (
    <div className="settings-card border border-[var(--chatbox-border-primary)] rounded-lg p-4">
      <Flex justify="space-between" align="flex-start" gap="sm" wrap="wrap">
        <div className="min-w-0">
          <Flex align="center" gap="xs" wrap="wrap">
            <Text fw={600}>{status.providerName}</Text>
            {status.connected ? (
              <Badge size="xs" color="green" variant="light">
                {t('Connected')}
              </Badge>
            ) : (
              <Badge size="xs" color="gray" variant="light">
                {t('Not connected')}
              </Badge>
            )}
            {status.plan && (
              <Badge size="xs" color="indigo" variant="outline">
                {status.plan.label}
              </Badge>
            )}
            {status.quota.state === 'exhausted' && (
              <Badge size="xs" color="red" variant="filled">
                {t('Exhausted')}
              </Badge>
            )}
          </Flex>
          {status.plan?.accountHint && (
            <Text size="xs" c="dimmed" mt={2}>
              {status.plan.accountHint}
              {status.plan.authMode === 'oauth' ? ' · OAuth' : status.plan.authMode === 'api_key' ? ' · API key' : ''}
            </Text>
          )}
        </div>
        <Flex gap={6} wrap="wrap">
          {onRefresh && (
            <Button
              size="compact-xs"
              variant="subtle"
              leftSection={<IconRefresh size={14} />}
              loading={refreshing}
              onClick={onRefresh}
            >
              {t('Refresh')}
            </Button>
          )}
          <Button
            component={Link}
            to={status.links?.settingsPath ?? `/settings/provider/${status.providerId}`}
            size="compact-xs"
            variant="subtle"
            leftSection={<IconSettings size={14} />}
          >
            {t('Settings')}
          </Button>
          {status.links?.dashboardUrl && (
            <Button
              component="a"
              href={status.links.dashboardUrl}
              target="_blank"
              rel="noreferrer"
              size="compact-xs"
              variant="subtle"
              leftSection={<IconExternalLink size={14} />}
            >
              {t('Dashboard')}
            </Button>
          )}
        </Flex>
      </Flex>

      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <Stack gap={6}>
          <Text size="xs" fw={600} c="dimmed" tt="uppercase">
            {t('In this app')}
          </Text>
          <LocalUsageBreakdown local={status.local} />
        </Stack>
        <Stack gap={6}>
          <Text size="xs" fw={600} c="dimmed" tt="uppercase">
            {t('Provider plan')}
          </Text>
          <QuotaMeter quota={status.quota} />
          {status.quota.updatedAt > 0 && status.quota.state !== 'unsupported' && (
            <Text size="xs" c="dimmed">
              {t('Updated')} {new Date(status.quota.updatedAt).toLocaleString()}
            </Text>
          )}
        </Stack>
      </div>
    </div>
  )
}
