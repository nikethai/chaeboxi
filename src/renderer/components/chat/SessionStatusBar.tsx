/**
 * SessionStatusBar — Claude Code / Codex style dock statusline.
 * Summarizes session totals under the composer; not per-message chrome.
 */

import { Flex, Text, Tooltip } from '@mantine/core'
import type { Message } from '@shared/types'
import { formatNumber } from '@shared/utils'
import { useMemo, type FC } from 'react'
import { useTranslation } from 'react-i18next'
import { aggregateSessionCosts, formatCost } from '@/packages/cost-tracking'
import { CHATBOX_BUILD_PLATFORM } from '@/variables'

export type SessionStatusBarProps = {
  messages: Message[]
  modelLabel?: string
  generating?: boolean
  providerId?: string
}

function lastAssistantModel(messages: Message[]): string | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.role === 'assistant' && m.model) {
      return m.model
    }
  }
  return undefined
}

const SessionStatusBar: FC<SessionStatusBarProps> = ({ messages, modelLabel, generating, providerId }) => {
  const { t } = useTranslation()

  const metrics = useMemo(() => aggregateSessionCosts(messages), [messages])
  const model = modelLabel || lastAssistantModel(messages) || '—'

  const totalTokens = metrics.totalInputTokens + metrics.totalOutputTokens
  const hasUsage = metrics.messagesWithUsage > 0

  const providerShort = providerId ? String(providerId) : undefined

  return (
    <div className="session-statusline" role="status" aria-live="polite">
      <Flex className="session-statusline-inner" align="center" justify="space-between" gap="sm">
        <Flex align="center" gap={10} miw={0} className="min-w-0">
          <span className={`session-statusline-dot ${generating ? 'is-live' : ''}`} aria-hidden />
          <Text className="session-statusline-seg" lineClamp={1} title={model}>
            <span className="session-statusline-key">{t('model')}</span>
            <span className="session-statusline-val">
              {providerShort ? `${providerShort} · ${model}` : model}
            </span>
          </Text>
          {generating && (
            <Text className="session-statusline-live" size="xs">
              {t('generating')}
            </Text>
          )}
        </Flex>

        <Flex align="center" gap={12} className="shrink-0">
          <Tooltip label={t('Messages in this thread')} withArrow openDelay={400}>
            <Text className="session-statusline-seg">
              <span className="session-statusline-key">msg</span>
              <span className="session-statusline-val">{messages.length}</span>
            </Text>
          </Tooltip>

          <Tooltip
            label={
              hasUsage
                ? `${t('Input')}: ${formatNumber(metrics.totalInputTokens)} · ${t('Output')}: ${formatNumber(metrics.totalOutputTokens)}`
                : t('No token usage yet')
            }
            withArrow
            openDelay={400}
          >
            <Text className="session-statusline-seg">
              <span className="session-statusline-key">tok</span>
              <span className="session-statusline-val">
                {hasUsage ? formatNumber(totalTokens) : '—'}
                {hasUsage && (
                  <span className="session-statusline-muted">
                    {' '}
                    ↑{formatNumber(metrics.totalInputTokens)} ↓{formatNumber(metrics.totalOutputTokens)}
                  </span>
                )}
              </span>
            </Text>
          </Tooltip>

          {CHATBOX_BUILD_PLATFORM !== 'android' && hasUsage && metrics.actualCost > 0 && (
            <Tooltip label={t('Session cost estimate')} withArrow openDelay={400}>
              <Text className="session-statusline-seg">
                <span className="session-statusline-key">$</span>
                <span className="session-statusline-val">{formatCost(metrics.actualCost)}</span>
              </Text>
            </Tooltip>
          )}
        </Flex>
      </Flex>
    </div>
  )
}

export default SessionStatusBar
