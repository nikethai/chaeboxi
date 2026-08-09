import { Button, Text } from '@mantine/core'
import {
  findQwenPresetByApiHost,
  getQwenPreset,
  listQwenPlansForRegion,
  type QwenPlanId,
  type QwenPlanPreset,
  type QwenRegion,
} from '@shared/providers/plan-presets'
import type { ProviderSettings } from '@shared/types'
import { IconExternalLink } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { AdaptiveSelect } from '@/components/AdaptiveSelect'
import { ScalableIcon } from '@/components/common/ScalableIcon'
import { SettingsPrefRow } from '@/components/settings/SettingsPrefRow'
import platform from '@/platform'

interface QwenPlanSelectorProps {
  providerSettings?: ProviderSettings
  setProviderSettings: (val: Partial<ProviderSettings>) => void
  /** When true, replace models with preset seed models on plan/region change */
  resetModelsOnChange?: boolean
}

function resolveFromSettings(settings?: ProviderSettings): { planId: QwenPlanId; region: QwenRegion } {
  if (settings?.planId && (settings.region === 'china' || settings.region === 'international')) {
    const preset = getQwenPreset(settings.planId, settings.region)
    if (preset) {
      return { planId: preset.planId, region: preset.region }
    }
  }
  if (settings?.planId) {
    const region: QwenRegion =
      settings.planId === 'token-plan' || settings.planId === 'coding-plan' ? 'international' : 'china'
    const preset = getQwenPreset(settings.planId, region)
    if (preset) {
      return { planId: preset.planId, region: preset.region }
    }
  }
  const byHost = findQwenPresetByApiHost(settings?.apiHost)
  if (byHost) {
    return { planId: byHost.planId, region: byHost.region }
  }
  // Default UI selection for QwenCloud users
  return { planId: 'token-plan', region: 'international' }
}

export function QwenPlanSelector({
  providerSettings,
  setProviderSettings,
  resetModelsOnChange = true,
}: QwenPlanSelectorProps) {
  const { t } = useTranslation()
  const { planId, region } = resolveFromSettings(providerSettings)
  const preset = getQwenPreset(planId, region) || listQwenPlansForRegion(region)[0]
  const plans = listQwenPlansForRegion(region)

  const applyPreset = (next: QwenPlanPreset) => {
    setProviderSettings({
      planId: next.planId,
      region: next.region,
      apiHost: next.apiHost,
      ...(resetModelsOnChange ? { models: next.models } : {}),
    })
  }

  const handleRegionChange = (value: string | null) => {
    if (value !== 'international' && value !== 'china') {
      return
    }
    const nextRegion = value as QwenRegion
    const available = listQwenPlansForRegion(nextRegion)
    // Prefer keeping same planId if available; else first plan
    const nextPlan =
      available.find((p) => p.planId === planId) || available[0] || getQwenPreset('token-plan', 'international')!
    applyPreset(nextPlan)
  }

  const handlePlanChange = (value: string | null) => {
    if (!value) {
      return
    }
    const next = getQwenPreset(value, region)
    if (next) {
      applyPreset(next)
    }
  }

  return (
    <div className="settings-card-fields">
      <SettingsPrefRow
        title={t('Region')}
        align="start"
        control={
          <AdaptiveSelect
            maw={220}
            value={region}
            onChange={handleRegionChange}
            data={[
              { value: 'international', label: t('International (QwenCloud / Singapore)') },
              { value: 'china', label: t('China (DashScope)') },
            ]}
          />
        }
      />
      <SettingsPrefRow
        title={t('How do you connect?')}
        description={preset?.description ? t(preset.description) : undefined}
        align="start"
        control={
          <AdaptiveSelect
            maw={220}
            value={planId}
            onChange={handlePlanChange}
            data={plans.map((p) => ({
              value: p.planId,
              label: t(p.name),
            }))}
          />
        }
      />
      {preset && (
        <>
          <Text size="xs" c="chatbox-tertiary">
            {t('Endpoint set for {{plan}}', { plan: t(preset.name) })}
            {': '}
            <Text span ff="monospace" size="xs">
              {preset.apiHost}
            </Text>
          </Text>
          <div className="settings-actions">
            <Button
              variant="subtle"
              size="compact-xs"
              leftSection={<ScalableIcon icon={IconExternalLink} size={14} />}
              onClick={() => platform.openLink(preset.apiKeysUrl)}
            >
              {t('Get API Key')}
            </Button>
            <Button
              variant="subtle"
              size="compact-xs"
              leftSection={<ScalableIcon icon={IconExternalLink} size={14} />}
              onClick={() => platform.openLink(preset.docsUrl)}
            >
              {t('Setup guide')}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

export function getQwenKeyLabel(providerSettings?: ProviderSettings): string {
  const { planId, region } = resolveFromSettings(providerSettings)
  const preset = getQwenPreset(planId, region)
  return preset?.isPlanKey ? 'Plan API Key' : 'API Key'
}

export function getQwenKeyPlaceholder(providerSettings?: ProviderSettings): string {
  const { planId, region } = resolveFromSettings(providerSettings)
  const preset = getQwenPreset(planId, region)
  return preset?.keyHint || ''
}

export function getQwenPresetModels(providerSettings?: ProviderSettings) {
  const { planId, region } = resolveFromSettings(providerSettings)
  return getQwenPreset(planId, region)?.models
}
