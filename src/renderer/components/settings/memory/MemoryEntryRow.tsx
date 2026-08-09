import { ActionIcon, Badge, Box, Group, Stack, Switch, Text } from '@mantine/core'
import type { MemoryEntry } from '@shared/types/memory'
import { IconEdit, IconPin, IconTrash } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { useIsSmallScreen } from '@/hooks/useScreenChange'
import { MemoryEntryForm } from './MemoryEntryForm'
import { memoryPanelStyle } from './memory-ui-state'

export type MemoryEntryRowProps = {
  entry: MemoryEntry
  editing: boolean
  editContent: string
  editTags: string
  editPinned: boolean
  maxChars: number
  saving?: boolean
  onEditContent: (v: string) => void
  onEditTags: (v: string) => void
  onEditPinned: (v: boolean) => void
  onStartEdit: () => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  onTogglePin: () => void
  onToggleEnabled: () => void
  onDelete: () => void
}

export function MemoryEntryRow({
  entry,
  editing,
  editContent,
  editTags,
  editPinned,
  maxChars,
  saving = false,
  onEditContent,
  onEditTags,
  onEditPinned,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onTogglePin,
  onToggleEnabled,
  onDelete,
}: MemoryEntryRowProps) {
  const { t } = useTranslation()
  const isSmallScreen = useIsSmallScreen()
  const visibleTags = entry.tags.slice(0, 3)
  const extraTagCount = entry.tags.length - visibleTags.length

  if (editing) {
    return (
      <MemoryEntryForm
        mode="edit"
        content={editContent}
        tags={editTags}
        pinned={editPinned}
        maxChars={maxChars}
        loading={saving}
        showPinned
        initialContent={entry.content}
        initialTags={entry.tags.join(', ')}
        initialPinned={entry.pinned}
        onContentChange={onEditContent}
        onTagsChange={onEditTags}
        onPinnedChange={onEditPinned}
        onSubmit={onSaveEdit}
        onCancel={onCancelEdit}
      />
    )
  }

  return (
    <Box p="sm" style={memoryPanelStyle} className="group/memory-row">
      <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
        <Stack gap={6} style={{ flex: 1, minWidth: 0 }}>
          <Group gap={6}>
            {entry.pinned && (
              <Badge
                size="xs"
                variant="light"
                color="yellow"
                leftSection={<IconPin size={10} />}
                style={{ borderRadius: 7 }}
              >
                {t('Pinned')}
              </Badge>
            )}
            {!entry.enabled && (
              <Badge size="xs" variant="light" color="gray" style={{ borderRadius: 7 }}>
                {t('Excluded')}
              </Badge>
            )}
            {entry.source !== 'user' && (
              <Badge size="xs" variant="light" style={{ borderRadius: 7 }}>
                {entry.source}
              </Badge>
            )}
            {visibleTags.map((tag) => (
              <Badge key={tag} size="xs" variant="outline" style={{ borderRadius: 7 }}>
                {tag}
              </Badge>
            ))}
            {extraTagCount > 0 && (
              <Badge size="xs" variant="outline" style={{ borderRadius: 7 }}>
                +{extraTagCount}
              </Badge>
            )}
          </Group>
          <Text
            size="sm"
            c={entry.enabled ? undefined : 'chatbox-secondary'}
            style={{ whiteSpace: 'pre-wrap', textWrap: 'pretty' as const }}
          >
            {entry.content}
          </Text>
        </Stack>

        <Group
          gap={4}
          wrap="nowrap"
          className={
            isSmallScreen
              ? undefined
              : 'opacity-0 group-hover/memory-row:opacity-100 focus-within:opacity-100 transition-opacity'
          }
          style={{ transitionProperty: 'opacity', transitionDuration: '150ms' }}
        >
          <ActionIcon
            size={36}
            variant="subtle"
            color={entry.pinned ? 'yellow' : 'gray'}
            onClick={onTogglePin}
            title={entry.pinned ? t('Unpin') : t('Pin')}
            aria-label={entry.pinned ? t('Unpin') : t('Pin')}
          >
            <IconPin size={16} />
          </ActionIcon>
          <ActionIcon size={36} variant="subtle" onClick={onStartEdit} title={t('Edit')} aria-label={t('Edit')}>
            <IconEdit size={16} />
          </ActionIcon>
          <Switch
            size="sm"
            checked={entry.enabled}
            onChange={onToggleEnabled}
            title={entry.enabled ? t('Exclude from inject') : t('Include in inject')}
            aria-label={entry.enabled ? t('Exclude from inject') : t('Include in inject')}
            styles={{
              root: { display: 'flex', alignItems: 'center', minHeight: 36, minWidth: 40 },
            }}
          />
          <ActionIcon
            size={36}
            variant="subtle"
            color="red"
            onClick={onDelete}
            title={t('Delete')}
            aria-label={t('Delete')}
          >
            <IconTrash size={16} />
          </ActionIcon>
        </Group>
      </Group>
    </Box>
  )
}
