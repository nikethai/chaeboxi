import NiceModal from '@ebay/nice-modal-react'
import { ActionIcon, Flex, TextInput, Title, Tooltip } from '@mantine/core'
import type { Session } from '@shared/types'
import { IconCheck, IconMenu2, IconPencil, IconSettings, IconX } from '@tabler/icons-react'
import clsx from 'clsx'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import useNeedRoomForWinControls from '@/hooks/useNeedRoomForWinControls'
import { useIsSmallScreen } from '@/hooks/useScreenChange'
import { updateSession } from '@/stores/chatStore'
import { scheduleGenerateNameAndThreadName, scheduleGenerateThreadName } from '@/stores/sessionActions'
import * as settingActions from '@/stores/settingActions'
import { useUIStore } from '@/stores/uiStore'
import { ScalableIcon } from '../common/ScalableIcon'
import TitleBarRow from './TitleBarRow'
import Toolbar from './Toolbar'
import WindowControls from './WindowControls'

export default function Header(props: { session: Session }) {
  const { t } = useTranslation()
  const showSidebar = useUIStore((s) => s.showSidebar)
  const setShowSidebar = useUIStore((s) => s.setShowSidebar)
  const isSmallScreen = useIsSmallScreen()
  const { needRoomForMacWindowControls } = useNeedRoomForWinControls()

  const { session: currentSession } = props
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(currentSession.name)

  useEffect(() => {
    if (!renaming) {
      setRenameValue(currentSession.name)
    }
  }, [currentSession.name, renaming])

  // 会话名称自动生成
  useEffect(() => {
    const autoGenerateTitle = settingActions.getAutoGenerateTitle()
    if (!autoGenerateTitle) {
      return
    }

    // 检查是否有正在生成的消息
    const hasGeneratingMessage = currentSession.messages.some((msg) => msg.generating)

    // 如果有消息正在生成，或者消息数量少于2条，不触发名称生成
    if (hasGeneratingMessage || currentSession.messages.length < 2) {
      return
    }

    // 触发名称生成（在 sessionActions 中进行去重和延迟处理）
    if (currentSession.name === 'Untitled') {
      scheduleGenerateNameAndThreadName(currentSession.id)
    } else if (!currentSession.threadName) {
      scheduleGenerateThreadName(currentSession.id)
    }
  }, [currentSession])

  const openSessionSettings = () => {
    if (!currentSession) {
      return
    }
    NiceModal.show('session-settings', { session: currentSession })
  }

  const startRename = () => {
    setRenameValue(currentSession.name)
    setRenaming(true)
  }

  const cancelRename = () => {
    setRenaming(false)
    setRenameValue(currentSession.name)
  }

  const commitRename = async () => {
    const nextName = renameValue.trim() || currentSession.name
    if (nextName !== currentSession.name) {
      await updateSession(currentSession.id, (s) => {
        if (!s) {
          throw new Error(`Session ${currentSession.id} not found`)
        }
        return { ...s, name: nextName }
      })
    }
    setRenaming(false)
  }

  // Mobile only: hamburger for temporary drawer.
  // Desktop icon rail has expand above the user control — no duplicate in chat header.
  const showSidebarToggle = isSmallScreen
  const macTrafficInset = showSidebarToggle && needRoomForMacWindowControls

  const handleSidebarToggle = () => {
    setShowSidebar(!showSidebar)
  }

  return (
    <TitleBarRow
      macTrafficInset={macTrafficInset}
      px={isSmallScreen ? 'xs' : 'md'}
      className="bg-[var(--chatbox-background-primary)]"
      style={{ borderBottom: 'none' }}
    >
      {showSidebarToggle && (
        <Flex align="center">
          <ActionIcon
            className="controls active:scale-[0.96] transition-transform"
            variant="subtle"
            size={isSmallScreen ? 30 : 28}
            color="chatbox-tertiary"
            mr={isSmallScreen ? 'xs' : 'sm'}
            onClick={handleSidebarToggle}
            aria-label={showSidebar ? t('Hide sidebar') : t('Show sidebar')}
          >
            <IconMenu2 />
          </ActionIcon>
        </Flex>
      )}

      <Flex
        align="center"
        gap="xxs"
        flex={1}
        className={isSmallScreen ? 'min-w-0 px-1' : 'min-w-0'}
        {...(isSmallScreen && !renaming ? { justify: 'center' } : {})}
      >
        {renaming ? (
          <Flex align="center" gap={4} flex={1} maw={isSmallScreen ? '100%' : 420} className="min-w-0">
            <TextInput
              value={renameValue}
              onChange={(e) => setRenameValue(e.currentTarget.value)}
              autoFocus
              size="xs"
              flex={1}
              aria-label={t('Name')}
              classNames={{
                input: '!text-chatbox-tint-primary !font-semibold !tracking-tight',
              }}
              styles={{
                input: {
                  fontSize: isSmallScreen ? 16 : '0.95rem',
                  minHeight: 30,
                  height: 30,
                },
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void commitRename()
                } else if (e.key === 'Escape') {
                  e.preventDefault()
                  cancelRename()
                }
              }}
              onBlur={() => {
                // Defer so check/cancel clicks still register
                window.setTimeout(() => {
                  if (document.activeElement?.closest?.('[data-session-rename-actions]')) {
                    return
                  }
                  void commitRename()
                }, 0)
              }}
            />
            <Flex gap={2} data-session-rename-actions className="controls shrink-0">
              <ActionIcon
                variant="subtle"
                color="chatbox-success"
                size={28}
                className="active:scale-[0.96] transition-transform"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void commitRename()}
                aria-label={t('Save')}
              >
                <IconCheck size={16} stroke={1.75} />
              </ActionIcon>
              <ActionIcon
                variant="subtle"
                color="chatbox-tertiary"
                size={28}
                className="active:scale-[0.96] transition-transform"
                onMouseDown={(e) => e.preventDefault()}
                onClick={cancelRename}
                aria-label={t('Cancel')}
              >
                <IconX size={16} stroke={1.75} />
              </ActionIcon>
            </Flex>
          </Flex>
        ) : (
          <>
            <Title
              order={4}
              fz={isSmallScreen ? 17 : '0.95rem'}
              fw={600}
              lineClamp={1}
              className={clsx('tracking-tight cursor-text', isSmallScreen && 'max-w-[60vw] text-center leading-tight')}
              style={{ letterSpacing: '-0.02em' }}
              onDoubleClick={startRename}
              title={t('Double-click to rename')}
            >
              {currentSession?.name}
            </Title>

            <Tooltip label={t('Rename')}>
              <ActionIcon
                className="controls active:scale-[0.96] transition-transform"
                variant="subtle"
                color="chatbox-tertiary"
                size={isSmallScreen ? 24 : 22}
                onClick={startRename}
                aria-label={t('Rename')}
              >
                <ScalableIcon icon={IconPencil} size={isSmallScreen ? 16 : 15} />
              </ActionIcon>
            </Tooltip>

            <Tooltip label={t('Session options')}>
              <ActionIcon
                className="controls active:scale-[0.96] transition-transform"
                variant="subtle"
                color="chatbox-tertiary"
                size={isSmallScreen ? 24 : 22}
                onClick={openSessionSettings}
                aria-label={t('Session options')}
              >
                <ScalableIcon icon={IconSettings} size={isSmallScreen ? 16 : 15} />
              </ActionIcon>
            </Tooltip>
          </>
        )}
      </Flex>

      <Toolbar sessionId={currentSession.id} />

      <WindowControls className="-mr-3 ml-2" />
    </TitleBarRow>
  )
}
