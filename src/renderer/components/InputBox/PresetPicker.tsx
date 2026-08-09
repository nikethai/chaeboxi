import { Box, Button, Text } from '@mantine/core'
import type { PromptPreset } from '@shared/types'
import { memo, type RefObject, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
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
  anchorRef: RefObject<HTMLElement | null>
}

function PresetPicker({
  highlightedIndex,
  onHighlightChange,
  onManage,
  onSelect,
  presets,
  query,
  anchorRef,
}: PresetPickerProps) {
  const { t } = useTranslation()
  const filteredPresets = useMemo(() => filterPresets(presets, query).slice(0, 8), [presets, query])
  const catalogEmpty = presets.length === 0
  const isEmpty = filteredPresets.length === 0

  useEffect(() => {
    if (filteredPresets.length === 0) {
      return
    }

    if (highlightedIndex >= filteredPresets.length) {
      onHighlightChange(0)
    }
  }, [filteredPresets.length, highlightedIndex, onHighlightChange])

  return (
    <ComposerPickerPanel
      anchorRef={anchorRef}
      open
      aria-label={t('Prompt Presets')}
      header={
        <Text size="xs" c="chatbox-tertiary">
          {t('Prompt Presets')}
        </Text>
      }
      isEmpty={isEmpty}
      empty={
        catalogEmpty
          ? {
              title: t('No presets yet'),
              description: t('Save prompt presets for quick insert.'),
              action: {
                label: t('Manage Prompt Presets'),
                onClick: onManage,
              },
            }
          : {
              title: t('No preset found'),
            }
      }
      footer={
        !catalogEmpty ? (
          <Button
            variant="subtle"
            size="compact-sm"
            className="active:scale-[0.96] transition-transform"
            onMouseDown={(event) => event.preventDefault()}
            onClick={onManage}
          >
            {t('Manage Prompt Presets')}
          </Button>
        ) : null
      }
    >
      {filteredPresets.map((preset, index) => {
        const preview = preset.content.split('\n')[0]?.trim() || ''
        const selected = index === highlightedIndex

        return (
          <Box
            key={preset.id}
            px="sm"
            py="xs"
            className="composer-picker-row cursor-pointer"
            data-selected={selected || undefined}
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
      })}
    </ComposerPickerPanel>
  )
}

export default memo(PresetPicker)
