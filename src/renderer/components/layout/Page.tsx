import { ActionIcon, Box, Flex, Title } from '@mantine/core'
import { IconMenu2 } from '@tabler/icons-react'
import clsx from 'clsx'
import type { FC } from 'react'
import useNeedRoomForWinControls from '@/hooks/useNeedRoomForWinControls'
import { useIsSmallScreen } from '@/hooks/useScreenChange'
import { useUIStore } from '@/stores/uiStore'
import TitleBarRow from './TitleBarRow'
import WindowControls from './WindowControls'

export type PageProps = {
  children?: React.ReactNode
  title: string | React.ReactNode
  left?: React.ReactNode
  right?: React.ReactNode
  /** Extra class on the page shell (e.g. settings chrome). */
  className?: string
  /** Extra class on the title bar row. */
  headerClassName?: string
}

export const Page: FC<PageProps> = ({ children, title, left, right, className, headerClassName }) => {
  const showSidebar = useUIStore((s) => s.showSidebar)
  const setShowSidebar = useUIStore((s) => s.setShowSidebar)
  const isSmallScreen = useIsSmallScreen()
  const { needRoomForMacWindowControls } = useNeedRoomForWinControls()

  // Mobile only — desktop rail expand lives on the sidebar foot
  const showDefaultToggle = !left && isSmallScreen
  const macTrafficInset = showDefaultToggle && needRoomForMacWindowControls

  const handleSidebarToggle = () => {
    setShowSidebar(!showSidebar)
  }

  return (
    <div className={clsx('flex flex-col h-full min-h-0 bg-[var(--chatbox-background-primary)]', className)}>
      <TitleBarRow
        macTrafficInset={macTrafficInset}
        px="sm"
        className={clsx('bg-[var(--chatbox-background-primary)]', headerClassName)}
        style={{ borderBottom: 'none' }}
      >
        {left ||
          (showDefaultToggle && (
            <Flex align="center">
              <ActionIcon
                className="controls active:scale-[0.96] transition-transform"
                variant="subtle"
                size={isSmallScreen ? 24 : 28}
                color={isSmallScreen ? 'chatbox-secondary' : 'chatbox-tertiary'}
                mr="sm"
                onClick={handleSidebarToggle}
                aria-label={showSidebar ? 'Hide sidebar' : 'Show sidebar'}
              >
                <IconMenu2 />
              </ActionIcon>
            </Flex>
          ))}

        <Flex align="center" gap="xxs" flex={1} {...(isSmallScreen ? { justify: 'center', px: 'sm' } : {})}>
          {typeof title === 'string' ? (
            <Title
              order={4}
              fz={!isSmallScreen ? '0.95rem' : undefined}
              fw={600}
              lineClamp={1}
              className="tracking-tight text-balance"
              style={{ letterSpacing: '-0.02em' }}
            >
              {title}
            </Title>
          ) : (
            title
          )}
        </Flex>
        {right}
        <WindowControls className="-mr-3 ml-2" />
        {isSmallScreen && !right && <Box w={28} />}
      </TitleBarRow>

      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">{children}</div>
    </div>
  )
}

export default Page
