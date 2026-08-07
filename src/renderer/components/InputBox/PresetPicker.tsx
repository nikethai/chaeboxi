import { Box, Button, Paper, Stack, Text } from '@mantine/core'
import type { PromptPreset } from '@shared/types'
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

export function filterPresets(presets: PromptPreset[], query: string) {
  const normalizedQuery = query.trim()

  return presets
    .map((preset) => {
      const haystack = [preset.name, preset.category, ...(preset.tags || []), preset.content].filter(Boolean).join(' ')
      return {
        preset,
        score: fuzzyScore(haystack, normalizedQuery),
      }
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.preset.name.localeCompare(b.preset.name))
    .map((item) => item.preset)
}

export interface PresetPickerProps {
  highlightedIndex: number
  onHighlightChange(index: number): void
  onManage(): void
  onSelect(preset: PromptPreset): void
  presets: PromptPreset[]
  query: string
}

function PresetPicker({ highlightedIndex, onHighlightChange, onManage, onSelect, presets, query }: PresetPickerProps) {
  const { t } = useTranslation()
  const filteredPresets = useMemo(() => filterPresets(presets, query).slice(0, 8), [presets, query])

  useEffect(() => {
    if (filteredPresets.length === 0) {
      return
    }

    if (highlightedIndex >= filteredPresets.length) {
      onHighlightChange(0)
    }
  }, [filteredPresets.length, highlightedIndex, onHighlightChange])

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
            {t('Prompt Presets')}
          </Text>
        </Box>

        {filteredPresets.length > 0 ? (
          filteredPresets.map((preset, index) => {
            const preview = preset.content.split('\n')[0]?.trim() || ''
            const selected = index === highlightedIndex

            return (
              <Box
                key={preset.id}
                px="sm"
                py="xs"
                className="cursor-pointer"
                bg={selected ? 'var(--chatbox-background-brand-secondary)' : undefined}
                onMouseEnter={() => onHighlightChange(index)}
                onMouseDown={(event) => {
                  event.preventDefault()
                  onSelect(preset)
                }}
              >
                <Text size="sm" fw={600} c={selected ? 'chatbox-brand' : 'chatbox-primary'}>
                  {preset.name}
                </Text>
                {preset.category && (
                  <Text size="xs" c="chatbox-tertiary">
                    {preset.category}
                  </Text>
                )}
                {preview && (
                  <Text size="xs" c="chatbox-secondary" lineClamp={1}>
                    {preview}
                  </Text>
                )}
              </Box>
            )
          })
        ) : (
          <Box px="sm" py="md">
            <Text size="sm" c="chatbox-tertiary">
              {t('No preset found')}
            </Text>
          </Box>
        )}

        <Box px="sm" py="xs" style={{ borderTop: '1px solid var(--chatbox-border-primary)' }}>
          <Button variant="subtle" size="compact-sm" onMouseDown={(event) => event.preventDefault()} onClick={onManage}>
            {t('Manage Prompt Presets')}
          </Button>
        </Box>
      </Stack>
    </Paper>
  )
}

export default memo(PresetPicker)
