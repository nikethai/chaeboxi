import { Avatar, Paper, Stack, Text } from '@mantine/core'
import type { SearchCitation } from '@shared/types'
import { memo } from 'react'
import platform from '@/platform'
import { getFaviconUrl } from '@shared/utils/search'

export const SourceCard = memo(({ citation }: { citation: SearchCitation }) => {
  const domain = (() => {
    try {
      return new URL(citation.url).hostname
    } catch {
      return citation.url
    }
  })()

  return (
    <Paper
      withBorder
      radius="md"
      p="sm"
      className="min-w-56 max-w-64 cursor-pointer transition-colors hover:bg-chatbox-background-secondary"
      onClick={(event) => {
        event.stopPropagation()
        platform.openLink(citation.url)
      }}
    >
      <Stack gap={6}>
        <div className="flex items-start gap-2">
          <Avatar src={citation.favicon || getFaviconUrl(citation.url)} size="sm" radius="xl">
            {citation.index}
          </Avatar>
          <div className="min-w-0 flex-1">
            <Text fw={600} size="sm" lineClamp={2}>
              {citation.title || citation.url}
            </Text>
            <Text size="xs" c="chatbox-tertiary" truncate="end">
              {domain}
            </Text>
          </div>
        </div>
        {citation.snippet ? (
          <Text size="xs" c="chatbox-secondary" lineClamp={3}>
            {citation.snippet}
          </Text>
        ) : null}
      </Stack>
    </Paper>
  )
})

SourceCard.displayName = 'SourceCard'
