import { ActionIcon, Box, Code, Collapse, Group, Paper, SimpleGrid, Stack, Text } from '@mantine/core'
import {
  type MessageToolCallPart,
  MessageToolCallPartSchema,
} from '@shared/types'
import {
  IconArrowRight,
  IconChevronRight,
  IconCircleCheckFilled,
  IconCircleXFilled,
  IconCode,
  IconLoader,
  IconTool,
} from '@tabler/icons-react'
import clsx from 'clsx'
import { type FC, type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'
import z from 'zod'
import { useIsSmallScreen } from '@/hooks/useScreenChange'
import { getToolName } from '@/packages/tools'
import type { SearchResultItem } from '@/packages/web-search'
import { ScalableIcon } from '../common/ScalableIcon'

// ReasoningContentUI is re-exported from its own module so it can be kept in
// the main bundle (needed for non-agent reasoning models) while ToolCallPartUI
// can be lazy-loaded on Android. See ReasoningContentUI.tsx.
export { ReasoningContentUI } from './ReasoningContentUI'

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
