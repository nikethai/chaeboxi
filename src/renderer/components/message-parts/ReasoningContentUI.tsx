import { ActionIcon, Box, Collapse, Text } from '@mantine/core'
import type { Message, MessageReasoningPart } from '@shared/types'
import { IconBulb, IconCopy } from '@tabler/icons-react'
import clsx from 'clsx'
import { type FC, useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Markdown from '@/components/Markdown'
import { useIsSmallScreen } from '@/hooks/useScreenChange'
import { formatElapsedTime, formatWorkedDuration, useThinkingTimer } from '@/hooks/useThinkingTimer'
import { ScalableIcon } from '../common/ScalableIcon'

/**
 * Reasoning chrome — Grok DNA:
 * plain “Worked for 3s ›” (no card border); expand for body + optional status line.
 */
export const ReasoningContentUI: FC<{
  message: Message
  part?: MessageReasoningPart
  onCopyReasoningContent: (content: string) => (e: React.MouseEvent<HTMLButtonElement>) => void
}> = ({ message, part, onCopyReasoningContent }) => {
  const reasoningContent = part?.text || message.reasoningContent || ''
  const { t } = useTranslation()
  const isSmallScreen = useIsSmallScreen()
  const isThinking =
    (message.generating &&
      part &&
      message.contentParts &&
      message.contentParts.length > 0 &&
      message.contentParts[message.contentParts.length - 1] === part) ||
    false
  const [isExpanded, setIsExpanded] = useState<boolean>(false)

  const elapsedTime = useThinkingTimer(part?.startTime, isThinking)
  const shouldShowTimer = message.isStreamingMode === true

  const displayTime =
    part?.duration && part.duration > 0 ? part.duration : isThinking && elapsedTime > 0 ? elapsedTime : 0
  const shouldRenderMarkdown = isExpanded && reasoningContent.length > 0

  const statusLine = useMemo(() => {
    if (!reasoningContent) return ''
    const first = reasoningContent
      .split(/\n+/)
      .map((l) => l.trim())
      .find((l) => l.length > 0)
    if (!first) return ''
    // strip markdown-ish noise for a quiet status line
    return first.replace(/^[#>*\-\s]+/, '').slice(0, 120)
  }, [reasoningContent])

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev)
  }, [])

  const label = isThinking
    ? t('Working…')
    : shouldShowTimer && displayTime > 0
      ? t('Worked for {{duration}}', { duration: formatWorkedDuration(displayTime) })
      : t('Worked')

  return (
    <div className={clsx('msg-worked', isSmallScreen && 'mx-0.5')}>
      <div className="msg-worked-row">
        <button type="button" className="msg-worked-toggle" onClick={toggleExpanded} aria-expanded={isExpanded}>
          <span className={clsx('msg-worked-label', isThinking && 'animate-shimmer shimmer-text')}>{label}</span>
          {isThinking && reasoningContent.length > 0 && shouldShowTimer && displayTime > 0 && (
            <span className="msg-worked-live tabular-nums">({formatElapsedTime(displayTime)})</span>
          )}
          <span className={clsx('msg-worked-chevron', isExpanded && 'is-open')} aria-hidden>
            ›
          </span>
        </button>
        {reasoningContent.length > 0 && (
          <ActionIcon
            variant="subtle"
            color="chatbox-secondary"
            size="sm"
            className="msg-worked-copy"
            onClick={(e) => {
              e.stopPropagation()
              onCopyReasoningContent(reasoningContent)(e)
            }}
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
        {shouldRenderMarkdown ? (
          <Box className="msg-worked-body reasoning-content">
            <Markdown
              enableLaTeXRendering={false}
              enableMermaidRendering={false}
              hiddenCodeCopyButton={false}
              className={isSmallScreen ? 'text-[13px]' : 'text-sm'}
              generating={isThinking}
            >
              {reasoningContent}
            </Markdown>
          </Box>
        ) : isExpanded && reasoningContent ? (
          <Text
            className="msg-worked-body"
            size={isSmallScreen ? 'xs' : 'sm'}
            m={0}
            style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
          >
            {reasoningContent}
          </Text>
        ) : null}
      </Collapse>
    </div>
  )
}
