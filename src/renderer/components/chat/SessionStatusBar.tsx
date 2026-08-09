/**
 * SessionStatusBar — Claude Code / Codex style dock statusline.
 * Summarizes session totals under the composer; not per-message chrome.
 * Token segment opens context/compress menu (composer chip removed).
 */

import { Flex, Text, Tooltip, UnstyledButton } from '@mantine/core'
import type { Message } from '@shared/types'
import { formatNumber } from '@shared/utils'
import { useAtomValue } from 'jotai'
import { type FC, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import TokenCountMenu from '@/components/InputBox/TokenCountMenu'
import { getMemoryInjectStats } from '@/packages/memory/inject'
import { aggregateSessionCosts, formatCost } from '@/packages/cost-tracking'
import { composerTokenMenuAtom } from '@/stores/atoms/uiAtoms'
import { navigateToSettings } from '@/modals/Settings'
import { ensureMemoryStoreInit, useMemoryStore } from '@/stores/memoryStore'
import { CHATBOX_BUILD_PLATFORM } from '@/variables'

export type SessionStatusBarProps = {
  messages: Message[]
  modelLabel?: string
  generating?: boolean
  providerId?: string
  sessionId?: string
  /** Quiet bar for empty threads (model only, no msg/tok noise) */
  empty?: boolean
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

const SessionStatusBar: FC<SessionStatusBarProps> = ({
  messages,
  modelLabel,
  generating,
  providerId,
  sessionId,
  empty = false,
}) => {
  const { t } = useTranslation()
  const tokenMenu = useAtomValue(composerTokenMenuAtom)
  const memoryReady = useMemoryStore((s) => s.ready)
  const memoryEnabled = useMemoryStore((s) => s.settings.enabled)
  const globalBank = useMemoryStore((s) => s.globalBank)
  const memorySettings = useMemoryStore((s) => s.settings)

  useEffect(() => {
    void ensureMemoryStoreInit()
  }, [])

  const memoryChip = useMemo(() => {
    if (!memoryReady) return null
    const stats = getMemoryInjectStats({
      settings: memorySettings,
      globalBank,
      agentBank: null,
    })
    if (!stats.enabled) {
      return { label: t('Memory off'), title: t('Open Memory settings'), factCount: 0, on: false }
    }
    return {
      label: t('Memory on · {{count}} facts', { count: stats.factCount }),
      title:
        stats.factCount > 0
          ? t('{{count}} enabled facts will inject into model prompts (~{{tokens}} tokens)', {
              count: stats.factCount,
              tokens: stats.injectTokens,
            })
          : t('Memory enabled but empty — add facts in Settings'),
      factCount: stats.factCount,
      on: true,
    }
  }, [memoryReady, memoryEnabled, globalBank, memorySettings, t])

  const metrics = useMemo(() => aggregateSessionCosts(messages), [messages])
  const model = modelLabel || lastAssistantModel(messages) || '—'

  const totalTokens = metrics.totalInputTokens + metrics.totalOutputTokens
  const hasUsage = metrics.messagesWithUsage > 0

  const providerShort = providerId ? String(providerId) : undefined

  const menuForSession = tokenMenu && sessionId && tokenMenu.sessionId === sessionId ? tokenMenu : null

  const tokSegment = (
    <button type="button" className="session-statusline-tok" aria-label={t('Estimated Token Usage')}>
      <span className="session-statusline-key">tok</span>
      <span className="session-statusline-val">
        {hasUsage ? formatNumber(totalTokens) : menuForSession ? formatNumber(menuForSession.totalTokens) : '—'}
        {hasUsage && (
          <span className="session-statusline-muted">
            {' '}
            ↑{formatNumber(metrics.totalInputTokens)} ↓{formatNumber(metrics.totalOutputTokens)}
          </span>
        )}
      </span>
    </button>
  )

  return (
    <div className={`session-statusline${empty ? ' is-empty' : ''}`} role="status" aria-live="polite">
      <Flex className="session-statusline-inner" align="center" justify="space-between" gap="sm">
        <Flex align="center" gap={10} miw={0} className="min-w-0">
          <span className={`session-statusline-dot ${generating ? 'is-live' : ''}`} aria-hidden />
          <Text className="session-statusline-seg" lineClamp={1} title={model}>
            <span className="session-statusline-key">{t('model')}</span>
            <span className="session-statusline-val">{providerShort ? `${providerShort} · ${model}` : model}</span>
          </Text>
          {generating && (
            <Text className="session-statusline-live" size="xs">
              {t('generating')}
            </Text>
          )}
          {empty && !generating && (
            <Text className="session-statusline-muted-label" size="xs">
              {t('Ready')}
            </Text>
          )}
        </Flex>

        {!empty && (
          <Flex align="center" gap={12} className="shrink-0">
            <Tooltip label={t('Messages in this thread')} withArrow openDelay={400}>
              <Text className="session-statusline-seg">
                <span className="session-statusline-key">msg</span>
                <span className="session-statusline-val">{messages.length}</span>
              </Text>
            </Tooltip>

            {menuForSession ? (
              <TokenCountMenu
                currentInputTokens={menuForSession.currentInputTokens}
                contextTokens={menuForSession.contextTokens}
                totalTokens={menuForSession.totalTokens}
                isCalculating={menuForSession.isCalculating}
                pendingTasks={menuForSession.pendingTasks}
                totalContextMessages={menuForSession.totalContextMessages}
                contextWindow={menuForSession.contextWindow}
                currentMessageCount={menuForSession.currentMessageCount}
                maxContextMessageCount={menuForSession.maxContextMessageCount}
                onCompressClick={menuForSession.onCompressClick}
                autoCompactionEnabled={menuForSession.autoCompactionEnabled}
                isCompacting={menuForSession.isCompacting}
                contextWindowKnown={menuForSession.contextWindowKnown}
                onAutoCompactionChange={menuForSession.onAutoCompactionChange}
              >
                {tokSegment}
              </TokenCountMenu>
            ) : (
              <Tooltip
                label={
                  hasUsage
                    ? `${t('Input')}: ${formatNumber(metrics.totalInputTokens)} · ${t('Output')}: ${formatNumber(metrics.totalOutputTokens)}`
                    : t('No token usage yet')
                }
                withArrow
                openDelay={400}
              >
                <Text className="session-statusline-seg">{tokSegment}</Text>
              </Tooltip>
            )}

            {CHATBOX_BUILD_PLATFORM !== 'android' && hasUsage && metrics.actualCost > 0 && (
              <Tooltip label={t('Session cost estimate')} withArrow openDelay={400}>
                <Text className="session-statusline-seg">
                  <span className="session-statusline-key">$</span>
                  <span className="session-statusline-val">{formatCost(metrics.actualCost)}</span>
                </Text>
              </Tooltip>
            )}

            {memoryChip && (
              <Tooltip label={memoryChip.title} withArrow openDelay={300}>
                <UnstyledButton
                  type="button"
                  className="session-statusline-seg"
                  onClick={() => navigateToSettings('memory')}
                  aria-label={memoryChip.label}
                >
                  <span className="session-statusline-key">mem</span>
                  <span
                    className="session-statusline-val"
                    style={{ opacity: memoryChip.on ? 1 : 0.55 }}
                  >
                    {memoryChip.on
                      ? memoryChip.factCount > 0
                        ? t('on · {{count}}', { count: memoryChip.factCount })
                        : t('on · 0')
                      : t('off')}
                  </span>
                </UnstyledButton>
              </Tooltip>
            )}
          </Flex>
        )}

        {/* Show memory chip even on empty threads */}
        {empty && memoryChip && (
          <Tooltip label={memoryChip.title} withArrow openDelay={300}>
            <UnstyledButton
              type="button"
              className="session-statusline-seg shrink-0"
              onClick={() => navigateToSettings('memory')}
              aria-label={memoryChip.label}
            >
              <span className="session-statusline-key">mem</span>
              <span className="session-statusline-val" style={{ opacity: memoryChip.on ? 1 : 0.55 }}>
                {memoryChip.on
                  ? t('Memory on · {{count}} facts', { count: memoryChip.factCount })
                  : t('Memory off')}
              </span>
            </UnstyledButton>
          </Tooltip>
        )}
      </Flex>
    </div>
  )
}

export default SessionStatusBar
