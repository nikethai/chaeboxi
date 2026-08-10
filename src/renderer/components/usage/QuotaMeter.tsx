import { Progress, Text } from '@mantine/core'
import type { ProviderQuotaSnapshot } from '@shared/providers/usage'
import type { FC } from 'react'
import { useTranslation } from 'react-i18next'

export const QuotaMeter: FC<{ quota: ProviderQuotaSnapshot; compact?: boolean }> = ({
  quota,
  compact,
}) => {
  const { t } = useTranslation()

  if (quota.state === 'known' && quota.limit != null && quota.limit > 0) {
    const used = quota.used ?? 0
    const pct = Math.min(100, Math.round((used / quota.limit) * 100))
    const unit = quota.unit ?? 'custom'
    return (
      <div className={compact ? '' : 'space-y-1'}>
        <Progress
          value={pct}
          size={compact ? 'xs' : 'sm'}
          color={pct >= 100 ? 'red' : pct >= 80 ? 'yellow' : 'indigo'}
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t('Provider plan usage')}
        />
        {!compact && (
          <Text size="xs" c="dimmed" className="font-mono">
            {used.toLocaleString()} / {quota.limit.toLocaleString()} {unit}
            {quota.resetsAt ? ` · ${t('resets')} ${new Date(quota.resetsAt).toLocaleDateString()}` : ''}
          </Text>
        )}
      </div>
    )
  }

  if (quota.state === 'exhausted') {
    return (
      <Text size="xs" c="red" fw={600}>
        {t('Plan exhausted')}
        {quota.detail ? ` — ${quota.detail}` : ''}
      </Text>
    )
  }

  if (quota.state === 'partial') {
    const exhaustedModels = quota.models?.filter((m) => m.exhausted) ?? []
    return (
      <Text size="xs" c="dimmed">
        {exhaustedModels.length > 0
          ? t('{{count}} model(s) exhausted', { count: exhaustedModels.length })
          : quota.detail || t('Partial provider quota info')}
      </Text>
    )
  }

  if (quota.state === 'error') {
    return (
      <Text size="xs" c="orange">
        {quota.errorMessage || t('Could not load provider quota')}
      </Text>
    )
  }

  if (quota.state === 'unsupported') {
    return (
      <Text size="xs" c="dimmed">
        {t('Subscription quota not available')}
      </Text>
    )
  }

  // unknown
  return (
    <Text size="xs" c="dimmed">
      {t('Remaining unknown')}
      {!compact && quota.detail ? ` — ${quota.detail}` : ''}
    </Text>
  )
}
