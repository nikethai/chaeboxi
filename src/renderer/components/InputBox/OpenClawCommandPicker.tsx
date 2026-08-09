import { Box, Text } from '@mantine/core'
import { memo, type RefObject, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { GatewayCommandInfo } from '@/openclaw/gateway'
import ComposerPickerPanel from './ComposerPickerPanel'

function fuzzyScore(value: string, query: string) {
  if (!query) {
    return 1
  }

  const source = value.toLowerCase()
  const target = query.toLowerCase()

  if (source.includes(target)) {
    return target.length + 100
  }

  let score = 0
  let targetIndex = 0

  for (let sourceIndex = 0; sourceIndex < source.length && targetIndex < target.length; sourceIndex++) {
    if (source[sourceIndex] === target[targetIndex]) {
      score += 1
      targetIndex += 1
    }
  }

  return targetIndex === target.length ? score : 0
}

export function filterOpenClawCommands(commands: GatewayCommandInfo[], query: string) {
  const normalizedQuery = query.trim()

  return commands
    .map((command) => {
      const haystack = [
        command.name,
        command.nativeName,
        command.description,
        command.usage,
        ...(command.textAliases || []),
      ]
        .filter(Boolean)
        .join(' ')

      return {
        command,
        score: fuzzyScore(haystack, normalizedQuery),
      }
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.command.name.localeCompare(b.command.name))
    .map((item) => item.command)
}

export interface OpenClawCommandPickerProps {
  commands: GatewayCommandInfo[]
  highlightedIndex: number
  onHighlightChange(index: number): void
  onSelect(command: GatewayCommandInfo): void
  query: string
  anchorRef: RefObject<HTMLElement | null>
}

function getCommandAlias(command: GatewayCommandInfo): string {
  const alias = command.textAliases?.find((value) => value.startsWith('/')) || command.textAliases?.[0]
  if (alias) {
    return alias
  }

  const base = command.nativeName || command.name
  return base.startsWith('/') ? base : `/${base}`
}

function OpenClawCommandPicker({
  commands,
  highlightedIndex,
  onHighlightChange,
  onSelect,
  query,
  anchorRef,
}: OpenClawCommandPickerProps) {
  const { t } = useTranslation()
  const filteredCommands = useMemo(() => filterOpenClawCommands(commands, query).slice(0, 8), [commands, query])
  const catalogEmpty = commands.length === 0
  const isEmpty = filteredCommands.length === 0

  useEffect(() => {
    if (filteredCommands.length === 0) {
      return
    }

    if (highlightedIndex >= filteredCommands.length) {
      onHighlightChange(0)
    }
  }, [filteredCommands.length, highlightedIndex, onHighlightChange])

  return (
    <ComposerPickerPanel
      anchorRef={anchorRef}
      open
      aria-label={t('OpenClaw Commands')}
      header={
        <Text size="xs" c="chatbox-tertiary">
          {t('OpenClaw Commands')}
        </Text>
      }
      isEmpty={isEmpty}
      empty={
        catalogEmpty
          ? {
              title: t('No command found'),
              description: t('Connect OpenClaw to load gateway commands.'),
            }
          : {
              title: t('No command found'),
            }
      }
    >
      {filteredCommands.map((command, index) => {
        const selected = index === highlightedIndex
        const alias = getCommandAlias(command)

        return (
          <Box
            key={`${command.nativeName || command.name}:${alias}`}
            px="sm"
            py="xs"
            className="composer-picker-row cursor-pointer"
            data-selected={selected || undefined}
            bg={selected ? 'var(--chatbox-background-brand-secondary)' : undefined}
            onMouseEnter={() => onHighlightChange(index)}
            onMouseDown={(event) => {
              event.preventDefault()
              onSelect(command)
            }}
          >
            <Text size="sm" fw={600} c={selected ? 'chatbox-brand' : 'chatbox-primary'}>
              {alias}
            </Text>
            {(command.description || command.usage) && (
              <Text size="xs" c="chatbox-secondary" lineClamp={1}>
                {command.description || command.usage}
              </Text>
            )}
          </Box>
        )
      })}
    </ComposerPickerPanel>
  )
}

export { getCommandAlias }

export default memo(OpenClawCommandPicker)
