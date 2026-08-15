import { Button, Flex, NumberInput, Stack, Switch, Text } from '@mantine/core'
import { DEFAULT_USAGE_BUDGET, type UsageBudgetConfig } from '@shared/providers/usage'
import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { SettingsCard } from '@/components/settings/SettingsCard'
import { providerUsageService } from '@/packages/usage-tracking'
import { settingsStore, useSettingsStore } from '@/stores/settingsStore'

export const UsageBudgetSettings: FC = () => {
  const { t } = useTranslation()
  const setSettings = useSettingsStore((s) => s.setSettings)
  const usageBudget = useSettingsStore((s) => s.usageBudget)
  const providers = useSettingsStore((s) => s.providers)
  const customProviders = useSettingsStore((s) => s.customProviders)
  const config: UsageBudgetConfig = usageBudget ?? DEFAULT_USAGE_BUDGET

  const update = (patch: Partial<UsageBudgetConfig>) => {
    setSettings({
      usageBudget: {
        ...DEFAULT_USAGE_BUDGET,
        ...config,
        period: 'calendar-month',
        warnAtPercent: 80,
        criticalAtPercent: 100,
        ...patch,
      },
    })
  }

  void providers
  void customProviders
  const listed = providerUsageService.listConfiguredProviders(settingsStore.getState().getSettings())

  return (
    <SettingsCard>
      <Stack gap="md">
        <div>
          <Text fw={600}>{t('Monthly budgets')}</Text>
          <Text size="sm" c="dimmed">
            {t(
              'Local estimates from this app, not a provider invoice. Soft-notify once at 80%. Optional hard-stop blocks send when the cap is exceeded.'
            )}
          </Text>
        </div>

        <Switch
          label={t('Enable monthly budgets')}
          checked={config.enabled}
          onChange={(e) => update({ enabled: e.currentTarget.checked })}
        />

        {config.enabled && (
          <>
            <NumberInput
              label={t('Global monthly cap (USD)')}
              description={t('This calendar month, all providers')}
              value={config.costLimitUsd ?? ''}
              onChange={(v) =>
                update({ costLimitUsd: typeof v === 'number' && v > 0 ? v : undefined })
              }
              min={0}
              decimalScale={2}
              prefix="$"
              placeholder={t('No cap')}
            />
            <NumberInput
              label={t('Global monthly token cap (optional)')}
              value={config.tokenLimit ?? ''}
              onChange={(v) =>
                update({ tokenLimit: typeof v === 'number' && v > 0 ? v : undefined })
              }
              min={0}
              thousandSeparator
              allowDecimal={false}
              placeholder={t('No token cap')}
            />

            <div>
              <Text size="sm" fw={600} mb={6}>
                {t('Per-provider monthly cap (optional)')}
              </Text>
              <Stack gap="sm">
                {listed.length === 0 ? (
                  <Text size="sm" c="dimmed">
                    {t('Connect a provider to set a per-provider cap.')}
                  </Text>
                ) : (
                  listed.map((p) => (
                    <NumberInput
                      key={p.id}
                      label={p.name}
                      value={config.perProvider?.[p.id]?.costLimitUsd ?? ''}
                      onChange={(v) => {
                        const next = { ...config.perProvider }
                        const costLimitUsd = typeof v === 'number' && v > 0 ? v : undefined
                        if (costLimitUsd == null) {
                          const { [p.id]: _, ...rest } = next
                          update({ perProvider: Object.keys(rest).length ? rest : undefined })
                        } else {
                          update({
                            perProvider: {
                              ...next,
                              [p.id]: { ...next[p.id], costLimitUsd },
                            },
                          })
                        }
                      }}
                      min={0}
                      decimalScale={2}
                      prefix="$"
                      placeholder={t('No cap')}
                    />
                  ))
                )}
              </Stack>
            </div>

            <Switch
              label={t('Hard-stop send when over cap')}
              description={t(
                'Off by default. When on, the composer and generation path block send at 100% of the cap. Auto-fallback to another model is not in v1.'
              )}
              checked={config.pauseWhenExceeded}
              onChange={(e) => update({ pauseWhenExceeded: e.currentTarget.checked })}
            />
            <Flex>
              <Button
                size="xs"
                variant="subtle"
                onClick={() => update({ pauseWhenExceeded: false, enabled: config.enabled })}
              >
                {t('Soft notify only (80%)')}
              </Button>
            </Flex>
          </>
        )}
      </Stack>
    </SettingsCard>
  )
}
