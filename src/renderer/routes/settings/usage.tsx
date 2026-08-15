import { Badge, Button, Flex, Loader, Progress, SegmentedControl, Stack, Text } from '@mantine/core'
import type { UsagePeriod } from '@shared/providers/usage'
import { formatNumber } from '@shared/utils'
import { IconRefresh } from '@tabler/icons-react'
import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  PriceTableSettings,
  ProviderUsageCard,
  SpendBreakdown,
  UsageBudgetSettings,
  UsageEmptyState,
} from '@/components/usage'
import { SettingsPage } from '@/components/settings/SettingsPage'
import { SettingsPageHeader } from '@/components/settings/SettingsPageHeader'
import { SettingsSection } from '@/components/settings/SettingsSection'
import { formatCost } from '@/packages/cost-tracking'
import { useAllProviderUsage, useLocalSpend, useUsageBudgetState } from '@/packages/usage-tracking'

export const Route = createFileRoute('/settings/usage')({
  component: UsageSettingsPage,
})

function SpendSummary({
  label,
  tokens,
  cost,
}: {
  label: string
  tokens: number
  cost: number
}) {
  return (
    <div>
      <Text size="xs" c="dimmed" tt="uppercase">
        {label}
      </Text>
      <Text className="font-mono" fw={600}>
        {cost > 0 ? formatCost(cost) : tokens > 0 ? `${formatNumber(tokens)} tokens` : formatCost(0)}
      </Text>
      {cost > 0 && (
        <Text size="xs" c="dimmed" className="font-mono">
          {formatNumber(tokens)} tokens
        </Text>
      )}
    </div>
  )
}

export function UsageSettingsPage() {
  const { t } = useTranslation()
  const [period, setPeriod] = useState<UsagePeriod>('calendar-month')
  const { statuses, loading, error, refresh, rebackfill, backfillProgress } =
    useAllProviderUsage(period)
  const { snapshot, byProviderModel } = useLocalSpend(period)
  const today = useLocalSpend('today')
  const month = useLocalSpend('calendar-month')
  const budgetEval = useUsageBudgetState(undefined, period)

  const hasAnyLocal = snapshot.messageCount > 0 || byProviderModel.length > 0

  const overviewTokens = useMemo(
    () => snapshot.inputTokens + snapshot.outputTokens,
    [snapshot.inputTokens, snapshot.outputTokens]
  )

  return (
    <SettingsPage>
      <SettingsPageHeader
        title={t('Usage')}
        description={t(
          'Honest local $ estimates from this app. Not a provider invoice. Airplane mode still shows the rollup already on this device.'
        )}
      />

      <SettingsSection title={t('This device')}>
        <Flex gap="lg" wrap="wrap" className="settings-card p-4 rounded-lg border border-[var(--chatbox-border-primary)]">
          <SpendSummary
            label={t('Today')}
            tokens={today.snapshot.inputTokens + today.snapshot.outputTokens}
            cost={today.snapshot.estimatedCostUsd}
          />
          <SpendSummary
            label={t('This month')}
            tokens={month.snapshot.inputTokens + month.snapshot.outputTokens}
            cost={month.snapshot.estimatedCostUsd}
          />
          <div>
            <Text size="xs" c="dimmed" tt="uppercase">
              {t('Budget')}
            </Text>
            {budgetEval.level === 'ok' ? (
              <Text size="sm" c="dimmed">
                {t('No alert')}
              </Text>
            ) : (
              <Badge size="sm" color={budgetEval.level === 'critical' ? 'red' : 'yellow'}>
                {budgetEval.message}
              </Badge>
            )}
          </div>
        </Flex>
      </SettingsSection>

      <SettingsSection title={t('Period')}>
        <Flex align="center" gap="md" wrap="wrap">
          <SegmentedControl
            value={period}
            onChange={(v) => setPeriod(v as UsagePeriod)}
            data={[
              { label: t('Today'), value: 'today' },
              { label: t('This month'), value: 'calendar-month' },
              { label: t('7 days'), value: '7d' },
              { label: t('30 days'), value: '30d' },
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

      <SettingsSection
        title={t('By provider × model')}
        description={t('Measured in this app for the selected period. Missing prices show tokens only.')}
      >
        {loading && !hasAnyLocal && statuses.length === 0 ? (
          <Flex justify="center" py="xl">
            <Loader size="sm" />
          </Flex>
        ) : error ? (
          <Text c="red" size="sm">
            {error}
          </Text>
        ) : !hasAnyLocal ? (
          <UsageEmptyState onBackfill={() => void rebackfill()} backfilling={backfillProgress != null} />
        ) : (
          <Stack gap="md">
            <div className="settings-card p-4 rounded-lg border border-[var(--chatbox-border-primary)]">
              <Flex gap="lg" wrap="wrap" mb="sm">
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase">
                    {t('Tokens')}
                  </Text>
                  <Text className="font-mono" fw={600}>
                    {formatNumber(overviewTokens)}
                  </Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase">
                    {t('Est. cost')}
                  </Text>
                  <Text className="font-mono" fw={600}>
                    {snapshot.estimatedCostUsd > 0
                      ? formatCost(snapshot.estimatedCostUsd)
                      : t('Tokens only')}
                  </Text>
                </div>
              </Flex>
              <SpendBreakdown rows={byProviderModel} />
            </div>
          </Stack>
        )}
      </SettingsSection>

      <SettingsSection
        title={t('Providers')}
        description={t('In this app = measured here. Provider plan = best-effort subscription/quota status.')}
      >
        {statuses.length === 0 ? (
          <Text size="sm" c="dimmed">
            {t('Connect a provider to see plan status. Local spend above still works offline.')}
          </Text>
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

      <SettingsSection title={t('Price table')}>
        <PriceTableSettings />
      </SettingsSection>
    </SettingsPage>
  )
}
