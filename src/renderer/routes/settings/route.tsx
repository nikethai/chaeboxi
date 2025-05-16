import { createFileRoute, Link, Outlet, useRouterState } from '@tanstack/react-router'
import {
  IconMessages,
  IconCategory,
  IconKeyboard,
  IconInfoCircle,
  IconWorldWww,
  IconAdjustmentsHorizontal,
  IconBox,
} from '@tabler/icons-react'
import { Box, Flex, Stack, Text, Title } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import Page from '@/components/Page'

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
  {
    key: 'chat',
    label: 'Chat Settings',
    icon: <IconMessages className="w-full h-full" />,
  },
  {
    key: 'hotkeys',
    label: 'Keyboard Shortcuts',
    icon: <IconKeyboard className="w-full h-full" />,
  },
  {
    key: 'general',
    label: 'General Settings',
    icon: <IconAdjustmentsHorizontal className="w-full h-full" />,
  },
]

export const Route = createFileRoute('/settings')({
  component: RouteComponent,
})

function RouteComponent() {
  const { t } = useTranslation()
  const routerState = useRouterState()
  const key = routerState.location.pathname.split('/')[2]

  return (
    <Page title={t('Settings')}>
      <Flex flex={1} h="100%">
        <Stack
          p="xs"
          gap="xs"
          className="border-solid border-0 border-r overflow-auto border-[var(--mantine-color-chatbox-border-primary-outline)]"
        >
          {ITEMS.map((item) => (
            <Link
              disabled={routerState.location.pathname.startsWith(`/settings/${item.key}`)}
              key={item.key}
              to={`/settings/${item.key}` as any}
              className="no-underline"
            >
              <Flex
                component="span"
                gap="xs"
                p="md"
                align="center"
                c={item.key === key ? 'chatbox-brand' : 'chatbox-secondary'}
                bg={item.key === key ? 'var(--mantine-color-chatbox-brand-light)' : 'transparent'}
                className="w-[16rem] cursor-pointer select-none rounded-md hover:!bg-[var(--mantine-color-chatbox-brand-outline-hover)]"
              >
                <Box component="span" flex="0 0 auto" w={20} h={20} mr="xs">
                  {item.icon}
                </Box>
                <Text flex={1} lineClamp={1} span={true} className="!text-inherit">
                  {t(item.label)}
                </Text>
              </Flex>
            </Link>
          ))}
        </Stack>
        <Box flex={1} className="overflow-auto">
          <Outlet />
        </Box>
      </Flex>
    </Page>
  )
}
