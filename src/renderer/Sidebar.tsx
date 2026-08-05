import { ActionIcon, Box, Button, Flex, Menu, Stack, TextInput, Tooltip, UnstyledButton } from '@mantine/core'
import SwipeableDrawer from '@mui/material/SwipeableDrawer'
import {
  IconArchive,
  IconChevronUp,
  IconCode,
  IconEdit,
  IconFolderPlus,
  IconInfoCircle,
  IconLayoutSidebarLeftCollapse,
  IconLogout,
  IconPhotoPlus,
  IconSearch,
  IconSettings,
  IconUser,
} from '@tabler/icons-react'
import { useNavigate } from '@tanstack/react-router'
import clsx from 'clsx'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ChaeboxiWordmark from './components/brand/ChaeboxiWordmark'
import { AdaptiveModal } from './components/common/AdaptiveModal'
import ThemeSwitchButton from './components/dev/ThemeSwitchButton'
import TitleBarRow from './components/layout/TitleBarRow'
import SessionList from './components/session/SessionList'
import { FORCE_ENABLE_DEV_PAGES } from './dev/devToolsConfig'
import { useFolders } from './hooks/useFolders'
import { useIsSmallScreen, useSidebarWidth } from './hooks/useScreenChange'
import useVersion from './hooks/useVersion'
import { navigateToSettings } from './modals/Settings'
import { trackingEvent } from './packages/event'
import { useLanguage } from './stores/settingsStore'
import { useUIStore } from './stores/uiStore'
import { CHATBOX_BUILD_PLATFORM } from './variables'

export default function Sidebar() {
  const { t } = useTranslation()
  const versionHook = useVersion()
  const language = useLanguage()
  const navigate = useNavigate()
  const { addFolder } = useFolders()
  const showSidebar = useUIStore((s) => s.showSidebar)
  const setShowSidebar = useUIStore((s) => s.setShowSidebar)
  const setSidebarWidth = useUIStore((s) => s.setSidebarWidth)
  const setOpenSearchDialog = useUIStore((s) => s.setOpenSearchDialog)

  const sessionListViewportRef = useRef<HTMLDivElement>(null)

  const sidebarWidth = useSidebarWidth()

  const isSmallScreen = useIsSmallScreen()

  const [isResizing, setIsResizing] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [folderModalOpened, setFolderModalOpened] = useState(false)
  const [folderName, setFolderName] = useState('')
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [accountMenuWidth, setAccountMenuWidth] = useState<number | undefined>(undefined)
  const accountTriggerRef = useRef<HTMLButtonElement>(null)
  const resizeStartX = useRef<number>(0)
  const resizeStartWidth = useRef<number>(0)

  const syncAccountMenuWidth = useCallback(() => {
    const el = accountTriggerRef.current
    if (el) {
      // Match dropdown to trigger / rail foot content width (full container)
      setAccountMenuWidth(Math.round(el.getBoundingClientRect().width))
    }
  }, [])

  const closeSidebarIfMobile = useCallback(() => {
    if (isSmallScreen) {
      setShowSidebar(false)
    }
  }, [isSmallScreen, setShowSidebar])

  const displayName = useMemo(() => {
    // Local-first CE — no account system; product name as workspace identity
    return 'Chaeboxi'
  }, [])

  const displaySubtitle = useMemo(() => {
    if (/\d/.test(versionHook.version)) {
      return `local · v${versionHook.version}`
    }
    return 'local · free'
  }, [versionHook.version])

  const handleCreateNewSession = useCallback(() => {
    navigate({ to: `/` })

    if (isSmallScreen) {
      setShowSidebar(false)
    }
    trackingEvent('create_new_conversation', { event_category: 'user' })
  }, [navigate, setShowSidebar, isSmallScreen])

  const handleCreateNewPictureSession = useCallback(() => {
    navigate({ to: '/image-creator' })
    if (isSmallScreen) {
      setShowSidebar(false)
    }
    trackingEvent('open_image_creator', { event_category: 'user' })
  }, [isSmallScreen, setShowSidebar, navigate])

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      if (isSmallScreen) return
      e.preventDefault()
      e.stopPropagation()
      setIsResizing(true)
      resizeStartX.current = e.clientX
      resizeStartWidth.current = sidebarWidth
    },
    [isSmallScreen, sidebarWidth]
  )

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const isRTL = language === 'ar'
      const deltaX = isRTL ? resizeStartX.current - e.clientX : e.clientX - resizeStartX.current
      const newWidth = Math.max(200, Math.min(500, resizeStartWidth.current + deltaX))
      setSidebarWidth(newWidth)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, language, setSidebarWidth])

  const handleCreateFolder = () => {
    if (!folderName.trim()) {
      return
    }

    addFolder({
      name: folderName.trim(),
    })
    setFolderName('')
    setFolderModalOpened(false)
  }

  const handleCollapseSidebar = useCallback(() => {
    setShowSidebar(false)
  }, [setShowSidebar])

  return (
    <>
      <SwipeableDrawer
        anchor={language === 'ar' ? 'right' : 'left'}
        variant={isSmallScreen ? 'temporary' : 'persistent'}
        open={showSidebar}
        onClose={() => setShowSidebar(false)}
        onOpen={() => setShowSidebar(true)}
        ModalProps={{
          keepMounted: true, // Better open performance on mobile.
        }}
        sx={{
          '& .MuiDrawer-paper': {
            backgroundImage: 'none',
            backgroundColor: 'var(--chatbox-background-rail)',
            boxSizing: 'border-box',
            width: isSmallScreen ? '75vw' : sidebarWidth,
            maxWidth: '75vw',
            borderRight: '1px solid var(--chatbox-border-primary)',
          },
        }}
        SlideProps={language === 'ar' ? { direction: 'left' } : undefined}
        PaperProps={
          language === 'ar' ? { sx: { direction: 'rtl', overflowY: 'initial' } } : { sx: { overflowY: 'initial' } }
        }
        disableSwipeToOpen={CHATBOX_BUILD_PLATFORM !== 'ios'} // 只在iOS设备上启用SwipeToOpen
        disableEnforceFocus={true} // 关闭 focus trap，避免在侧边栏打开时弹出的 modal 中 input 无法点击
      >
        <Stack
          h="100%"
          gap={0}
          pt="var(--mobile-safe-area-inset-top, 0px)"
          pb="var(--mobile-safe-area-inset-bottom, 0px)"
          className="relative studio-rail"
        >
          {/*
            Rail head — brand left with nav (no mac traffic inset: 80px made logo look centered).
            Traffic lights sit in the window corner; wordmark aligns with Search/New Chat.
          */}
          <TitleBarRow heightMode="desktop" macTrafficInset={false} justify="flex-start" className="rail-head">
            <Flex align="center" gap={8} miw={0} justify="flex-start" className="controls min-w-0 w-full">
              <ChaeboxiWordmark size="rail" />
              {FORCE_ENABLE_DEV_PAGES && <ThemeSwitchButton size="xs" />}
            </Flex>
          </TitleBarRow>

          {/* Quiet nav stack — Grok: icon + label rows, no solid CTA block */}
          <nav className="rail-nav" aria-label={t('Navigation')}>
            <button
              type="button"
              className="rail-nav-item"
              onClick={() => {
                setOpenSearchDialog(true, true)
                closeSidebarIfMobile()
              }}
            >
              <IconSearch size={18} stroke={1.5} aria-hidden />
              <span>{t('Search')}</span>
            </button>
            <button type="button" className="rail-nav-item" onClick={handleCreateNewSession}>
              <IconEdit size={18} stroke={1.5} aria-hidden />
              <span>{t('New Chat')}</span>
              {!isSmallScreen && <kbd className="rail-nav-kbd">⌘N</kbd>}
            </button>
            <button
              type="button"
              className="rail-nav-item"
              onClick={() => {
                handleCreateNewPictureSession()
              }}
            >
              <IconPhotoPlus size={18} stroke={1.5} aria-hidden />
              <span>{t('Imagine')}</span>
            </button>
          </nav>

          {/* Projects / History chrome tools */}
          <Flex px="sm" pb={6} pt={2} gap={4} align="center" className="rail-tools">
            <Tooltip label={t('New Project')} withArrow>
              <ActionIcon
                size={28}
                radius="md"
                variant="subtle"
                color="chatbox-tertiary"
                onClick={() => setFolderModalOpened(true)}
                aria-label={t('New Project')}
              >
                <IconFolderPlus size={16} stroke={1.5} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={showArchived ? t('Show Active Chats') : t('Show Archived Chats')} withArrow>
              <ActionIcon
                size={28}
                radius="md"
                variant={showArchived ? 'light' : 'subtle'}
                color={showArchived ? 'chatbox-brand' : 'chatbox-tertiary'}
                onClick={() => setShowArchived((value) => !value)}
                aria-label={showArchived ? t('Show Active Chats') : t('Show Archived Chats')}
                aria-pressed={showArchived}
              >
                <IconArchive size={16} stroke={1.5} />
              </ActionIcon>
            </Tooltip>
          </Flex>

          <Box className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <SessionList sessionListViewportRef={sessionListViewportRef} showArchived={showArchived} />
          </Box>

          {/* Account footer — mock rail-foot: menu above, user trigger below */}
          <div className="rail-foot">
            <Menu
              shadow="md"
              width={accountMenuWidth ?? 'target'}
              position="top"
              withinPortal
              offset={6}
              middlewares={{ flip: true, shift: false, size: true }}
              opened={accountMenuOpen}
              onChange={(open) => {
                if (open) {
                  syncAccountMenuWidth()
                }
                setAccountMenuOpen(open)
              }}
              classNames={{
                dropdown: 'user-menu-dropdown user-menu-dropdown-full',
              }}
            >
              <Menu.Target>
                <UnstyledButton
                  ref={accountTriggerRef}
                  className="user-trigger"
                  data-expanded={accountMenuOpen ? 'true' : 'false'}
                  aria-expanded={accountMenuOpen}
                  aria-haspopup="menu"
                  onMouseEnter={syncAccountMenuWidth}
                >
                  <span className="user-avatar" aria-hidden>
                    <IconUser size={16} stroke={1.5} />
                  </span>
                  <span className="user-meta">
                    <strong>{displayName}</strong>
                    <span>{displaySubtitle}</span>
                  </span>
                  <span className="user-chevron" aria-hidden>
                    <IconChevronUp size={16} stroke={1.75} />
                  </span>
                </UnstyledButton>
              </Menu.Target>

              <Menu.Dropdown>
                <Menu.Label>{t('Workspace')}</Menu.Label>
                {!isSmallScreen && (
                  <Menu.Item
                    leftSection={<IconLayoutSidebarLeftCollapse size={15} stroke={1.5} />}
                    onClick={handleCollapseSidebar}
                  >
                    {t('Hide Sidebar')}
                  </Menu.Item>
                )}
                <Menu.Item
                  leftSection={<IconPhotoPlus size={15} stroke={1.5} />}
                  rightSection={<em className="user-menu-badge">beta</em>}
                  onClick={() => {
                    handleCreateNewPictureSession()
                    closeSidebarIfMobile()
                  }}
                >
                  {t('Image studio')}
                </Menu.Item>
                {FORCE_ENABLE_DEV_PAGES && (
                  <Menu.Item
                    leftSection={<IconCode size={15} stroke={1.5} />}
                    onClick={() => {
                      navigate({ to: '/dev' })
                      closeSidebarIfMobile()
                    }}
                  >
                    Dev Tools
                  </Menu.Item>
                )}

                <Menu.Divider />
                <Menu.Label>{t('Account')}</Menu.Label>
                <Menu.Item
                  leftSection={<IconSettings size={15} stroke={1.5} />}
                  rightSection={<em className="user-menu-kbd">⌘,</em>}
                  onClick={() => {
                    navigateToSettings()
                    closeSidebarIfMobile()
                  }}
                >
                  {t('Settings')}
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconUser size={15} stroke={1.5} />}
                  onClick={() => {
                    navigateToSettings('/chat')
                    closeSidebarIfMobile()
                  }}
                >
                  {t('Profile')}
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconInfoCircle size={15} stroke={1.5} />}
                  rightSection={
                    CHATBOX_BUILD_PLATFORM === 'android' && versionHook.needCheckUpdate ? (
                      <Box w={6} h={6} bg="chatbox-brand" style={{ borderRadius: '50%' }} />
                    ) : (
                      <em className="user-menu-badge">
                        {/\d/.test(versionHook.version) ? `v${versionHook.version}` : ''}
                      </em>
                    )
                  }
                  onClick={() => {
                    navigate({ to: '/about' })
                    closeSidebarIfMobile()
                  }}
                >
                  {t('About')}
                </Menu.Item>

                <Menu.Divider />
                <Menu.Item
                  className="user-menu-item-danger"
                  leftSection={<IconLogout size={15} stroke={1.5} />}
                  onClick={() => {
                    // Local CE has no cloud account — About is the closest account surface
                    navigate({ to: '/about' })
                    closeSidebarIfMobile()
                  }}
                >
                  {t('Sign out')}
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </div>
          {!isSmallScreen && (
            <Box
              onMouseDown={handleResizeStart}
              onDoubleClick={handleCollapseSidebar}
              title={t('Drag to resize · double-click to hide')}
              className={clsx('sidebar-resizer', isResizing && 'is-resizing', language === 'ar' ? 'left-0' : 'right-0')}
            />
          )}
        </Stack>
      </SwipeableDrawer>

      <AdaptiveModal
        opened={folderModalOpened}
        onClose={() => {
          setFolderModalOpened(false)
          setFolderName('')
        }}
        title={t('New Project')}
        centered
        size={360}
        className="app-dialog"
        classNames={{ content: 'app-dialog-content', header: 'app-dialog-header', body: 'app-dialog-body' }}
      >
        <Stack gap={14}>
          <TextInput
            label={t('Name')}
            placeholder={t('Work, Research, Archive…')}
            value={folderName}
            data-autofocus
            autoFocus
            onChange={(event) => setFolderName(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                handleCreateFolder()
              }
            }}
            styles={{
              label: { fontSize: 12, fontWeight: 600, color: 'var(--chatbox-tint-secondary)', marginBottom: 6 },
              input: {
                height: 36,
                fontSize: 14,
                background: 'var(--chatbox-background-primary)',
                borderColor: 'var(--chatbox-border-secondary)',
              },
            }}
          />
        </Stack>

        <AdaptiveModal.Actions>
          <AdaptiveModal.CloseButton
            onClick={() => {
              setFolderModalOpened(false)
              setFolderName('')
            }}
          >
            {t('Cancel')}
          </AdaptiveModal.CloseButton>
          <Button
            size="sm"
            onClick={handleCreateFolder}
            disabled={!folderName.trim()}
            fw={600}
            styles={{
              root: {
                height: 32,
                minWidth: 88,
                backgroundColor: 'var(--chatbox-background-brand-primary)',
                /* filled brand — white label (palette has no auto-contrast shades) */
                color: 'var(--chatbox-tint-white)',
                '&:hover': {
                  backgroundColor: 'var(--chatbox-background-brand-primary-hover)',
                  color: 'var(--chatbox-tint-white)',
                },
                '&:disabled': {
                  backgroundColor: 'var(--chatbox-background-tertiary)',
                  color: 'var(--chatbox-tint-tertiary)',
                  opacity: 1,
                  border: '1px solid var(--chatbox-border-primary)',
                },
              },
              label: {
                color: 'inherit',
              },
            }}
          >
            {t('Create')}
          </Button>
        </AdaptiveModal.Actions>
      </AdaptiveModal>
    </>
  )
}
