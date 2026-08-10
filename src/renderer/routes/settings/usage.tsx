import { Badge, Button, Flex, Loader, Progress, SegmentedControl, Stack, Text } from '@mantine/core'
import type { UsagePeriod } from '@shared/providers/usage'
import { formatNumber } from '@shared/utils'
import { IconRefresh } from '@tabler/icons-react'
import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ProviderUsageCard,
  UsageBudgetSettings,
  UsageEmptyState,
} from '@/components/usage'
import { SettingsPage } from '@/components/settings/SettingsPage'
import { SettingsPageHeader } from '@/components/settings/SettingsPageHeader'
import { SettingsSection } from '@/components/settings/SettingsSection'
import { formatCost } from '@/packages/cost-tracking'
import { useAllProviderUsage } from '@/packages/usage-tracking'
import { useUsageBudgetState } from '@/packages/usage-tracking'

export const Route = createFileRoute('/settings/usage')({
  component: UsageSettingsPage,
})

export function UsageSettingsPage() {
  const { t } = useTranslation()
  const [period, setPeriod] = useState<UsagePeriod>('30d')
  const { statuses, loading, error, refresh, rebackfill, backfillProgress } =
    useAllProviderUsage(period)
  const budgetEval = useUsageBudgetState(undefined, period)

  const overview = useMemo(() => {
    let tokens = 0
    let cost = 0
    let alerts = 0
    for (const s of statuses) {
      tokens += s.local.inputTokens + s.local.outputTokens
      cost += s.local.estimatedCostUsd
      if (s.quota.state === 'exhausted') alerts++
    }
    return { tokens, cost, alerts }
  }, [statuses])

  const hasAnyLocal = statuses.some((s) => s.local.messageCount > 0)

  return (
    <SettingsPage>
      <SettingsPageHeader
        title={t('Usage')}
        description={t(
          'Track usage measured in this app and best-effort provider plan status. Remaining subscription % is only shown when a provider exposes it.'
        )}
      />

      <SettingsSection title={t('Period')}>
        <Flex align="center" gap="md" wrap="wrap">
          <SegmentedControl
            value={period}
            onChange={(v) => setPeriod(v as UsagePeriod)}
            data={[
              { label: t('7 days'), value: '7d' },
              { label: t('30 days'), value: '30d' },
              { label: t('This month'), value: 'calendar-month' },
            ]}
          />
          <Button
            size="xs"
            variant="subtle"
            leftSection={<IconRefresh size={14} />}
            loading={loading}
            onClick={() => void refresh(true)}
          >
            {t('Refresh all')}
          </Button>
          <Button size="xs" variant="subtle" onClick={() => void rebackfill()}>
            {t('Rebuild from sessions')}
          </Button>
        </Flex>
      </SettingsSection>

      {backfillProgress != null && (
        <div className="mb-4">
          <Text size="xs" c="dimmed" mb={4}>
            {t('Scanning sessions…')}
          </Text>
          <Progress value={Math.round(backfillProgress * 100)} size="sm" color="indigo" />
        </div>
      )}

      <SettingsSection title={t('Overview')}>
        <Flex gap="lg" wrap="wrap" className="settings-card p-4 rounded-lg border border-[var(--chatbox-border-primary)]">
          <div>
            <Text size="xs" c="dimmed" tt="uppercase">
              {t('Tokens (this app)')}
            </Text>
            <Text className="font-mono" fw={600}>
              {formatNumber(overview.tokens)}
            </Text>
          </div>
          <div>
            <Text size="xs" c="dimmed" tt="uppercase">
              {t('Est. cost')}
            </Text>
            <Text className="font-mono" fw={600}>
              {formatCost(overview.cost)}
            </Text>
          </div>
          <div>
            <Text size="xs" c="dimmed" tt="uppercase">
              {t('Alerts')}
            </Text>
            <Flex align="center" gap={6}>
              <Text fw={600}>{overview.alerts}</Text>
              {budgetEval.level !== 'ok' && (
                <Badge size="xs" color={budgetEval.level === 'critical' ? 'red' : 'yellow'}>
                  {budgetEval.message}
                </Badge>
              )}
            </Flex>
          </div>
        </Flex>
      </SettingsSection>

      <SettingsSection
        title={t('Providers')}
        description={t('In this app = measured here. Provider plan = best-effort subscription/quota status.')}
      >
        {loading && statuses.length === 0 ? (
          <Flex justify="center" py="xl">
            <Loader size="sm" />
          </Flex>
        ) : error ? (
          <Text c="red" size="sm">
            {error}
          </Text>
        ) : statuses.length === 0 ? (
          <UsageEmptyState onBackfill={() => void rebackfill()} backfilling={backfillProgress != null} />
        ) : !hasAnyLocal && statuses.every((s) => s.quota.state === 'unsupported' || s.quota.state === 'unknown') ? (
          <Stack gap="md">
            <UsageEmptyState onBackfill={() => void rebackfill()} backfilling={backfillProgress != null} />
            {statuses.map((s) => (
              <ProviderUsageCard
                key={s.providerId}
                status={s}
                onRefresh={() => void refresh(true)}
                refreshing={loading}
              />
            ))}
          </Stack>
        ) : (
          <Stack gap="md">
            {statuses.map((s) => (
              <ProviderUsageCard
                key={s.providerId}
                status={s}
                onRefresh={() => void refresh(true)}
                refreshing={loading}
              />
            ))}
          </Stack>
        )}
      </SettingsSection>

      <SettingsSection title={t('Budgets')}>
        <UsageBudgetSettings />
      </SettingsSection>
    </SettingsPage>
  )
}
