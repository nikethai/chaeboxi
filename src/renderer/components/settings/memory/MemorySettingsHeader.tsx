import { Switch } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { SettingsCallout } from '@/components/settings/SettingsCallout'
import { SettingsCard } from '@/components/settings/SettingsCard'
import { SettingsPageHeader } from '@/components/settings/SettingsPageHeader'
import { SettingsPrefRow } from '@/components/settings/SettingsPrefRow'
import { SettingsSection } from '@/components/settings/SettingsSection'

export type MemorySettingsHeaderProps = {
  enabled: boolean
  autoSave: boolean
  factCount: number
  injectTokens: number
  onEnabledChange: (enabled: boolean) => void
  onAutoSaveChange: (autoSave: boolean) => void
}

export function MemorySettingsHeader({
  enabled,
  autoSave,
  factCount,
  injectTokens,
  onEnabledChange,
  onAutoSaveChange,
}: MemorySettingsHeaderProps) {
  const { t } = useTranslation()

  return (
    <div className="settings-page-body settings-page-body-wide" style={{ paddingBottom: 0 }}>
      <SettingsPageHeader
        title={t('Memory')}
        description={t(
          'Long-term memory is shared across models. Global memory applies to all chats; agent memory only for that agent.'
        )}
      />

      <SettingsSection title={t('Controls')}>
        <SettingsCard divided>
          <SettingsPrefRow
            title={t('Enabled')}
            description={
              enabled
                ? t('On · {{count}} facts · ~{{tokens}} tokens', {
                    count: factCount,
                    tokens: injectTokens,
                  })
                : t('Off — models will not receive long-term facts')
            }
            control={<Switch checked={enabled} onChange={(e) => onEnabledChange(e.currentTarget.checked)} />}
          />
          <SettingsPrefRow
            title={t('Auto-save')}
            control={<Switch checked={autoSave} onChange={(e) => onAutoSaveChange(e.currentTarget.checked)} />}
          />
        </SettingsCard>
      </SettingsSection>

      {!enabled && (
        <SettingsCallout tone="neutral">
          {t('Memory is disabled. Enable it so saved facts inject into model prompts.')}
        </SettingsCallout>
      )}
    </div>
  )
}
