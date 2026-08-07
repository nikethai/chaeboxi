import { ActionIcon, Flex, Text, Tooltip } from '@mantine/core'
import {
  IconChevronDown,
  IconChevronRight,
  IconDots,
  IconEdit,
  IconMessageChatbot,
  IconPlus,
  IconStack2,
  IconTrash,
} from '@tabler/icons-react'
import clsx from 'clsx'
import { memo, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useIsSmallScreen } from '@/hooks/useScreenChange'
import ActionMenu, { type ActionMenuItemProps } from '../ActionMenu'
import { ScalableIcon } from '../common/ScalableIcon'

export interface FolderItemProps {
  count: number
  /** @deprecated emoji ignored in UI — projects use a shared outline mark */
  emoji?: string
  expanded: boolean
  implicit?: boolean
  name: string
  onCreateChat?(): void
  onDelete?(): void
  onRename?(): void
  onSetDefaultCopilot?(): void
  onToggle(): void
}

function FolderItem({
  count,
  expanded,
  implicit = false,
  name,
  onCreateChat,
  onDelete,
  onRename,
  onSetDefaultCopilot,
  onToggle,
}: FolderItemProps) {
  const { t } = useTranslation()
  const isSmallScreen = useIsSmallScreen()
  const [menuOpened, setMenuOpened] = useState(false)

  const actionMenuItems = useMemo<ActionMenuItemProps[]>(
    () =>
      implicit
        ? []
        : [
            {
              text: t('New Chat'),
              icon: IconPlus,
              onClick: () => onCreateChat?.(),
            },
            {
              text: t('Rename Project'),
              icon: IconEdit,
              onClick: () => onRename?.(),
            },
            {
              text: t('Set Default Copilot'),
              icon: IconMessageChatbot,
              onClick: () => onSetDefaultCopilot?.(),
            },
            { divider: true },
            {
              text: t('Delete Project'),
              icon: IconTrash,
              color: 'chatbox-error',
              doubleCheck: true,
              onClick: () => onDelete?.(),
            },
          ],
    [implicit, onCreateChat, onDelete, onRename, onSetDefaultCopilot, t]
  )

  return (
    <Flex
      align="center"
      gap={6}
      mx={6}
      px={8}
      py={5}
      className={clsx(
        'group/folder-item project-folder-row',
        !implicit && 'hover:bg-[var(--chatbox-background-tertiary)] cursor-pointer'
      )}
      onClick={onToggle}
    >
      <ActionIcon
        variant="transparent"
        size={28}
        color="chatbox-tertiary"
        aria-hidden
        className="shrink-0 active:scale-[0.96] transition-transform"
      >
        <ScalableIcon
          icon={expanded ? IconChevronDown : IconChevronRight}
          size={13}
          className={clsx('project-folder-chevron', expanded && 'is-open')}
        />
      </ActionIcon>

      <IconStack2 size={14} stroke={1.5} className="project-row-icon" aria-hidden />

      <Text
        span
        size="xs"
        c="chatbox-tertiary"
        fw={550}
        className="tracking-tight truncate project-folder-name"
        style={{ fontSize: '0.8125rem', letterSpacing: '-0.01em' }}
      >
        {name}
      </Text>

      <Text
        span
        size="xs"
        c="chatbox-tertiary"
        flex={1}
        className="tabular-nums project-folder-count"
        style={{ fontSize: '0.6875rem' }}
      >
        {count}
      </Text>

      {/* Hover-only + on desktop; always available on small screens + inside menu */}
      {!implicit && onCreateChat && (
        <Tooltip label={t('New Chat')} withArrow openDelay={400}>
          <ActionIcon
            variant="transparent"
            size={28}
            color="chatbox-tertiary"
            className={clsx(
              'active:scale-[0.96] transition-transform',
              isSmallScreen || menuOpened ? '' : 'group-hover/folder-item:visible invisible'
            )}
            aria-label={t('New Chat')}
            onClick={(event) => {
              event.stopPropagation()
              event.preventDefault()
              onCreateChat()
            }}
          >
            <ScalableIcon icon={IconPlus} size={15} />
          </ActionIcon>
        </Tooltip>
      )}

      {!implicit && (
        <ActionMenu
          type="desktop"
          items={actionMenuItems}
          position="bottom-start"
          opened={menuOpened}
          onChange={(opened) => setMenuOpened(opened)}
        >
          <ActionIcon
            variant="transparent"
            size={28}
            color="chatbox-tertiary"
            className={clsx(
              'active:scale-[0.96] transition-transform',
              isSmallScreen || menuOpened ? '' : 'group-hover/folder-item:visible invisible'
            )}
            aria-label={t('Project options')}
            onClick={(event) => {
              event.stopPropagation()
              event.preventDefault()
            }}
          >
            <ScalableIcon icon={IconDots} size={15} />
          </ActionIcon>
        </ActionMenu>
      )}
    </Flex>
  )
}

export default memo(FolderItem)
