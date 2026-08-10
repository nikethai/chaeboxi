import { Badge, Button, Checkbox, Flex, Stack, Text, Tooltip } from '@mantine/core'
import type { MemoryEntry } from '@shared/types/memory'
import { IconCopy } from '@tabler/icons-react'
import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { memoryTagLabel } from './memory-tag-label'

export type MemorySearchResultsProps = {
  entries: MemoryEntry[]
  selectedIds: Set<string>
  query: string
  ready: boolean
  canInsert: boolean
  onToggle: (id: string) => void
  onInsert: (entry: MemoryEntry) => void
  onCopy: (content: string) => void
}

export const MemorySearchResults: FC<MemorySearchResultsProps> = ({
  entries,
  selectedIds,
  query,
  ready,
  canInsert,
  onToggle,
  onInsert,
  onCopy,
}) => {
  const { t } = useTranslation()

  return (
    <Stack gap={6} mah={260} style={{ overflowY: 'auto' }}>
      {entries.map((entry) => (
        <div key={entry.id} className="rounded-lg border border-[var(--chatbox-border-primary)] p-2">
          <Flex align="flex-start" gap="xs">
            <Checkbox
              size="xs"
              mt={3}
              checked={selectedIds.has(entry.id)}
              onChange={() => onToggle(entry.id)}
              aria-label={t('Select memory')}
            />
            <Text size="sm" lineClamp={3} className="min-w-0 flex-1">
              {entry.content}
            </Text>
          </Flex>
          <Flex justify="space-between" align="center" gap="xs" mt={6}>
            <Flex gap={4} wrap="wrap" className="min-w-0">
              {entry.pinned && (
                <Badge size="xs" variant="light" color="chatbox-brand">
                  {t('Pinned')}
                </Badge>
              )}
              {entry.tags
                .filter((tag) => tag.toLowerCase() !== 'pinned')
                .slice(0, 2)
                .map((tag) => (
                  <Badge key={tag} size="xs" variant="light" color="gray">
                    {memoryTagLabel(tag)}
                  </Badge>
                ))}
            </Flex>
            <Flex gap={2} className="shrink-0">
              <Tooltip label={t('Copy')} withArrow>
                <Button variant="subtle" size="compact-xs" px={4} onClick={() => onCopy(entry.content)}>
                  <IconCopy size={14} />
                </Button>
              </Tooltip>
              <Button size="compact-xs" disabled={!canInsert} onClick={() => onInsert(entry)}>
                {t('Insert')}
              </Button>
            </Flex>
          </Flex>
        </div>
      ))}
      {ready && entries.length === 0 && (
        <Text size="sm" c="chatbox-tertiary" ta="center" py="md">
          {query.trim() ? t('No matching memories') : t('No memories yet')}
        </Text>
      )}
    </Stack>
  )
}
