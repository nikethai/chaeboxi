import { ActionIcon, Box, Collapse, Group, Paper, Text } from '@mantine/core'
import { type Message, type MessageReasoningPart } from '@shared/types'
import { IconBulb, IconChevronRight, IconCopy } from '@tabler/icons-react'
import clsx from 'clsx'
import { type FC, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useIsSmallScreen } from '@/hooks/useScreenChange'
import { formatElapsedTime, formatHumanizedDuration, useThinkingTimer } from '@/hooks/useThinkingTimer'
import { ScalableIcon } from '../common/ScalableIcon'
import Markdown from '@/components/Markdown'

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

  // Timer state management:
  // - elapsedTime: Real-time updates while thinking is active (updates every 100ms)
  // - isThinking: True when message is generating AND this reasoning part is the last content part
  // - shouldShowTimer: Only show timer for streaming responses, hide for non-streaming
  const elapsedTime = useThinkingTimer(part?.startTime, isThinking)
  const shouldShowTimer = message.isStreamingMode === true // Show timer only when explicitly marked as streaming

  // Timer display logic with clear priority order:
  // 1. If we have a final duration (thinking completed), always show it (persistent display)
  // 2. If actively thinking and we have elapsed time, show real-time updates
  // 3. Otherwise show 0 (fallback for edge cases)
  // This ensures the timer stops immediately when thinking ends and persists the final duration
  const displayTime =
    part?.duration && part.duration > 0 ? part.duration : isThinking && elapsedTime > 0 ? elapsedTime : 0
  const shouldRenderMarkdown = isExpanded && reasoningContent.length > 0

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev)
  }, [])

  return (
    <Paper withBorder radius={isSmallScreen ? 'lg' : 'md'} mb="xs" className={clsx(isSmallScreen && 'mx-0.5')}>
      <Box onClick={toggleExpanded} className="cursor-pointer group">
        <Group px={isSmallScreen ? 'sm' : 'xs'} py={isSmallScreen ? 8 : 6} justify="space-between" className="w-full">
          <Group gap="xs" wrap="nowrap" className="min-w-0 flex-1">
            <ScalableIcon icon={IconBulb} color="var(--chatbox-tint-warning)" />
            <Text
              fw={600}
              size={isSmallScreen ? 'xs' : 'sm'}
              className={clsx('truncate', isThinking ? 'animate-shimmer shimmer-text' : '')}
            >
              {isThinking
                ? t('Thinking')
                : shouldShowTimer && displayTime > 0
                  ? displayTime < 1000
                    ? t('Thought for less than a second')
                    : t('Thought for {{duration}}', { duration: formatHumanizedDuration(displayTime) })
                  : t('Thought')}
            </Text>
            {isThinking && reasoningContent.length > 0 && shouldShowTimer && (
              <Text size="xs" c="chatbox-tertiary">
                ({formatElapsedTime(displayTime)})
              </Text>
            )}
          </Group>
          <Group gap={6} wrap="nowrap" className="shrink-0">
            <ActionIcon
              variant="subtle"
              c="chatbox-gray"
              size={isSmallScreen ? 'md' : 'sm'}
              onClick={(e) => {
                e.stopPropagation()
                onCopyReasoningContent(reasoningContent)(e)
              }}
              aria-label={t('Copy reasoning content')}
            >
              <ScalableIcon icon={IconCopy} />
            </ActionIcon>

            <ScalableIcon
              icon={IconChevronRight}
              className={clsx('transition-transform', isExpanded ? 'rotate-90' : '')}
            />
          </Group>
        </Group>
      </Box>

      <Collapse in={isExpanded}>
        <Box
          style={{
            borderTop: '1px solid var(--paper-border-color)',
          }}
        >
          <Box px={isSmallScreen ? 'xs' : 'sm'} className="reasoning-content" style={{ opacity: 0.9 }}>
            {shouldRenderMarkdown ? (
              <Markdown
                enableLaTeXRendering={false}
                enableMermaidRendering={false}
                hiddenCodeCopyButton={false}
                className={isSmallScreen ? 'text-[13px]' : 'text-sm'}
                generating={isThinking}
              >
                {reasoningContent}
              </Markdown>
            ) : (
              <Text
                size={isSmallScreen ? 'xs' : 'sm'}
                m={0}
                style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
              >
                {reasoningContent}
              </Text>
            )}
          </Box>
        </Box>
      </Collapse>
    </Paper>
  )
}
