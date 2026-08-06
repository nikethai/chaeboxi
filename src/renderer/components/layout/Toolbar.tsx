import NiceModal from '@ebay/nice-modal-react'
import { ActionIcon, Button, Flex } from '@mantine/core'
import {
  IconClearAll,
  IconCode,
  IconDeviceFloppy,
  IconDots,
  IconHistory,
  IconSearch,
  IconTrash,
} from '@tabler/icons-react'
import { useSetAtom } from 'jotai'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useIsLargeScreen, useIsSmallScreen } from '@/hooks/useScreenChange'
import platform from '@/platform'
import { router } from '@/router'
import * as atoms from '@/stores/atoms'
import { deleteSession, getSession } from '@/stores/chatStore'
import { clear as clearSession } from '@/stores/sessionActions'
import { useUIStore } from '@/stores/uiStore'
import ActionMenu from '../ActionMenu'
import Broom from '../icons/Broom'
import LayoutExpand from '../icons/LayoutExpand'
import LayoutShrink from '../icons/LayoutShrink'
import { ScalableIcon } from '../common/ScalableIcon'
import UpdateAvailableButton from '../UpdateAvailableButton'

/**
 * 顶部标题工具栏（右侧）
 * @returns
 */
export default function Toolbar({ sessionId }: { sessionId: string }) {
  const { t } = useTranslation()
  const isSmallScreen = useIsSmallScreen()
  const isLargeScreen = useIsLargeScreen()

  const [showUpdateNotification, setShowUpdateNotification] = useState(false)
  const setOpenSearchDialog = useUIStore((s) => s.setOpenSearchDialog)
  const setThreadHistoryDrawerOpen = useSetAtom(atoms.showThreadHistoryDrawerAtom)
  const widthFull = useUIStore((s) => s.widthFull)
  const setWidthFull = useUIStore((s) => s.setWidthFull)

  useEffect(() => {
    const offUpdateDownloaded = platform.onUpdateDownloaded(() => {
      setShowUpdateNotification(true)
    })
    return () => {
      offUpdateDownloaded()
    }
  }, [])

  const handleExportAndSave = () => {
    NiceModal.show('export-chat')
  }
  const handleSessionClean = () => {
    void clearSession(sessionId)
  }
  const handleSessionDelete = async () => {
    try {
      await deleteSession(sessionId)
      router.navigate({ to: '/', replace: true })
    } catch (error) {
      console.error('Failed to delete session:', error)
    }
  }

  const handleViewSessionJson = useCallback(async () => {
    const session = await getSession(sessionId)
    if (session) {
      await NiceModal.show('json-viewer', { title: t('Session Raw JSON'), data: session })
    }
  }, [sessionId, t])

  return !isSmallScreen ? (
    <Flex align="center" gap="sm" className="controls">
      {showUpdateNotification && <UpdateAvailableButton />}

      <Button
        h={34}
        px="md"
        radius="md"
        variant="subtle"
        color="chatbox-tertiary"
        leftSection={<ScalableIcon icon={IconSearch} size={16} strokeWidth={1.8} />}
        className="thread-search-trigger active:scale-[0.96] transition-transform"
        onClick={() => setOpenSearchDialog(true)}
        aria-label={t('Search')}
      >
        {t('Search')}...
      </Button>

      {isLargeScreen && (
        <ActionIcon
          variant="subtle"
          size={32}
          color="chatbox-secondary"
          className="active:scale-[0.96] transition-transform"
          onClick={() => setWidthFull(!widthFull)}
          aria-label={widthFull ? t('Exit full width') : t('Full width')}
        >
          {widthFull ? <LayoutExpand strokeWidth={1.8} /> : <LayoutShrink strokeWidth={1.8} />}
        </ActionIcon>
      )}

      <ActionMenu
        position="bottom-end"
        items={[
          {
            text: t('Thread History'),
            icon: IconHistory,
            onClick: () => setThreadHistoryDrawerOpen(true),
          },
          {
            text: t('Export Chat'),
            icon: IconDeviceFloppy,
            onClick: handleExportAndSave,
          },
          ...(process.env.NODE_ENV === 'development'
            ? [
                {
                  text: t('View Session JSON'),
                  icon: IconCode,
                  onClick: handleViewSessionJson,
                },
              ]
            : []),
          {
            divider: true,
          },
          {
            doubleCheck: {
              color: 'chatbox-error',
            },
            text: t('Clear All Messages'),
            icon: Broom,
            color: 'chatbox-primary',
            onClick: handleSessionClean,
          },
          {
            doubleCheck: {
              color: 'chatbox-error',
            },
            text: t('Delete Current Session'),
            icon: IconTrash,
            color: 'chatbox-error',
            onClick: handleSessionDelete,
          },
        ]}
      >
        <ActionIcon
          variant="subtle"
          size={32}
          color="chatbox-secondary"
          className="active:scale-[0.96] transition-transform"
          aria-label={t('More actions')}
        >
          <IconDots strokeWidth={1.8} />
        </ActionIcon>
      </ActionMenu>
    </Flex>
  ) : (
    <Flex align="center" gap="xs">
      <ActionIcon variant="subtle" size={30} color="chatbox-secondary" onClick={() => setOpenSearchDialog(true)}>
        <IconSearch strokeWidth={1.8} />
      </ActionIcon>
      <ActionMenu
        position="bottom-end"
        items={[
          {
            text: t('Thread History'),
            icon: IconHistory,
            onClick: () => setThreadHistoryDrawerOpen(true),
          },

          {
            text: t('Export Chat'),
            icon: IconDeviceFloppy,
            onClick: handleExportAndSave,
          },
          ...(process.env.NODE_ENV === 'development'
            ? [
                {
                  text: t('View Session JSON'),
                  icon: IconCode,
                  onClick: handleViewSessionJson,
                },
              ]
            : []),
          {
            divider: true,
          },
          {
            doubleCheck: {
              color: 'chatbox-error',
            },
            text: t('Clear All Messages'),
            icon: IconClearAll,
            color: 'chatbox-primary',
            onClick: handleSessionClean,
          },
          {
            doubleCheck: {
              color: 'chatbox-error',
            },
            text: t('Delete Current Session'),
            icon: IconTrash,
            color: 'chatbox-primary',
            onClick: handleSessionDelete,
          },
        ]}
      >
        <ActionIcon variant="subtle" size={30} color="chatbox-secondary">
          <IconDots strokeWidth={1.8} />
        </ActionIcon>
      </ActionMenu>
    </Flex>
  )
}
