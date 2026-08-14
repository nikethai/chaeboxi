import { Flex, Text, Tooltip } from '@mantine/core'
import type { SessionSettings } from '@shared/types'
import { applyOpenAIReasoningEffort, getReasoningDropdownValue } from '@shared/utils'
import { IconInfoCircle } from '@tabler/icons-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { AdaptiveSelect } from '@/components/AdaptiveSelect'
import { ScalableIcon } from '@/components/common/ScalableIcon'
import { useProviders } from '@/hooks/useProviders'

export type ReasoningEffortSelectProps = {
  model?: {
    provider: string
    modelId: string
  }
  settings?: SessionSettings
  sessionId?: string
  compact?: boolean
  onSettingsChange?: (next: Pick<SessionSettings, 'providerOptions'>) => void
}

export default function ReasoningEffortSelect({
  model,
  settings,
  sessionId,
  compact = false,
  onSettingsChange,
}: ReasoningEffortSelectProps) {
  const { t } = useTranslation()
  const { providers } = useProviders()

  const supportsReasoning = useMemo(() => {
    if (!model) return false
    const providerInfo = providers.find((provider) => provider.id === model.provider)
    const modelInfo = (providerInfo?.models || providerInfo?.defaultSettings?.models)?.find((item) => item.modelId === model.modelId)
    return modelInfo?.capabilities?.includes('reasoning') ?? false
  }, [model, providers])

  const tooltip = useMemo(() => {
    if (!model) return t('Select a model first')
    if (!supportsReasoning) return t('Reasoning level is unavailable for this model')
    if (sessionId) return t('Changes apply to this chat session')
    return t('Used to seed new chat sessions')
  }, [model, sessionId, supportsReasoning, t])

  return (
    <Flex align="center" gap={compact ? 6 : 8} className="composer-reasoning min-w-0">
      <AdaptiveSelect
        className="composer-reasoning-select"
        value={getReasoningDropdownValue(settings)}
        onChange={(value) => {
          if (!value || !onSettingsChange) return
          onSettingsChange({
            providerOptions: applyOpenAIReasoningEffort(settings, value as 'null' | 'low' | 'medium' | 'high'),
          })
        }}
        data={[
          { label: t('Disabled'), value: 'null' },
          { label: t('Low'), value: 'low' },
          { label: t('Medium'), value: 'medium' },
          { label: t('High'), value: 'high' },
        ]}
        disabled={!supportsReasoning}
        aria-label={t('Reasoning level')}
        comboboxProps={{ withinPortal: true }}
        size="xs"
        styles={{ input: { fontSize: compact ? '0.75rem' : '0.75rem' } }}
        w={compact ? 108 : 108}
      />
      <Tooltip label={tooltip} withArrow maw={280} className="!whitespace-normal" events={{ hover: true, focus: true, touch: true }}>
        <span className="composer-reasoning-info inline-flex items-center justify-center">
          <ScalableIcon icon={IconInfoCircle} size={compact ? 16 : 16} className="text-chatbox-tint-tertiary" />
        </span>
      </Tooltip>
    </Flex>
  )
}
