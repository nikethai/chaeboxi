import NiceModal from '@ebay/nice-modal-react'
import { ActionIcon, Button, Flex, Select, Text } from '@mantine/core'
import type { SessionMeta } from '@shared/types'
import {
  IconArchive,
  IconCopy,
  IconDots,
  IconEdit,
  IconFolder,
  IconStar,
  IconStarFilled,
  IconTrash,
} from '@tabler/icons-react'
import clsx from 'clsx'
import { memo, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useFolders } from '@/hooks/useFolders'
import { useIsSmallScreen } from '@/hooks/useScreenChange'
import { router } from '@/router'
import {
  deleteSession as deleteSessionStore,
  getSession,
  updateSession as updateSessionStore,
} from '@/stores/chatStore'
import { copyAndSwitchSession, switchCurrentSession } from '@/stores/sessionActions'
import { useUIStore } from '@/stores/uiStore'
import ActionMenu, { type ActionMenuItemProps } from '../ActionMenu'
import { AdaptiveModal } from '../common/AdaptiveModal'
import { ScalableIcon } from '../common/ScalableIcon'

export interface Props {
  session: SessionMeta
  selected: boolean
}

function SessionItem(props: Props) {
  const { session, selected } = props
  const { t } = useTranslation()
  const { folders } = useFolders()
  const setShowSidebar = useUIStore((s) => s.setShowSidebar)
  const onClick = () => {
    switchCurrentSession(session.id)
    if (isSmallScreen) {
      setShowSidebar(false)
    }
  }
  const isSmallScreen = useIsSmallScreen()
  // const smallSize = theme.typography.pxToRem(20)

  const [menuOpened, setMenuOpened] = useState(false)
  const [folderModalOpened, setFolderModalOpened] = useState(false)
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(session.folderId ?? null)

  useEffect(() => {
    setSelectedFolderId(session.folderId ?? null)
  }, [session.folderId])

  const actionMenuItems = useMemo<ActionMenuItemProps[]>(
    () => [
      {
        text: t('edit'),
        icon: IconEdit,
        onClick: async () => {
          await NiceModal.show('session-settings', {
            session: await getSession(session.id),
          })
        },
      },
      {
        text: t('copy'),
        icon: IconCopy,
        onClick: () => {
          copyAndSwitchSession(session)
        },
      },
      {
        text: session.starred ? t('unstar') : t('star'),
        icon: session.starred ? IconStarFilled : IconStar,
        onClick: () => {
          void updateSessionStore(session.id, (s) => {
            if (!s) {
              throw new Error(`Session ${session.id} not found`)
            }
            return { ...s, starred: !s?.starred }
          })
        },
      },
      {
        text: t('Move to Project'),
        icon: IconFolder,
        onClick: () => {
          setFolderModalOpened(true)
        },
      },
      {
        text: session.archived ? t('Unarchive') : t('Archive'),
        icon: IconArchive,
        onClick: () => {
          void updateSessionStore(session.id, (s) => {
            if (!s) {
              throw new Error(`Session ${session.id} not found`)
            }
            return { ...s, archived: !s.archived }
          })
        },
      },
      { divider: true },
      {
        doubleCheck: true,
        text: t('delete'),
        icon: IconTrash,
        onClick: async () => {
          try {
            await deleteSessionStore(session.id)
            // Only navigate if deleting the currently selected session
            if (selected) {
              router.navigate({ to: '/', replace: true })
            }
          } catch (error) {
            console.error('Failed to delete session:', error)
          }
        },
      },
    ],
    [session, selected, t]
  )

  const folderOptions = useMemo(
    () => [
      { value: '', label: t('All') },
      ...folders.map((folder) => ({
        value: folder.id,
        label: folder.name,
      })),
    ],
    [folders, t]
  )

  const handleSaveFolder = async () => {
    await updateSessionStore(session.id, (s) => {
      if (!s) {
        throw new Error(`Session ${session.id} not found`)
      }
      return {
        ...s,
        folderId: selectedFolderId || undefined,
      }
    })
    setFolderModalOpened(false)
  }

  return (
    <>
      <Flex
        align="center"
        className={clsx('cursor-pointer group/session-item studio-rail-row', selected && 'studio-rail-row-active')}
        mx={6}
        px={10}
        py={7}
        gap={8}
        onClick={onClick}
      >
        <Text
          span
          flex={1}
          lineClamp={1}
          size="sm"
          fw={selected ? 500 : 400}
          c={selected ? 'chatbox-primary' : 'chatbox-secondary'}
          className="tracking-tight"
          style={{ fontSize: '0.875rem', letterSpacing: '-0.01em' }}
        >
          {session.name}
        </Text>

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
            color={session.starred ? 'chatbox-brand' : 'chatbox-tertiary'}
            className={
              isSmallScreen || session.starred || menuOpened ? '' : 'group-hover/session-item:visible invisible'
            }
            onClick={(event) => {
              event.stopPropagation()
              event.preventDefault()
            }}
          >
            {session.starred ? (
              <ScalableIcon icon={IconStarFilled} className="text-inherit" size={14} />
            ) : (
              <ScalableIcon icon={IconDots} className="text-inherit" size={14} />
            )}
          </ActionIcon>
        </ActionMenu>
      </Flex>

      <AdaptiveModal
        opened={folderModalOpened}
        onClose={() => setFolderModalOpened(false)}
        title={t('Move to Project')}
        centered
      >
        <Select
          data={folderOptions}
          value={selectedFolderId ?? ''}
          onChange={(value) => setSelectedFolderId(value || null)}
          label={t('Project')}
          comboboxProps={{ withinPortal: true }}
        />

        <AdaptiveModal.Actions>
          <AdaptiveModal.CloseButton onClick={() => setFolderModalOpened(false)} />
          <Button onClick={() => void handleSaveFolder()}>{t('Save')}</Button>
        </AdaptiveModal.Actions>
      </AdaptiveModal>
    </>
  )
}

export default memo(SessionItem)
