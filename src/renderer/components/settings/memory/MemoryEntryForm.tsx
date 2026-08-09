import { Box, Button, Group, Stack, Switch, Text, Textarea, TextInput } from '@mantine/core'
import { IconCheck, IconX } from '@tabler/icons-react'
import { type KeyboardEvent, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { memoryPanelStyle } from './memory-ui-state'

export type MemoryEntryFormProps = {
  mode: 'create' | 'edit'
  content: string
  tags: string
  pinned?: boolean
  maxChars: number
  loading?: boolean
  /** When true, show pin toggle (create + edit) */
  showPinned?: boolean
  onContentChange: (value: string) => void
  onTagsChange: (value: string) => void
  onPinnedChange?: (pinned: boolean) => void
  onSubmit: () => void
  onCancel: () => void
  /** Original values for dirty detection in edit mode */
  initialContent?: string
  initialTags?: string
  initialPinned?: boolean
}

export function MemoryEntryForm({
  mode,
  content,
  tags,
  pinned = false,
  maxChars,
  loading = false,
  showPinned = true,
  onContentChange,
  onTagsChange,
  onPinnedChange,
  onSubmit,
  onCancel,
  initialContent,
  initialTags,
  initialPinned,
}: MemoryEntryFormProps) {
  const { t } = useTranslation()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const length = content.length
  const overLimit = length > maxChars
  const nearLimit = !overLimit && length >= Math.floor(maxChars * 0.9)
  const trimmed = content.trim()
  const canSubmit = trimmed.length > 0 && !overLimit && !loading

  const dirty =
    mode === 'create'
      ? trimmed.length > 0 || tags.trim().length > 0 || pinned
      : content !== (initialContent ?? '') ||
        tags !== (initialTags ?? '') ||
        (showPinned && pinned !== (initialPinned ?? false))

  const saveDisabled = !canSubmit || (mode === 'edit' && !dirty)

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      textareaRef.current?.focus()
      const el = textareaRef.current
      if (el && mode === 'edit') {
        const end = el.value.length
        el.setSelectionRange(end, end)
      }
    })
    return () => cancelAnimationFrame(id)
  }, [mode])

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      onCancel()
      return
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      if (!saveDisabled) onSubmit()
    }
  }

  const counterColor = overLimit ? 'red' : nearLimit ? 'yellow.6' : 'chatbox-tertiary'

  return (
    <Box
      p="md"
      style={{
        ...memoryPanelStyle,
        borderColor: 'color-mix(in srgb, var(--chatbox-tint-brand) 28%, var(--chatbox-border-primary))',
        boxShadow:
          '0 0 0 1px color-mix(in srgb, var(--chatbox-tint-brand) 12%, transparent), 0 1px 2px rgba(0,0,0,0.12)',
      }}
    >
      <Stack gap="sm">
        <Group justify="space-between" align="baseline" gap="sm">
          <Text size="sm" fw={600}>
            {mode === 'create' ? t('New memory') : t('Edit memory')}
          </Text>
          <Text size="xs" c="chatbox-tertiary">
            {t('⌘/Ctrl + Enter to save · Esc to cancel')}
          </Text>
        </Group>

        <Textarea
          ref={textareaRef}
          label={t('Fact')}
          description={mode === 'create' ? t('One durable fact models should remember across chats.') : undefined}
          placeholder={
            mode === 'create' ? t('e.g. Prefers TypeScript, works in Asia/Bangkok, project uses pnpm') : undefined
          }
          value={content}
          onChange={(e) => onContentChange(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          autosize
          minRows={3}
          maxRows={10}
          radius={9}
          error={overLimit ? t('Over {{max}} character limit', { max: maxChars }) : undefined}
          styles={{
            label: { fontWeight: 400 },
            description: { fontSize: 12 },
            input: { fontSize: 14, lineHeight: 1.5 },
          }}
        />

        <Group justify="flex-end" gap={4}>
          <Text size="xs" c={counterColor} className="tabular-nums">
            {length}
            <Text span c="chatbox-tertiary" inherit>
              /{maxChars}
            </Text>
          </Text>
        </Group>

        <TextInput
          label={t('Tags')}
          description={t('Optional · comma separated, e.g. prefs, work')}
          placeholder={t('prefs, project')}
          value={tags}
          onChange={(e) => onTagsChange(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          radius={9}
          styles={{
            label: { fontWeight: 400 },
            description: { fontSize: 12 },
          }}
        />

        {showPinned && onPinnedChange && (
          <Switch
            label={t('Pin this memory')}
            description={t('Pinned facts stay at the top and are prioritized for inject')}
            checked={pinned}
            onChange={(e) => onPinnedChange(e.currentTarget.checked)}
            styles={{
              label: { fontWeight: 400 },
              description: { fontSize: 12 },
            }}
          />
        )}

        <Group justify="flex-end" gap="xs" mt={4}>
          <Button size="sm" variant="default" leftSection={<IconX size={14} />} disabled={loading} onClick={onCancel}>
            {t('Cancel')}
          </Button>
          <Button
            size="sm"
            leftSection={<IconCheck size={14} />}
            loading={loading}
            disabled={saveDisabled}
            onClick={onSubmit}
            className="active:scale-[0.96] transition-transform"
          >
            {mode === 'create' ? t('Save memory') : t('Save changes')}
          </Button>
        </Group>
      </Stack>
    </Box>
  )
}
