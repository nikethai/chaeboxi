import { Stack, Text } from '@mantine/core'
import type { LocalUsageSnapshot } from '@shared/providers/usage'
import { formatNumber } from '@shared/utils'
import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { formatCost } from '@/packages/cost-tracking'

export const LocalUsageBreakdown: FC<{
  local: LocalUsageSnapshot
  showModels?: boolean
}> = ({ local, showModels = true }) => {
  const { t } = useTranslation()
  const total = local.inputTokens + local.outputTokens

  return (
    <Stack gap={4}>
      <Text size="sm" className="font-mono">
        {formatNumber(total)} {t('tokens')}
        <Text span size="xs" c="dimmed" ml={6}>
          ↑{formatNumber(local.inputTokens)} ↓{formatNumber(local.outputTokens)}
        </Text>
      </Text>
      {local.estimatedCostUsd > 0 && (
        <Text size="xs" c="dimmed">
          {t('Est. cost')}: {formatCost(local.estimatedCostUsd)} · {local.messageCount}{' '}
          {t('messages')}
        </Text>
      )}
      {local.estimatedCostUsd === 0 && local.messageCount > 0 && (
        <Text size="xs" c="dimmed">
          {local.messageCount} {t('messages')}
        </Text>
      )}
      {showModels && local.byModel.length > 0 && (
        <div className="mt-1 space-y-0.5">
          <Text size="xs" c="dimmed" fw={600}>
            {t('Top models')}
          </Text>
          {local.byModel.slice(0, 5).map((m) => (
            <Text key={m.modelId} size="xs" className="font-mono truncate" title={m.modelId}>
              {m.modelId}: {formatNumber(m.inputTokens + m.outputTokens)}
              {m.estimatedCostUsd > 0 ? ` · ${formatCost(m.estimatedCostUsd)}` : ''}
            </Text>
          ))}
        </div>
      )}
    </Stack>
  )
}
