import { Box, Paper, Stack, Text } from '@mantine/core'
import type { GatewayCommandInfo } from '@shared/openclaw/gateway/types'
import { memo, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

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
}: OpenClawCommandPickerProps) {
  const { t } = useTranslation()
  const filteredCommands = useMemo(() => filterOpenClawCommands(commands, query).slice(0, 8), [commands, query])

  useEffect(() => {
    if (filteredCommands.length === 0) {
      return
    }

    if (highlightedIndex >= filteredCommands.length) {
      onHighlightChange(0)
    }
  }, [filteredCommands.length, highlightedIndex, onHighlightChange])

  return (
    <Paper
      shadow="md"
      radius="md"
      withBorder
      className="absolute left-0 right-0 bottom-full mb-2 overflow-hidden z-20"
      style={{ backgroundColor: 'var(--chatbox-background-primary)' }}
    >
      <Stack gap={0}>
        <Box px="sm" py="xs" style={{ borderBottom: '1px solid var(--chatbox-border-primary)' }}>
          <Text size="xs" c="chatbox-tertiary">
            {t('OpenClaw Commands')}
          </Text>
        </Box>

        {filteredCommands.length > 0 ? (
          filteredCommands.map((command, index) => {
            const selected = index === highlightedIndex
            const alias = getCommandAlias(command)

            return (
              <Box
                key={`${command.nativeName || command.name}:${alias}`}
                px="sm"
                py="xs"
                className="cursor-pointer"
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
          })
        ) : (
          <Box px="sm" py="md">
            <Text size="sm" c="chatbox-tertiary">
              {t('No command found')}
            </Text>
          </Box>
        )}
      </Stack>
    </Paper>
  )
}

export { getCommandAlias }

export default memo(OpenClawCommandPicker)
