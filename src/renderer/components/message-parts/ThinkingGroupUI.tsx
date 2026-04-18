import { ActionIcon, Box, Collapse, Group, Paper, Text } from '@mantine/core'
import type { Message, MessageContentParts, MessageReasoningPart, MessageToolCallPart } from '@shared/types'
import {
  IconBulb,
  IconChevronRight,
  IconCircleCheckFilled,
  IconCircleXFilled,
  IconCopy,
  IconLoader,
} from '@tabler/icons-react'
import clsx from 'clsx'
import { type FC, useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Markdown from '@/components/Markdown'
import { useIsSmallScreen } from '@/hooks/useScreenChange'
import { formatElapsedTime, formatHumanizedDuration, useThinkingTimer } from '@/hooks/useThinkingTimer'
import { copyToClipboard } from '@/packages/navigator'
import * as toastActions from '@/stores/toastActions'
import { ScalableIcon } from '../common/ScalableIcon'
import { ToolCallPartUI } from './ToolCallPartUI'

interface ThinkingGroupUIProps {
  message: Message
  parts: MessageContentParts
  isLastGroup: boolean
}

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

  // The group is actively thinking if the message is generating and the last part in the group
  // is the last contentPart of the message
  const lastPart = parts[parts.length - 1]
  const isThinking =
    isLastGroup &&
    message.generating === true &&
    message.contentParts &&
    message.contentParts.length > 0 &&
    message.contentParts[message.contentParts.length - 1] === lastPart

  // Compute total duration from all reasoning parts in the group
  const totalDuration = useMemo(() => {
    return reasoningParts.reduce((sum, p) => sum + (p.duration || 0), 0)
  }, [reasoningParts])

  // For the live timer, use the last reasoning part's startTime
  const lastReasoningPart = reasoningParts[reasoningParts.length - 1]
  const elapsedTime = useThinkingTimer(lastReasoningPart?.startTime, isThinking || false)
  const shouldShowTimer = message.isStreamingMode === true

  const displayTime = totalDuration > 0 ? totalDuration : isThinking && elapsedTime > 0 ? elapsedTime : 0

  // Combine all reasoning text for copy
  const allReasoningText = useMemo(() => reasoningParts.map((p) => p.text).join('\n\n'), [reasoningParts])

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

  // Build the header label
  const headerLabel = useMemo(() => {
    if (isThinking) {
      return t('Thinking')
    }

    const hasDuration = shouldShowTimer && displayTime > 0
    const durationStr = hasDuration
      ? displayTime < 1000
        ? t('Thought for less than a second')
        : t('Thought for {{duration}}', { duration: formatHumanizedDuration(displayTime) })
      : null

    if (toolCount > 0 && durationStr) {
      const key =
        toolCount === 1
          ? 'Thought for {{duration}} and used {{count}} tool'
          : 'Thought for {{duration}} and used {{count}} tools'
      return t(key, {
        duration: formatHumanizedDuration(displayTime),
        count: toolCount,
      })
    }

    if (toolCount > 0) {
      const key = toolCount === 1 ? 'Thought and used {{count}} tool' : 'Thought and used {{count}} tools'
      return t(key, { count: toolCount })
    }

    if (durationStr) {
      return durationStr
    }

    return t('Thought')
  }, [isThinking, shouldShowTimer, displayTime, toolCount, t])

  return (
    <Paper withBorder radius={isSmallScreen ? 'lg' : 'md'} mb="xs" className={clsx(isSmallScreen && 'mx-0.5')}>
      <Box onClick={toggleExpanded} className="cursor-pointer group">
        <Group px={isSmallScreen ? 'sm' : 'xs'} py={isSmallScreen ? 8 : 6} justify="space-between" className="w-full">
          <Group gap="xs" wrap="nowrap" className="flex-1 min-w-0">
            <ScalableIcon icon={IconBulb} color="var(--chatbox-tint-warning)" />
            <Text
              fw={600}
              size={isSmallScreen ? 'xs' : 'sm'}
              className={clsx('truncate', isThinking ? 'animate-shimmer shimmer-text' : '')}
            >
              {headerLabel}
            </Text>
            {toolCount > 0 && (
              <Group gap={6} ml={2} wrap="nowrap" className="shrink-0">
                <Group gap={3} wrap="nowrap">
                  <ScalableIcon icon={IconCircleXFilled} color="var(--chatbox-tint-error)" />
                  <Text size="xs" fw={600} style={{ color: 'var(--chatbox-tint-error)' }}>
                    {toolStatusCounts.failed}
                  </Text>
                </Group>
                <Group gap={3} wrap="nowrap">
                  <ScalableIcon
                    icon={IconLoader}
                    className={toolStatusCounts.running > 0 ? 'animate-spin' : undefined}
                    color="var(--chatbox-tint-brand)"
                  />
                  <Text size="xs" fw={600} style={{ color: 'var(--chatbox-tint-brand)' }}>
                    {toolStatusCounts.running}
                  </Text>
                </Group>
                <Group gap={3} wrap="nowrap">
                  <ScalableIcon icon={IconCircleCheckFilled} color="var(--chatbox-tint-success)" />
                  <Text size="xs" fw={600} style={{ color: 'var(--chatbox-tint-success)' }}>
                    {toolStatusCounts.succeeded}
                  </Text>
                </Group>
              </Group>
            )}
            {isThinking && elapsedTime > 0 && shouldShowTimer && (
              <Text size="xs" c="chatbox-tertiary" className="shrink-0">
                ({formatElapsedTime(elapsedTime)})
              </Text>
            )}
          </Group>
          <Group gap={6} wrap="nowrap" className="shrink-0">
            <ActionIcon
              variant="subtle"
              c="chatbox-gray"
              size={isSmallScreen ? 'md' : 'sm'}
              onClick={onCopy}
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
          {parts.map((part, index) =>
            part.type === 'reasoning' ? (
              <Box
                key={`group-reasoning-${index}`}
                px={isSmallScreen ? 'xs' : 'sm'}
                className="reasoning-content"
                style={{ opacity: 0.9 }}
              >
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
              <Box key={`group-tool-${part.toolCallId}`} px={isSmallScreen ? 'xs' : 'sm'} py="xs">
                <ToolCallPartUI part={part as MessageToolCallPart} />
              </Box>
            ) : null
          )}
        </Box>
      </Collapse>
    </Paper>
  )
}
