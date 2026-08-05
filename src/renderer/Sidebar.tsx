import {
  ActionIcon,
  Box,
  Button,
  Flex,
  Image,
  Menu,
  Stack,
  Text,
  TextInput,
  Tooltip,
  UnstyledButton,
} from '@mantine/core'
import SwipeableDrawer from '@mui/material/SwipeableDrawer'
import {
  IconArchive,
  IconChevronUp,
  IconCirclePlus,
  IconCode,
  IconFolder,
  IconInfoCircle,
  IconLayoutSidebarLeftCollapse,
  IconLogout,
  IconMessageChatbot,
  IconPhotoPlus,
  IconSettings,
  IconUser,
} from '@tabler/icons-react'
import { useNavigate } from '@tanstack/react-router'
import clsx from 'clsx'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AdaptiveModal } from './components/common/AdaptiveModal'
import { ScalableIcon } from './components/common/ScalableIcon'
import ThemeSwitchButton from './components/dev/ThemeSwitchButton'
import SessionList from './components/session/SessionList'
import { FORCE_ENABLE_DEV_PAGES } from './dev/devToolsConfig'
import { useMyCopilots } from './hooks/useCopilots'
import { useFolders } from './hooks/useFolders'
import useNeedRoomForMacWinControls from './hooks/useNeedRoomForWinControls'
import { useIsSmallScreen, useSidebarWidth } from './hooks/useScreenChange'
import useVersion from './hooks/useVersion'
import { navigateToSettings } from './modals/Settings'
import { trackingEvent } from './packages/event'
import platform from './platform'
import icon from './static/icon.png'
import { useLanguage } from './stores/settingsStore'
import { useUIStore } from './stores/uiStore'
import { CHATBOX_BUILD_PLATFORM } from './variables'

/** Compact emoji set for folder icons — chip picker, not a free-text emoji field */
const FOLDER_EMOJI_PRESETS = ['📁', '💼', '🔬', '🎨', '📚', '⚡', '🏠', '🧪', '🛠', '🎯'] as const

export default function Sidebar() {
  const { t } = useTranslation()
  const versionHook = useVersion()
  const language = useLanguage()
  const navigate = useNavigate()
  const { addFolder } = useFolders()
  const { copilots: myCopilots } = useMyCopilots()
  const showSidebar = useUIStore((s) => s.showSidebar)
  const setShowSidebar = useUIStore((s) => s.setShowSidebar)
  const setSidebarWidth = useUIStore((s) => s.setSidebarWidth)

  const sessionListViewportRef = useRef<HTMLDivElement>(null)

  const sidebarWidth = useSidebarWidth()

  const isSmallScreen = useIsSmallScreen()

  const [isResizing, setIsResizing] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [folderModalOpened, setFolderModalOpened] = useState(false)
  const [folderName, setFolderName] = useState('')
  const [folderEmoji, setFolderEmoji] = useState('')
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

  const { needRoomForMacWindowControls } = useNeedRoomForMacWinControls()

  const closeSidebarIfMobile = useCallback(() => {
    if (isSmallScreen) {
      setShowSidebar(false)
    }
  }, [isSmallScreen, setShowSidebar])

  const copilotCount = useMemo(() => myCopilots.length, [myCopilots.length])

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
      emoji: folderEmoji.trim() || undefined,
    })
    setFolderName('')
    setFolderEmoji('')
    setFolderModalOpened(false)
  }

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
          {needRoomForMacWindowControls && <Box className="title-bar flex-[0_0_44px]" />}
          <Flex align="center" justify="space-between" px="md" pt="md" pb="sm">
            <Flex align="center" gap="sm" miw={0}>
              <Image src={icon} w={22} h={22} className="shrink-0" />
              <Stack gap={2} miw={0}>
                <Text span c="chatbox-primary" size="md" lh={1.1} fw={700} className="tracking-tight">
                  Chaeboxi
                </Text>
                <Text
                  span
                  size="xs"
                  c="chatbox-tertiary"
                  className="font-[family-name:var(--chatbox-font-mono)] uppercase tracking-wider"
                  style={{ fontSize: '0.7rem', letterSpacing: '0.04em' }}
                >
                  Studio
                </Text>
              </Stack>
              {FORCE_ENABLE_DEV_PAGES && <ThemeSwitchButton size="xs" />}
            </Flex>

            <Tooltip label={t('Collapse')} openDelay={1000} withArrow>
              <ActionIcon variant="subtle" color="chatbox-tertiary" size={28} onClick={() => setShowSidebar(false)}>
                <IconLayoutSidebarLeftCollapse size={16} />
              </ActionIcon>
            </Tooltip>
          </Flex>

          <Box px="sm" pb="sm" pt={2}>
            <Button
              fullWidth
              color="chatbox-brand"
              variant="filled"
              h={40}
              radius="md"
              fw={600}
              styles={{
                root: {
                  letterSpacing: '-0.01em',
                  background: 'var(--chatbox-background-brand-primary)',
                  '&:hover': { background: 'var(--chatbox-background-brand-primary-hover)' },
                },
                label: { width: '100%' },
                inner: { justifyContent: 'space-between' },
              }}
              onClick={handleCreateNewSession}
              rightSection={
                !isSmallScreen ? (
                  <Text
                    component="span"
                    size="xs"
                    className="opacity-80 border border-white/25 rounded"
                    style={{
                      fontSize: '0.7rem',
                      fontFamily: 'var(--chatbox-font-mono)',
                      fontWeight: 500,
                      padding: '0.12rem 0.32rem',
                    }}
                  >
                    ⌘N
                  </Text>
                ) : undefined
              }
              leftSection={<ScalableIcon icon={IconCirclePlus} size={16} />}
            >
              {t('New Chat')}
            </Button>
          </Box>

          <Flex px="md" pb="sm" gap="xs">
            <Button
              variant="default"
              flex={1}
              h={34}
              radius="md"
              fw={500}
              styles={{
                root: {
                  background: 'var(--chatbox-background-primary)',
                  borderColor: 'var(--chatbox-border-primary)',
                  color: 'var(--chatbox-tint-secondary)',
                },
              }}
              onClick={() => setFolderModalOpened(true)}
            >
              <ScalableIcon icon={IconFolder} size={15} className="mr-1.5" />
              {t('New Folder')}
            </Button>
            <Tooltip label={showArchived ? t('Show Active Chats') : t('Show Archived Chats')} withArrow>
              <ActionIcon
                size={34}
                radius="md"
                variant={showArchived ? 'filled' : 'default'}
                color={showArchived ? 'chatbox-brand' : 'chatbox-gray'}
                styles={
                  showArchived
                    ? undefined
                    : {
                        root: {
                          background: 'var(--chatbox-background-primary)',
                          border: '1px solid var(--chatbox-border-primary)',
                        },
                      }
                }
                onClick={() => setShowArchived((value) => !value)}
              >
                <IconArchive size={16} />
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
                {CHATBOX_BUILD_PLATFORM !== 'android' && (
                  <Menu.Item
                    leftSection={<IconMessageChatbot size={15} stroke={1.5} />}
                    rightSection={
                      copilotCount > 0 ? <em className="user-menu-badge">{copilotCount}</em> : undefined
                    }
                    onClick={() => {
                      navigate({ to: '/copilots' })
                      closeSidebarIfMobile()
                    }}
                  >
                    {t('Copilots')}
                  </Menu.Item>
                )}
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
              className={clsx(
                `sidebar-resizer absolute top-0 bottom-0 w-1 cursor-col-resize z-[1] bg-chatbox-border-primary opacity-0 hover:opacity-70 transition-opacity duration-200`,
                language === 'ar' ? '-left-1' : '-right-1'
              )}
            />
          )}
        </Stack>
      </SwipeableDrawer>

      <AdaptiveModal
        opened={folderModalOpened}
        onClose={() => {
          setFolderModalOpened(false)
          setFolderName('')
          setFolderEmoji('')
        }}
        title={t('New Folder')}
        centered
        size={360}
        className="app-dialog"
        classNames={{ content: 'app-dialog-content', header: 'app-dialog-header', body: 'app-dialog-body' }}
      >
        {/* Desktop app dialog: name + emoji chips — not a web form stack */}
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

          <Box>
            <Text size="xs" fw={600} c="chatbox-secondary" mb={8} style={{ fontSize: 12 }}>
              {t('Icon')}
              <Text span c="chatbox-tertiary" fw={400} ml={6}>
                {t('optional')}
              </Text>
            </Text>
            <Flex gap={6} wrap="wrap" align="center">
              {FOLDER_EMOJI_PRESETS.map((emoji) => {
                const selected = folderEmoji === emoji
                return (
                  <UnstyledButton
                    key={emoji}
                    type="button"
                    onClick={() => setFolderEmoji(selected ? '' : emoji)}
                    aria-pressed={selected}
                    className={clsx('folder-emoji-chip', selected && 'folder-emoji-chip-on')}
                    title={emoji}
                  >
                    <span className="folder-emoji-glyph">{emoji}</span>
                  </UnstyledButton>
                )
              })}
              {folderEmoji && !(FOLDER_EMOJI_PRESETS as readonly string[]).includes(folderEmoji) && (
                <UnstyledButton
                  type="button"
                  onClick={() => setFolderEmoji('')}
                  className="folder-emoji-chip folder-emoji-chip-on"
                  title={t('Clear')}
                >
                  <span className="folder-emoji-glyph">{folderEmoji}</span>
                </UnstyledButton>
              )}
            </Flex>
          </Box>
        </Stack>

        <AdaptiveModal.Actions>
          <AdaptiveModal.CloseButton
            onClick={() => {
              setFolderModalOpened(false)
              setFolderName('')
              setFolderEmoji('')
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
                '&:hover': { backgroundColor: 'var(--chatbox-background-brand-primary-hover)' },
                '&:disabled': {
                  backgroundColor: 'var(--chatbox-background-tertiary)',
                  color: 'var(--chatbox-tint-tertiary)',
                  opacity: 1,
                  border: '1px solid var(--chatbox-border-primary)',
                },
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
