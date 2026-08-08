import { Box, Paper, Stack, Text } from '@mantine/core'
import type { CommandPackage } from '@shared/types'
import { memo, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { fuzzyScoreCommand } from '@/packages/commands'

export function filterCommands(commands: CommandPackage[], query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  return commands
    .filter((c) => c.enabled)
    .map((command) => {
      const haystack = [command.name, command.description, ...(command.tags || [])].join(' ')
      return {
        command,
        score: fuzzyScoreCommand(haystack, normalizedQuery),
      }
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.command.name.localeCompare(b.command.name))
    .map((item) => item.command)
}

export interface CommandPickerProps {
  commands: CommandPackage[]
  highlightedIndex: number
  onHighlightChange(index: number): void
  onSelect(command: CommandPackage): void
  query: string
  excludeIds?: string[]
}

function CommandPicker({
  commands,
  highlightedIndex,
  onHighlightChange,
  onSelect,
  query,
  excludeIds = [],
}: CommandPickerProps) {
  const { t } = useTranslation()
  const filtered = useMemo(() => {
    const exclude = new Set(excludeIds)
    return filterCommands(
      commands.filter((c) => !exclude.has(c.id)),
      query
    ).slice(0, 8)
  }, [commands, query, excludeIds])

  useEffect(() => {
    if (filtered.length === 0) return
    if (highlightedIndex >= filtered.length) {
      onHighlightChange(0)
    }
  }, [filtered.length, highlightedIndex, onHighlightChange])

  return (
    <Paper
      shadow="md"
      radius="md"
      withBorder
      className="absolute left-0 right-0 bottom-full mb-2 overflow-hidden z-50"
      style={{ backgroundColor: 'var(--chatbox-background-primary)' }}
    >
      <Stack gap={0}>
        <Box px="sm" py="xs" style={{ borderBottom: '1px solid var(--chatbox-border-primary)' }}>
          <Text size="xs" c="chatbox-tertiary">
            {t('Commands')} · /
          </Text>
        </Box>

        {filtered.length > 0 ? (
          filtered.map((command, index) => {
            const selected = index === highlightedIndex
            return (
              <Box
                key={command.id}
                px="sm"
                py="xs"
                className="cursor-pointer"
                bg={selected ? 'var(--chatbox-background-brand-secondary)' : undefined}
                onMouseEnter={() => onHighlightChange(index)}
                onMouseDown={(e) => {
                  e.preventDefault()
                  onSelect(command)
                }}
              >
                <Text size="sm" fw={500}>
                  /{command.name}
                </Text>
                <Text size="xs" c="chatbox-tertiary" lineClamp={1}>
                  {command.description}
                </Text>
              </Box>
            )
          })
        ) : (
          <Box px="sm" py="md">
            <Text size="sm" c="chatbox-tertiary">
              {t('No matching commands')}
            </Text>
          </Box>
        )}
      </Stack>
    </Paper>
  )
}

export default memo(CommandPicker)
