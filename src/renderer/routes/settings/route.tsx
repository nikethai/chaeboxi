import { ActionIcon, Box, Flex, Stack, Text } from '@mantine/core'
import {
  IconAdjustmentsHorizontal,
  IconBook,
  IconBox,
  IconCategory,
  IconChevronLeft,
  IconChevronRight,
  IconCircleDottedLetterM,
  IconFileText,
  IconKeyboard,
  IconMessageChatbot,
  IconMessages,
  IconSparkles,
  IconWorldWww,
} from '@tabler/icons-react'
import { createFileRoute, Link, Outlet, useCanGoBack, useRouter, useRouterState } from '@tanstack/react-router'
import clsx from 'clsx'
import { useTranslation } from 'react-i18next'
import { Toaster } from 'sonner'
import Divider from '@/components/common/Divider'
import { ScalableIcon } from '@/components/common/ScalableIcon'
import Page from '@/components/layout/Page'
import { useIsSmallScreen } from '@/hooks/useScreenChange'
import platform from '@/platform'
import { featureFlags } from '@/utils/feature-flags'
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
    key: 'web-search',
    label: 'Web Search',
    icon: <IconWorldWww className="w-full h-full" />,
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
  ...(CHATBOX_BUILD_PLATFORM !== 'android'
    ? [
        {
          key: 'copilots',
          label: 'Copilots',
          icon: <IconMessageChatbot className="w-full h-full" />,
        },
      ]
    : []),
  ...(platform.formFactor === 'mobile'
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

export function RouteComponent() {
  const { t } = useTranslation()
  const router = useRouter()
  const routerState = useRouterState()
  const canGoBack = useCanGoBack()
  const isSmallScreen = useIsSmallScreen()

  return (
    <Page
      title={t('Settings')}
      left={
        isSmallScreen && routerState.location.pathname !== '/settings' && canGoBack ? (
          <ActionIcon
            className="controls"
            variant="subtle"
            size={28}
            color="chatbox-secondary"
            mr="sm"
            onClick={() => router.history.back()}
          >
            <IconChevronLeft />
          </ActionIcon>
        ) : undefined
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
  const key = routerState.location.pathname.split('/')[2]
  const isSmallScreen = useIsSmallScreen()

  return (
    <Flex flex={1} h="100%" miw={isSmallScreen ? undefined : 0} className="settings-page min-h-0">
      {(!isSmallScreen || routerState.location.pathname === '/settings') && (
        <Stack
          p={isSmallScreen ? 0 : 'sm'}
          gap={4}
          w={isSmallScreen ? '100%' : 220}
          miw={isSmallScreen ? undefined : 200}
          maw={isSmallScreen ? undefined : 240}
          className={clsx(
            'settings-nav border-solid border-0 overflow-auto bg-[var(--chatbox-background-rail)]',
            isSmallScreen ? 'w-full border-r-0' : 'flex-none border-r border-chatbox-border-primary'
          )}
        >
          {ITEMS.map((item) => {
            const active =
              routerState.location.pathname === `/settings/${item.key}` ||
              routerState.location.pathname.startsWith(`/settings/${item.key}/`)
            return (
              <Link
                disabled={active}
                key={item.key}
                to={`/settings/${item.key}` as never}
                className="block no-underline w-full"
              >
                <Flex
                  component="span"
                  gap="xs"
                  px="sm"
                  py={isSmallScreen ? 'sm' : 10}
                  align="center"
                  c={active ? 'chatbox-primary' : 'chatbox-secondary'}
                  className={clsx(
                    'settings-nav-item cursor-pointer select-none rounded-md relative',
                    active ? 'settings-nav-item-on' : 'hover:bg-[var(--chatbox-background-tertiary)]'
                  )}
                >
                  <Box component="span" flex="0 0 auto" w={18} h={18} className="opacity-90">
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
                    <ScalableIcon icon={IconChevronRight} size={18} className="!text-chatbox-tint-tertiary" />
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
