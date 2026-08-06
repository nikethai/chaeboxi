import { ActionIcon, Box, Collapse, Group, Text } from '@mantine/core'
import type { Message, MessageContentParts, MessageReasoningPart, MessageToolCallPart } from '@shared/types'
import { IconBulb, IconCircleXFilled, IconCopy, IconLoader } from '@tabler/icons-react'
import clsx from 'clsx'
import { type FC, useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Markdown from '@/components/Markdown'
import { useIsSmallScreen } from '@/hooks/useScreenChange'
import { formatElapsedTime, formatWorkedDuration, useThinkingTimer } from '@/hooks/useThinkingTimer'
import { copyToClipboard } from '@/packages/navigator'
import * as toastActions from '@/stores/toastActions'
import { ScalableIcon } from '../common/ScalableIcon'
import { ToolCallPartUI } from './ToolCallPartUI'

interface ThinkingGroupUIProps {
  message: Message
  parts: MessageContentParts
  isLastGroup: boolean
}

/**
 * Thinking group — Grok plain “Worked for Xs ›”; tools nested when expanded.
 * No bordered pill chrome.
 */
export const ThinkingGroupUI: FC<ThinkingGroupUIProps> = ({ message, parts, isLastGroup }) => {
  const { t } = useTranslation()
  const isSmallScreen = useIsSmallScreen()

  const reasoningParts = useMemo(() => parts.filter((p) => p.type === 'reasoning') as MessageReasoningPart[], [parts])
  const toolCallParts = useMemo(() => parts.filter((p) => p.type === 'tool-call') as MessageToolCallPart[], [parts])
  const toolCount = toolCallParts.length
  const toolStatusCounts = useMemo(() => {
    return toolCallParts.reduce(
      (counts, part) => {
        if (part.state === 'error') {
          counts.failed += 1
          return counts
        }
        if (part.state === 'call') {
          counts.running += 1
          return counts
        }
        counts.succeeded += 1
        return counts
      },
      { failed: 0, running: 0, succeeded: 0 }
    )
  }, [toolCallParts])
  const hasAttentionToolState = toolStatusCounts.failed > 0 || toolStatusCounts.running > 0
  const [isExpanded, setIsExpanded] = useState<boolean>(() => hasAttentionToolState)

  const lastPart = parts[parts.length - 1]
  const isThinking =
    isLastGroup &&
    message.generating === true &&
    message.contentParts &&
    message.contentParts.length > 0 &&
    message.contentParts[message.contentParts.length - 1] === lastPart

  const totalDuration = useMemo(() => {
    return reasoningParts.reduce((sum, p) => sum + (p.duration || 0), 0)
  }, [reasoningParts])

  const lastReasoningPart = reasoningParts[reasoningParts.length - 1]
  const elapsedTime = useThinkingTimer(lastReasoningPart?.startTime, isThinking || false)
  const shouldShowTimer = message.isStreamingMode === true

  const displayTime = totalDuration > 0 ? totalDuration : isThinking && elapsedTime > 0 ? elapsedTime : 0

  const allReasoningText = useMemo(() => reasoningParts.map((p) => p.text).join('\n\n'), [reasoningParts])

  const statusLine = useMemo(() => {
    if (!allReasoningText) return ''
    const first = allReasoningText
      .split(/\n+/)
      .map((l) => l.trim())
      .find((l) => l.length > 0)
    if (!first) return ''
    return first.replace(/^[#>*\-\s]+/, '').slice(0, 120)
  }, [allReasoningText])

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev)
  }, [])

  const onCopy = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation()
      if (allReasoningText) {
        copyToClipboard(allReasoningText)
        toastActions.add(t('copied to clipboard'), 2000)
      }
    },
    [allReasoningText, t]
  )

  useEffect(() => {
    if (hasAttentionToolState) {
      setIsExpanded(true)
    }
  }, [hasAttentionToolState])

  const headerLabel = useMemo(() => {
    if (isThinking) {
      return t('Working…')
    }

    const hasDuration = shouldShowTimer && displayTime > 0
    const compact = hasDuration ? formatWorkedDuration(displayTime) : null
    const durationStr = compact ? t('Worked for {{duration}}', { duration: compact }) : null

    if (toolCount > 0 && compact) {
      const key =
        toolCount === 1 ? 'Worked for {{duration}} · {{count}} tool' : 'Worked for {{duration}} · {{count}} tools'
      return t(key, {
        duration: compact,
        count: toolCount,
      })
    }

    if (toolCount > 0) {
      const key = toolCount === 1 ? 'Worked · {{count}} tool' : 'Worked · {{count}} tools'
      return t(key, { count: toolCount })
    }

    if (durationStr) {
      return durationStr
    }

    return t('Worked')
  }, [isThinking, shouldShowTimer, displayTime, toolCount, t])

  return (
    <div className={clsx('msg-worked', isSmallScreen && 'mx-0.5')}>
      <div className="msg-worked-row">
        <button type="button" className="msg-worked-toggle" onClick={toggleExpanded} aria-expanded={isExpanded}>
          <span className={clsx('msg-worked-label', isThinking && 'animate-shimmer shimmer-text')}>{headerLabel}</span>
          {/* Attention chips only — hide zero success noise when all tools succeeded */}
          {toolCount > 0 && hasAttentionToolState && (
            <Group gap={6} ml={4} wrap="nowrap" className="shrink-0">
              {toolStatusCounts.failed > 0 && (
                <Group gap={3} wrap="nowrap">
                  <ScalableIcon icon={IconCircleXFilled} size={12} color="var(--chatbox-tint-error)" />
                  <Text size="xs" fw={500} className="tabular-nums" style={{ color: 'var(--chatbox-tint-error)' }}>
                    {toolStatusCounts.failed}
                  </Text>
                </Group>
              )}
              {toolStatusCounts.running > 0 && (
                <Group gap={3} wrap="nowrap">
                  <ScalableIcon
                    icon={IconLoader}
                    size={12}
                    className="animate-spin"
                    color="var(--chatbox-tint-brand)"
                  />
                  <Text size="xs" fw={500} className="tabular-nums" style={{ color: 'var(--chatbox-tint-brand)' }}>
                    {toolStatusCounts.running}
                  </Text>
                </Group>
              )}
            </Group>
          )}
          {isThinking && elapsedTime > 0 && shouldShowTimer && (
            <span className="msg-worked-live tabular-nums">({formatElapsedTime(elapsedTime)})</span>
          )}
          <span className={clsx('msg-worked-chevron', isExpanded && 'is-open')} aria-hidden>
            ›
          </span>
        </button>
        {allReasoningText.length > 0 && (
          <ActionIcon
            variant="subtle"
            color="chatbox-secondary"
            size="sm"
            className="msg-worked-copy"
            onClick={onCopy}
            aria-label={t('Copy reasoning content')}
          >
            <ScalableIcon icon={IconCopy} size={14} />
          </ActionIcon>
        )}
      </div>

      {/* Live preview only when collapsed — expanded body is the single source of content */}
      {isThinking && !isExpanded && statusLine && (
        <div className="msg-worked-status">
          <IconBulb size={15} stroke={1.5} className="msg-worked-bulb" aria-hidden />
          <span className="msg-worked-status-text">{statusLine}</span>
        </div>
      )}

      <Collapse in={isExpanded}>
        <div className="msg-worked-body">
          {parts.map((part, index) =>
            part.type === 'reasoning' ? (
              <Box key={`group-reasoning-${index}`} className="reasoning-content" mb={toolCount > 0 ? 'xs' : 0}>
                <Markdown
                  enableLaTeXRendering={false}
                  enableMermaidRendering={false}
                  hiddenCodeCopyButton={false}
                  className={isSmallScreen ? 'text-[13px]' : 'text-sm'}
                  generating={isThinking && index === parts.length - 1}
                >
                  {part.text}
                </Markdown>
              </Box>
            ) : part.type === 'tool-call' ? (
              <Box key={`group-tool-${part.toolCallId}`} py={4}>
                <ToolCallPartUI part={part as MessageToolCallPart} />
              </Box>
            ) : null
          )}
        </div>
      </Collapse>
    </div>
  )
}
