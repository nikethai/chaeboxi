import { ActionIcon, Flex, Text } from '@mantine/core'
import {
  IconChevronDown,
  IconChevronRight,
  IconDots,
  IconEdit,
  IconMessageChatbot,
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
  emoji?: string
  expanded: boolean
  implicit?: boolean
  name: string
  onDelete?(): void
  onRename?(): void
  onSetDefaultCopilot?(): void
  onToggle(): void
}

function FolderItem({
  count,
  emoji,
  expanded,
  implicit = false,
  name,
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
              text: t('Rename Folder'),
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
              text: t('Delete Folder'),
              icon: IconTrash,
              color: 'chatbox-error',
              doubleCheck: true,
              onClick: () => onDelete?.(),
            },
          ],
    [implicit, onDelete, onRename, onSetDefaultCopilot, t]
  )

  return (
    <Flex
      align="center"
      gap={6}
      mx={6}
      px={10}
      py={6}
      className={clsx(
        'group/folder-item rounded-full',
        !implicit && 'hover:bg-[var(--chatbox-background-tertiary)] cursor-pointer'
      )}
      onClick={onToggle}
    >
      <ActionIcon variant="transparent" size={18} color="chatbox-tertiary">
        <ScalableIcon icon={expanded ? IconChevronDown : IconChevronRight} size={14} />
      </ActionIcon>

      <Text span size="sm" c="chatbox-secondary" fw={500} className="tracking-tight" style={{ fontSize: '0.875rem' }}>
        {emoji ? `${emoji} ` : ''}
        {name}
      </Text>

      <Text span size="xs" c="chatbox-tertiary" flex={1} style={{ fontSize: '0.75rem' }}>
        {count}
      </Text>

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
            size={20}
            color="chatbox-tertiary"
            className={isSmallScreen || menuOpened ? '' : 'group-hover/folder-item:visible invisible'}
            onClick={(event) => {
              event.stopPropagation()
              event.preventDefault()
            }}
          >
            <ScalableIcon icon={IconDots} size={16} />
          </ActionIcon>
        </ActionMenu>
      )}
    </Flex>
  )
}

export default memo(FolderItem)
