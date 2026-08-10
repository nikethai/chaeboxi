import { Box, Text } from '@mantine/core'
import type { MemoryEntry } from '@shared/types/memory'
import { IconBrain } from '@tabler/icons-react'
import { memo, type RefObject, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import ComposerPickerPanel from './ComposerPickerPanel'

export type MemoryMentionPickerProps = {
  anchorRef: RefObject<HTMLElement | null>
  entries: MemoryEntry[]
  highlightedIndex: number
  onHighlightChange(index: number): void
  onSelect(entry: MemoryEntry): void
  ready: boolean
}

function MemoryMentionPicker({
  anchorRef,
  entries,
  highlightedIndex,
  onHighlightChange,
  onSelect,
  ready,
}: MemoryMentionPickerProps) {
  const { t } = useTranslation()

  useEffect(() => {
    if (entries.length > 0 && highlightedIndex >= entries.length) {
      onHighlightChange(0)
    }
  }, [entries.length, highlightedIndex, onHighlightChange])

  return (
    <ComposerPickerPanel
      anchorRef={anchorRef}
      open
      aria-label={t('Memory')}
      header={
        <Text size="xs" c="chatbox-tertiary">
          {t('Memory')} · @mem
        </Text>
      }
      isEmpty={entries.length === 0}
      empty={{ title: ready ? t('No matching memories') : t('Loading memory') }}
    >
      {entries.map((entry, index) => {
        const selected = index === highlightedIndex
        return (
          <Box
            key={entry.id}
            px="sm"
            py="xs"
            className="composer-picker-row cursor-pointer"
            data-selected={selected || undefined}
            bg={selected ? 'var(--chatbox-background-brand-secondary)' : undefined}
            onMouseEnter={() => onHighlightChange(index)}
            onMouseDown={(event) => {
              event.preventDefault()
              onSelect(entry)
            }}
          >
            <div className="flex items-start gap-2">
              <IconBrain size={16} stroke={1.7} className="mt-0.5 shrink-0 text-[var(--chatbox-tint-brand)]" />
              <div className="min-w-0">
                <Text size="sm" className="line-clamp-2">
                  {entry.content}
                </Text>
                {entry.tags.length > 0 ? (
                  <Text size="xs" c="chatbox-tertiary" className="mt-0.5 truncate">
                    {entry.tags.slice(0, 3).join(' · ')}
                  </Text>
                ) : null}
              </div>
            </div>
          </Box>
        )
      })}
    </ComposerPickerPanel>
  )
}

export default memo(MemoryMentionPicker)
