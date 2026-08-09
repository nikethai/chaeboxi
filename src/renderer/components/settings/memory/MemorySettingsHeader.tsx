import { Alert, Group, Stack, Switch, Text, Title } from '@mantine/core'
import { IconInfoCircle } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'

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
    <Stack gap="sm">
      <Group justify="space-between" align="flex-start" wrap="wrap" gap="md">
        <Stack gap={4} maw={520}>
          <Title order={5} style={{ textWrap: 'balance' as const }}>
            {t('Memory')}
          </Title>
          <Text size="sm" c="chatbox-tertiary" style={{ textWrap: 'pretty' as const }}>
            {t(
              'Long-term memory is shared across models. Global memory applies to all chats; agent memory only for that agent.'
            )}
          </Text>
        </Stack>
        <Group gap="md">
          <Switch label={t('Enabled')} checked={enabled} onChange={(e) => onEnabledChange(e.currentTarget.checked)} />
          <Switch
            label={t('Auto-save')}
            checked={autoSave}
            onChange={(e) => onAutoSaveChange(e.currentTarget.checked)}
          />
        </Group>
      </Group>

      <Text size="xs" c="chatbox-secondary" className="tabular-nums">
        {enabled
          ? t('On · {{count}} facts · ~{{tokens}} tokens', {
              count: factCount,
              tokens: injectTokens,
            })
          : t('Off — models will not receive long-term facts')}
      </Text>

      {!enabled && (
        <Alert variant="light" color="gray" icon={<IconInfoCircle size={16} />} styles={{ root: { borderRadius: 11 } }}>
          <Text size="sm">{t('Memory is disabled. Enable it so saved facts inject into model prompts.')}</Text>
        </Alert>
      )}
    </Stack>
  )
}
