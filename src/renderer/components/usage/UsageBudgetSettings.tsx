import { NumberInput, Stack, Switch, Text } from '@mantine/core'
import { DEFAULT_USAGE_BUDGET, type UsageBudgetConfig, type UsagePeriod } from '@shared/providers/usage'
import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { AdaptiveSelect } from '@/components/AdaptiveSelect'
import { SettingsCard } from '@/components/settings/SettingsCard'
import { useSettingsStore } from '@/stores/settingsStore'

const PERIOD_OPTIONS: { value: UsagePeriod; label: string }[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'calendar-month', label: 'This calendar month' },
]

export const UsageBudgetSettings: FC = () => {
  const { t } = useTranslation()
  // Separate selectors — never return a fresh object from the selector (infinite re-render)
  const setSettings = useSettingsStore((s) => s.setSettings)
  const usageBudget = useSettingsStore((s) => s.usageBudget)
  const config: UsageBudgetConfig = usageBudget ?? DEFAULT_USAGE_BUDGET

  const update = (patch: Partial<UsageBudgetConfig>) => {
    setSettings({
      usageBudget: {
        ...DEFAULT_USAGE_BUDGET,
        ...config,
        ...patch,
      },
    })
  }

  return (
    <SettingsCard>
      <Stack gap="md">
        <div>
          <Text fw={600}>{t('Soft budgets')}</Text>
          <Text size="sm" c="dimmed">
            {t(
              'Optional limits based on usage measured in this app. They do not replace your provider subscription limits.'
            )}
          </Text>
        </div>

        <Switch
          label={t('Enable soft budgets')}
          checked={config.enabled}
          onChange={(e) => update({ enabled: e.currentTarget.checked })}
        />

        {config.enabled && (
          <>
            <AdaptiveSelect
              label={t('Budget period')}
              value={config.period}
              onChange={(v) => v && update({ period: v as UsagePeriod })}
              data={PERIOD_OPTIONS.map((o) => ({ value: o.value, label: t(o.label) }))}
            />
            <NumberInput
              label={t('Token limit (optional)')}
              description={t('Warn when estimated tokens in this app exceed this amount')}
              value={config.tokenLimit ?? ''}
              onChange={(v) =>
                update({ tokenLimit: typeof v === 'number' && v > 0 ? v : undefined })
              }
              min={0}
              thousandSeparator
              allowDecimal={false}
              placeholder={t('No limit')}
            />
            <NumberInput
              label={t('Cost limit USD (optional)')}
              description={t('Estimated cost using built-in pricing tables')}
              value={config.costLimitUsd ?? ''}
              onChange={(v) =>
                update({ costLimitUsd: typeof v === 'number' && v > 0 ? v : undefined })
              }
              min={0}
              decimalScale={2}
              prefix="$"
              placeholder={t('No limit')}
            />
            <NumberInput
              label={t('Warn at %')}
              value={config.warnAtPercent}
              onChange={(v) => update({ warnAtPercent: typeof v === 'number' ? v : 80 })}
              min={1}
              max={100}
            />
            <NumberInput
              label={t('Critical at %')}
              value={config.criticalAtPercent}
              onChange={(v) => update({ criticalAtPercent: typeof v === 'number' ? v : 100 })}
              min={1}
              max={100}
            />
            <Switch
              label={t('Pause generation when budget exceeded')}
              description={t('Off by default. Soft warning only unless you enable this.')}
              checked={config.pauseWhenExceeded}
              onChange={(e) => update({ pauseWhenExceeded: e.currentTarget.checked })}
            />
          </>
        )}
      </Stack>
    </SettingsCard>
  )
}
