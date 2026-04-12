import { ActionIcon, Button, Flex, Image, Popover, Skeleton, Stack, Text, Tooltip, UnstyledButton } from '@mantine/core'
import type { ImageGeneration } from '@shared/types'
import { IconPlayerStop, IconPhoto, IconRefresh, IconTrash, IconX } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import storage from '@/storage'
import { blobToDataUrl, IMAGE_MODEL_FALLBACK_NAMES } from './constants'

export interface HistoryItemProps {
  record: ImageGeneration
  isActive: boolean
  isActiveGeneration: boolean
  queuePosition: number | null
  isMobile?: boolean
  onClick: () => void
  onRetry: (id: string) => void
  onCancel: (id: string) => void
  onRemoveQueued: (id: string) => void
  onDelete: (id: string) => void
}

export function HistoryItem({
  record,
  isActive,
  isActiveGeneration,
  queuePosition,
  isMobile,
  onClick,
  onRetry,
  onCancel,
  onRemoveQueued,
  onDelete,
}: HistoryItemProps) {
  const { t } = useTranslation()
  const [hovered, setHovered] = useState(false)
  const [deletePopoverOpened, setDeletePopoverOpened] = useState(false)
  const firstImage = record.generatedImages[0]
  const modelName = IMAGE_MODEL_FALLBACK_NAMES[record.model.modelId] || record.model.modelId || 'Unknown'
  const isQueued = record.status === 'queued'
  const showActions = hovered || deletePopoverOpened || !!isMobile

  const statusLabel = (() => {
    if (isQueued) {
      return queuePosition ? t('Queued #{{count}}', { count: queuePosition }) : t('Queued')
    }
    if (isActiveGeneration || record.status === 'generating') {
      return record.queueNumber ? t('Generating · Server #{{count}}', { count: record.queueNumber }) : t('Generating')
    }
    if (record.status === 'cancelled') {
      return t('Cancelled')
    }
    if (record.status === 'error') {
      return t('Error')
    }
    return t('Done')
  })()

  const handleDeleteClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (isMobile) {
        if (window.confirm(t('Delete this record?'))) {
          onDelete(record.id)
        }
      } else {
        setDeletePopoverOpened(true)
      }
    },
    [isMobile, onDelete, record.id, t]
  )

  const handleConfirmDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onDelete(record.id)
      setDeletePopoverOpened(false)
    },
    [onDelete, record.id]
  )

  const handleCancelDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setDeletePopoverOpened(false)
  }, [])

  const handleRetryClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onRetry(record.id)
    },
    [onRetry, record.id]
  )

  const handleCancelClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onCancel(record.id)
    },
    [onCancel, record.id]
  )

  const handleRemoveQueuedClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onRemoveQueued(record.id)
    },
    [onRemoveQueued, record.id]
  )

  return (
    <UnstyledButton
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`
        w-full p-2 rounded-lg transition-all duration-150
        ${
          isActive
            ? 'bg-[var(--chatbox-background-brand-secondary)] ring-1 ring-[var(--chatbox-tint-brand)]'
            : isMobile
              ? ''
              : 'hover:bg-[var(--chatbox-background-secondary)]'
        }
      `}
    >
      <Flex gap="sm" align="center">
        <div className="w-12 h-12 rounded-md overflow-hidden shrink-0 bg-[var(--chatbox-background-secondary)]">
          {firstImage ? (
            <HistoryThumbnail storageKey={firstImage} size={48} />
          ) : (
            <Flex align="center" justify="center" h="100%">
              <IconPhoto size={16} className="opacity-30" />
            </Flex>
          )}
        </div>

        <Stack gap={2} flex={1} style={{ overflow: 'hidden' }}>
          <Text size="xs" lineClamp={2} fw={isActive ? 500 : 400} lh={1.3}>
            {record.prompt}
          </Text>
          <Flex align="center" gap={4}>
            <Text size="xs" c="dimmed">
              {statusLabel}
            </Text>
            <Text size="xs" c="dimmed" className="opacity-40">
              ·
            </Text>
            <Text size="xs" c="dimmed">
              {new Date(record.createdAt).toLocaleDateString()}
            </Text>
            <Text size="xs" c="dimmed" className="opacity-40">
              ·
            </Text>
            <Text size="xs" c="dimmed">
              {modelName}
            </Text>
          </Flex>
        </Stack>

        <Flex
          gap={4}
          align="center"
          className={`shrink-0 transition-opacity duration-150 ${showActions ? 'opacity-100' : 'opacity-0'}`}
        >
          {(record.status === 'error' || record.status === 'cancelled') && (
            <Tooltip label={t('Retry')} disabled={isMobile}>
              <ActionIcon variant="subtle" color="gray" size="sm" radius="md" onClick={handleRetryClick}>
                <IconRefresh size={14} />
              </ActionIcon>
            </Tooltip>
          )}

          {(isActiveGeneration || record.status === 'generating') && (
            <Tooltip label={t('Cancel')} disabled={isMobile}>
              <ActionIcon variant="subtle" color="red" size="sm" radius="md" onClick={handleCancelClick}>
                <IconPlayerStop size={14} />
              </ActionIcon>
            </Tooltip>
          )}

          {isQueued && (
            <Tooltip label={t('Remove from Queue')} disabled={isMobile}>
              <ActionIcon variant="subtle" color="gray" size="sm" radius="md" onClick={handleRemoveQueuedClick}>
                <IconX size={14} />
              </ActionIcon>
            </Tooltip>
          )}

          {!isQueued && !isActiveGeneration && (
            <>
              {isMobile ? (
                <ActionIcon
                  variant="transparent"
                  color="gray"
                  size="sm"
                  onClick={handleDeleteClick}
                  className="shrink-0 opacity-40 hover:opacity-100 transition-opacity"
                >
                  <IconTrash size={14} />
                </ActionIcon>
              ) : (
                <Popover
                  opened={deletePopoverOpened}
                  onClose={() => setDeletePopoverOpened(false)}
                  position="left"
                  withArrow
                  shadow="md"
                  radius="md"
                >
                  <Popover.Target>
                    <ActionIcon variant="subtle" color="red" size="sm" radius="md" onClick={handleDeleteClick}>
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Popover.Target>
                  <Popover.Dropdown onClick={(e) => e.stopPropagation()}>
                    <Stack gap="xs">
                      <Text size="sm">{t('Delete this record?')}</Text>
                      <Flex gap="xs" justify="flex-end">
                        <Button size="xs" variant="default" onClick={handleCancelDelete}>
                          {t('Cancel')}
                        </Button>
                        <Button size="xs" color="red" onClick={handleConfirmDelete}>
                          {t('Delete')}
                        </Button>
                      </Flex>
                    </Stack>
                  </Popover.Dropdown>
                </Popover>
              )}
            </>
          )}
        </Flex>
      </Flex>
    </UnstyledButton>
  )
}

interface HistoryThumbnailProps {
  storageKey: string
  size?: number
}

function HistoryThumbnail({ storageKey, size = 48 }: HistoryThumbnailProps) {
  const { data: imageUrl } = useQuery({
    queryKey: ['history-thumbnail', storageKey],
    queryFn: async () => {
      const blob = await storage.getBlob(storageKey)
      return blob ? blobToDataUrl(blob) : null
    },
  })

  if (!imageUrl) {
    return <Skeleton h={size} w={size} radius={0} />
  }

  return <Image src={imageUrl} h={size} w={size} fit="cover" radius={0} />
}
