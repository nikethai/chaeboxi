import { ActionIcon, Box, Code, Collapse, Group, Paper, SimpleGrid, Stack, Text } from '@mantine/core'
import {
  type Message,
  type MessageReasoningPart,
  type MessageToolCallPart,
  MessageToolCallPartSchema,
} from '@shared/types'
import {
  IconArrowRight,
  IconBulb,
  IconChevronRight,
  IconCircleCheckFilled,
  IconCircleXFilled,
  IconCode,
  IconCopy,
  IconLoader,
  IconTool,
} from '@tabler/icons-react'
import clsx from 'clsx'
import { type FC, type ReactNode, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import z from 'zod'
import { useIsSmallScreen } from '@/hooks/useScreenChange'
import { formatElapsedTime, formatHumanizedDuration, useThinkingTimer } from '@/hooks/useThinkingTimer'
import { getToolName } from '@/packages/tools'
import type { SearchResultItem } from '@/packages/web-search'
import { ScalableIcon } from '../common/ScalableIcon'
import Markdown from '@/components/Markdown'

const ToolCallHeader: FC<{ part: MessageToolCallPart; action: ReactNode; onClick: () => void }> = (props) => {
  const isSmallScreen = useIsSmallScreen()
  return (
    <Paper
      withBorder
      radius={isSmallScreen ? 'lg' : 'md'}
      px={isSmallScreen ? 'sm' : 'xs'}
      py={isSmallScreen ? 6 : 4}
      onClick={props.onClick}
      className="cursor-pointer group"
    >
      <Group justify="space-between" className="w-full" wrap="nowrap">
        <Group gap="xs" wrap="nowrap" className="min-w-0 flex-1">
          <Text fw={600} size={isSmallScreen ? 'sm' : 'md'} className="truncate">
            {getToolName(props.part.toolName)}
          </Text>
          <ScalableIcon icon={IconTool} color="var(--chatbox-tint-success)" />
          {props.part.state === 'call' ? (
            <ScalableIcon icon={IconLoader} className="animate-spin" color="var(--chatbox-tint-brand)" />
          ) : props.part.state === 'error' ? (
            <ScalableIcon icon={IconCircleXFilled} color="var(--chatbox-tint-error)" />
          ) : (
            <ScalableIcon icon={IconCircleCheckFilled} color="var(--chatbox-tint-success)" />
          )}
        </Group>
        <Box className="shrink-0">{props.action}</Box>
      </Group>
    </Paper>
  )
}

const WebBrowsingToolCallPartSchema = MessageToolCallPartSchema.extend({
  toolName: z.literal('web_search'),
  args: z.object({
    query: z.string(),
  }),
  result: z
    .object({
      query: z.string(),
      searchResults: z.array(
        z.object({
          title: z.string(),
          snippet: z.string(),
          link: z.string(),
        })
      ),
    })
    .optional(),
})

type WebBrowsingToolCallPart = MessageToolCallPart<
  { query: string },
  { query: string; searchResults: SearchResultItem[] }
>

const getSafeExternalHref = (raw: string): string | null => {
  const trimmed = raw.trim()
  if (!trimmed) return null

  if (!/^https?:\/\//i.test(trimmed)) {
    return null
  }

  try {
    return new URL(trimmed).toString()
  } catch (_error) {
    const encoded = trimmed.replace(/%(?![0-9A-Fa-f]{2})/g, '%25')
    try {
      return new URL(encoded).toString()
    } catch (_innerError) {
      return null
    }
  }
}

const SearchResultCard: FC<{ index: number; result: SearchResultItem }> = ({ index, result }) => {
  const isSmallScreen = useIsSmallScreen()
  const href = getSafeExternalHref(result.link)

  const content = (
    <Paper
      radius={isSmallScreen ? 'lg' : 'md'}
      p={8}
      bg={'var(--chatbox-background-gray-secondary)'}
      maw={isSmallScreen ? 240 : 200}
      miw={isSmallScreen ? 180 : undefined}
      title={result.title}
    >
      <Text size={isSmallScreen ? 'xs' : 'sm'} truncate="end" m={0}>
        <b>{index + 1}.</b> {result.title}
      </Text>
      <Text size="xs" truncate="end" c="chatbox-tertiary" m={0} mt={4}>
        {result.link}
      </Text>
    </Paper>
  )

  if (!href) {
    return content
  }

  return (
    <Box component="a" href={href} target="_blank" rel="noopener noreferrer" className="no-underline">
      {content}
    </Box>
  )
}

const WebSearchToolCallUI: FC<{ part: WebBrowsingToolCallPart }> = ({ part }) => {
  const isSmallScreen = useIsSmallScreen()
  const { t } = useTranslation()
  const [expaned, setExpand] = useState(false)
  return (
    <Stack gap="xs" mb="xs">
      <ToolCallHeader
        part={part}
        onClick={() => setExpand((prev) => !prev)}
        action={
          <ScalableIcon icon={IconChevronRight} className={clsx('transition-transform', expaned ? 'rotate-90' : '')} />
        }
      />
      <Collapse in={expaned}>
        <Stack gap="xs">
          <Group gap="xs" my={2} wrap="nowrap">
            <Text c="chatbox-tertiary" m={0}>
              {t('Search query')}:
            </Text>
            <Text fw={600} size={isSmallScreen ? 'xs' : 'sm'} m={0} fs="italic" className="truncate">
              {part.args.query}
            </Text>
          </Group>
          {part.result && (
            <SimpleGrid cols={{ base: 1, sm: 3, md: 4 }} spacing="xs">
              {part.result.searchResults.map((result, index) => (
                <SearchResultCard key={result.link} index={index} result={result} />
              ))}
            </SimpleGrid>
          )}
        </Stack>
      </Collapse>
      <Collapse in={!expaned}>
        {part.result && (
          <Group gap="xs" wrap="nowrap" className="overflow-x-auto" pb="xs">
            {part.result.searchResults.map((result, index) => (
              <SearchResultCard key={result.link} index={index} result={result} />
            ))}
          </Group>
        )}
      </Collapse>
    </Stack>
  )
}

const GeneralToolCallUI: FC<{ part: MessageToolCallPart }> = ({ part }) => {
  const isSmallScreen = useIsSmallScreen()
  const { t } = useTranslation()
  const [expaned, setExpand] = useState(false)
  return (
    <Stack gap="xs" mb="xs">
      <ToolCallHeader
        part={part}
        onClick={() => setExpand((prev) => !prev)}
        action={
          <ScalableIcon icon={IconChevronRight} className={clsx('transition-transform', expaned ? 'rotate-90' : '')} />
        }
      />

      <Collapse in={expaned}>
        <Paper withBorder radius={isSmallScreen ? 'lg' : 'md'} p="sm">
          <Stack gap="xs">
            <Group gap="xs" c="chatbox-tertiary">
              <ScalableIcon icon={IconCode} />
              <Text fw={600} size="xs" c="chatbox-tertiary" m="0">
                {t('Arguments')}
              </Text>
            </Group>
            <Box>
              <Code block>{JSON.stringify(part.args, null, 2)}</Code>
            </Box>
          </Stack>
          {!!part.result && (
            <Stack gap="xs" className="mt-2">
              <Group gap="xs" c="chatbox-tertiary">
                <ScalableIcon icon={IconArrowRight} />
                <Text fw={600} size="xs" c="chatbox-tertiary" m="0">
                  {t('Result')}
                </Text>
              </Group>
              <Box>
                <Code block>{JSON.stringify(part.result, null, 2)}</Code>
              </Box>
            </Stack>
          )}
        </Paper>
      </Collapse>
    </Stack>
  )
}

export const ToolCallPartUI: FC<{ part: MessageToolCallPart }> = ({ part }) => {
  if (part.toolName === 'web_search') {
    const parsedPart = WebBrowsingToolCallPartSchema.safeParse(part)
    if (parsedPart.success) {
      return <WebSearchToolCallUI part={parsedPart.data as WebBrowsingToolCallPart} />
    }
  }
  return <GeneralToolCallUI part={part} />
}

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
