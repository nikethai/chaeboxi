import { Box, Flex, Stack, Text } from '@mantine/core'
import '@/components/settings/settings-surfaces.css'
import {
  IconAdjustmentsHorizontal,
  IconBolt,
  IconBook,
  IconBox,
  IconCategory,
  IconChartBar,
  IconChevronRight,
  IconCircleDottedLetterM,
  IconFileText,
  IconKeyboard,
  IconMessageChatbot,
  IconMessages,
  IconSparkles,
  IconTerminal2,
  IconMovie,
  IconPlugConnected,
  IconWorldWww,
} from '@tabler/icons-react'
import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import clsx from 'clsx'
import { useCallback, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Toaster } from 'sonner'
import Divider from '@/components/common/Divider'
import { ScalableIcon } from '@/components/common/ScalableIcon'
import Page from '@/components/layout/Page'
import { SettingsBackButton, SettingsCloseButton } from '@/components/settings/SettingsChromeControls'
import { useIsSmallScreen } from '@/hooks/useScreenChange'
import { closeSettings } from '@/modals/Settings'
import platform, { platformCapabilities } from '@/platform'
import { featureFlags } from '@/utils/feature-flags'
import { getSettingsParentPath } from '@/utils/settings-navigation'
import { CHATBOX_BUILD_PLATFORM } from '@/variables'

const ITEMS = [
  {
    key: 'provider',
    label: 'Model Provider',
    icon: <IconCategory className="w-full h-full" />,
  },
  {
    key: 'default-models',
    label: 'Default Models',
    icon: <IconBox className="w-full h-full" />,
  },
  {
    key: 'usage',
    label: 'Usage',
    icon: <IconChartBar className="w-full h-full" />,
  },
  {
    key: 'web-search',
    label: 'Web Search',
    icon: <IconWorldWww className="w-full h-full" />,
  },
  {
    key: 'video-url',
    label: 'Video URL',
    icon: <IconMovie className="w-full h-full" />,
  },
  {
    key: 'integrations',
    label: 'Integrations',
    icon: <IconPlugConnected className="w-full h-full" />,
  },
  ...(featureFlags.mcp
    ? [
        {
          key: 'mcp',
          label: 'MCP',
          icon: <IconCircleDottedLetterM className="w-full h-full" />,
        },
      ]
    : []),
  ...(featureFlags.knowledgeBase
    ? [
        {
          key: 'knowledge-base',
          label: 'Knowledge Base',
          icon: <IconBook className="w-full h-full" />,
        },
      ]
    : []),
  {
    key: 'document-parser',
    label: 'Document Parser',
    icon: <IconFileText className="w-full h-full" />,
  },
  {
    key: 'chat',
    label: 'Chat Settings',
    icon: <IconMessages className="w-full h-full" />,
  },
  {
    key: 'skills',
    label: 'Skills',
    icon: <IconSparkles className="w-full h-full" />,
  },
  {
    key: 'commands',
    label: 'Commands',
    icon: <IconTerminal2 className="w-full h-full" />,
  },
  {
    key: 'hooks',
    label: 'Hooks',
    icon: <IconBolt className="w-full h-full" />,
  },
  {
    key: 'memory',
    label: 'Memory',
    icon: <IconBook className="w-full h-full" />,
  },
  ...(platformCapabilities.supportsDesktopOnlySettings && platform.type === 'desktop' && CHATBOX_BUILD_PLATFORM !== 'android'
    ? [
        {
          key: 'agents',
          label: 'Agents',
          icon: <IconMessageChatbot className="w-full h-full" />,
        },
      ]
    : []),
  ...(platformCapabilities.isMobileLayout
    ? []
    : [
        {
          key: 'hotkeys',
          label: 'Keyboard Shortcuts',
          icon: <IconKeyboard className="w-full h-full" />,
        },
      ]),
  {
    key: 'general',
    label: 'General Settings',
    icon: <IconAdjustmentsHorizontal className="w-full h-full" />,
  },
]

export const Route = createFileRoute('/settings')({
  component: RouteComponent,
})

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    return true
  }
  if (target.isContentEditable) {
    return true
  }
  return Boolean(target.closest('[contenteditable="true"]'))
}

function hasOpenOverlay(): boolean {
  return Boolean(
    document.querySelector(
      '.mantine-Modal-root[data-mounted], .mantine-Drawer-root[data-mounted], [role="dialog"][aria-modal="true"]'
    )
  )
}

export function RouteComponent() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const routerState = useRouterState()
  const isSmallScreen = useIsSmallScreen()
  const pathname = routerState.location.pathname
  const parentPath = getSettingsParentPath(pathname)
  const showMobileBack = isSmallScreen && parentPath !== null

  const sectionKey = pathname.split('/').filter(Boolean)[1]
  const sectionLabel = useMemo(() => {
    if (!sectionKey) return null
    return ITEMS.find((item) => item.key === sectionKey)?.label ?? null
  }, [sectionKey])

  const handleClose = useCallback(() => {
    closeSettings()
  }, [])

  const handleMobileBack = useCallback(() => {
    if (!parentPath) {
      closeSettings()
      return
    }
    void navigate({ to: parentPath as never })
  }, [navigate, parentPath])

  // ESC exits settings when not editing and no overlay is open
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) {
        return
      }
      if (isEditableTarget(e.target) || hasOpenOverlay()) {
        return
      }
      e.preventDefault()
      closeSettings()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const title = (
    <div className="settings-chrome-title min-w-0">
      <span className="settings-chrome-title-main">{t('Settings')}</span>
      {sectionLabel && !isSmallScreen && (
        <>
          <span className="settings-chrome-title-sep" aria-hidden>
            /
          </span>
          <span className="settings-chrome-title-section">{t(sectionLabel)}</span>
        </>
      )}
    </div>
  )

  return (
    <Page
      title={title}
      className="settings-shell"
      headerClassName="settings-chrome-header"
      left={
        showMobileBack ? (
          <Flex align="center" mr="xs" className="controls">
            <SettingsBackButton onClick={handleMobileBack} />
          </Flex>
        ) : undefined
      }
      right={
        <Flex align="center" className="controls">
          <SettingsCloseButton onClick={handleClose} showEscHint={!isSmallScreen} />
        </Flex>
      }
    >
      <SettingsRoot />
      <Toaster richColors position="bottom-center" />
    </Page>
  )
}

export function SettingsRoot() {
  const { t } = useTranslation()
  const routerState = useRouterState()
  const isSmallScreen = useIsSmallScreen()

  return (
    <Flex flex={1} h="100%" miw={isSmallScreen ? undefined : 0} className="settings-page min-h-0">
      {(!isSmallScreen || routerState.location.pathname === '/settings') && (
        <Stack
          p={isSmallScreen ? 0 : 'sm'}
          gap={isSmallScreen ? 0 : 2}
          w={isSmallScreen ? '100%' : 220}
          miw={isSmallScreen ? undefined : 200}
          maw={isSmallScreen ? undefined : 240}
          className={clsx(
            'settings-nav border-solid border-0 overflow-auto bg-[var(--chatbox-background-rail)]',
            isSmallScreen ? 'w-full border-r-0' : 'flex-none settings-nav-edge'
          )}
        >
          {ITEMS.map((item, index) => {
            const active =
              routerState.location.pathname === `/settings/${item.key}` ||
              routerState.location.pathname.startsWith(`/settings/${item.key}/`)
            return (
              <Link
                disabled={active}
                key={item.key}
                to={`/settings/${item.key}` as never}
                className="settings-nav-link block no-underline w-full"
                style={{ ['--settings-nav-i' as string]: index }}
              >
                <Flex
                  component="span"
                  gap="xs"
                  px="sm"
                  py={isSmallScreen ? 'sm' : 10}
                  align="center"
                  c={active ? 'chatbox-primary' : 'chatbox-secondary'}
                  className={clsx(
                    'settings-nav-item cursor-pointer select-none rounded-lg relative',
                    active ? 'settings-nav-item-on' : undefined
                  )}
                >
                  <Box component="span" flex="0 0 auto" w={18} h={18} className="settings-nav-icon opacity-90">
                    {item.icon}
                  </Box>
                  <Text
                    flex={1}
                    lineClamp={1}
                    span
                    size="sm"
                    fw={active ? 600 : 500}
                    className={`!text-inherit tracking-tight ${isSmallScreen ? 'min-h-[32px] leading-[32px]' : ''}`}
                    style={{ fontSize: '0.875rem' }}
                  >
                    {t(item.label)}
                  </Text>
                  {isSmallScreen && (
                    <ScalableIcon
                      icon={IconChevronRight}
                      size={18}
                      className="settings-nav-chevron !text-chatbox-tint-tertiary"
                    />
                  )}
                </Flex>

                {isSmallScreen && <Divider />}
              </Link>
            )
          })}
        </Stack>
      )}
      {!(isSmallScreen && routerState.location.pathname === '/settings') && (
        <Box flex="1 1 auto" miw={0} className="overflow-auto settings-content bg-[var(--chatbox-background-primary)]">
          <Outlet />
        </Box>
      )}
    </Flex>
  )
}
