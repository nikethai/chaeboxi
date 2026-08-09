import { Box, Text } from '@mantine/core'
import type { CommandPackage } from '@shared/types'
import { memo, type RefObject, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { navigateToSettings } from '@/modals/Settings'
import { fuzzyScoreCommand } from '@/packages/commands'
import ComposerPickerPanel from './ComposerPickerPanel'

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
  anchorRef: RefObject<HTMLElement | null>
}

function CommandPicker({
  commands,
  highlightedIndex,
  onHighlightChange,
  onSelect,
  query,
  excludeIds = [],
  anchorRef,
}: CommandPickerProps) {
  const { t } = useTranslation()
  const available = useMemo(() => {
    const exclude = new Set(excludeIds)
    return commands.filter((c) => c.enabled && !exclude.has(c.id))
  }, [commands, excludeIds])

  const filtered = useMemo(() => filterCommands(available, query).slice(0, 8), [available, query])
  const catalogEmpty = available.length === 0
  const isEmpty = filtered.length === 0

  useEffect(() => {
    if (filtered.length === 0) return
    if (highlightedIndex >= filtered.length) {
      onHighlightChange(0)
    }
  }, [filtered.length, highlightedIndex, onHighlightChange])

  return (
    <ComposerPickerPanel
      anchorRef={anchorRef}
      open
      aria-label={t('Commands')}
      header={
        <Text size="xs" c="chatbox-tertiary">
          {t('Commands')} · /
        </Text>
      }
      isEmpty={isEmpty}
      empty={
        catalogEmpty
          ? {
              title: t('No commands yet'),
              description: t('Create commands, then run them with / in the composer.'),
              action: {
                label: t('Manage commands'),
                onClick: () => navigateToSettings('/commands'),
              },
            }
          : {
              title: t('No matching commands'),
            }
      }
    >
      {filtered.map((command, index) => {
        const selected = index === highlightedIndex
        return (
          <Box
            key={command.id}
            px="sm"
            py="xs"
            className="composer-picker-row cursor-pointer"
            data-selected={selected || undefined}
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
      })}
    </ComposerPickerPanel>
  )
}

export default memo(CommandPicker)
