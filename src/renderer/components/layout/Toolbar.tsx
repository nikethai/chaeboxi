import NiceModal from '@ebay/nice-modal-react'
import { ActionIcon, Button, Flex } from '@mantine/core'
import { IconClearAll, IconCode, IconDeviceFloppy, IconDots, IconSearch, IconTrash } from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useIsSmallScreen } from '@/hooks/useScreenChange'
import platform from '@/platform'
import { router } from '@/router'
import { deleteSession, getSession } from '@/stores/chatStore'
import { clear as clearSession } from '@/stores/sessionActions'
import { useUIStore } from '@/stores/uiStore'
import ActionMenu, { type ActionMenuItemProps } from '../ActionMenu'
import { ScalableIcon } from '../common/ScalableIcon'
import Broom from '../icons/Broom'
import UpdateAvailableButton from '../UpdateAvailableButton'

/**
 * 顶部标题工具栏（右侧）
 * @returns
 */
export default function Toolbar({ sessionId }: { sessionId: string }) {
  const { t } = useTranslation()
  const isSmallScreen = useIsSmallScreen()

  const [showUpdateNotification, setShowUpdateNotification] = useState(false)
  const setOpenSearchDialog = useUIStore((s) => s.setOpenSearchDialog)

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

  // Primary chrome stays Search + More only (Thread History / Full width removed).
  const overflowItems = useMemo<ActionMenuItemProps[]>(() => {
    const items: ActionMenuItemProps[] = [
      {
        text: t('Export Chat'),
        icon: IconDeviceFloppy,
        onClick: handleExportAndSave,
      },
    ]

    if (process.env.NODE_ENV === 'development') {
      items.push({
        text: t('View Session JSON'),
        icon: IconCode,
        onClick: handleViewSessionJson,
      })
    }

    items.push(
      { divider: true },
      {
        doubleCheck: { color: 'chatbox-error' },
        text: t('Clear All Messages'),
        icon: isSmallScreen ? IconClearAll : Broom,
        onClick: handleSessionClean,
      },
      {
        doubleCheck: { color: 'chatbox-error' },
        text: t('Delete Current Session'),
        icon: IconTrash,
        color: 'chatbox-error',
        onClick: handleSessionDelete,
      }
    )

    return items
  }, [handleSessionClean, handleSessionDelete, handleViewSessionJson, isSmallScreen, t])

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

      <ActionMenu position="bottom-end" items={overflowItems}>
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
      <ActionIcon
        variant="subtle"
        size={30}
        color="chatbox-secondary"
        onClick={() => setOpenSearchDialog(true)}
        aria-label={t('Search')}
      >
        <IconSearch strokeWidth={1.8} />
      </ActionIcon>
      <ActionMenu position="bottom-end" items={overflowItems}>
        <ActionIcon variant="subtle" size={30} color="chatbox-secondary" aria-label={t('More actions')}>
          <IconDots strokeWidth={1.8} />
        </ActionIcon>
      </ActionMenu>
    </Flex>
  )
}
