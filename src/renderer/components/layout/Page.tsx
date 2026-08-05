import { ActionIcon, Box, Flex, Title } from '@mantine/core'
import { IconLayoutSidebarLeftExpand, IconMenu2 } from '@tabler/icons-react'
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
}

export const Page: FC<PageProps> = ({ children, title, left, right }) => {
  const showSidebar = useUIStore((s) => s.showSidebar)
  const setShowSidebar = useUIStore((s) => s.setShowSidebar)
  const isSmallScreen = useIsSmallScreen()
  const { needRoomForMacWindowControls } = useNeedRoomForWinControls()

  const showDefaultToggle = !left && (!showSidebar || isSmallScreen)
  const macTrafficInset = showDefaultToggle && needRoomForMacWindowControls

  return (
    <div className="flex flex-col h-full min-h-0 bg-[var(--chatbox-background-primary)]">
      <TitleBarRow
        macTrafficInset={macTrafficInset}
        px="sm"
        className="bg-[var(--chatbox-background-primary)]"
        style={{ borderBottom: 'none' }}
      >
        {left ||
          (showDefaultToggle && (
            <Flex align="center">
              <ActionIcon
                className="controls"
                variant="subtle"
                size={isSmallScreen ? 24 : 28}
                color={isSmallScreen ? 'chatbox-secondary' : 'chatbox-tertiary'}
                mr="sm"
                onClick={() => setShowSidebar(!showSidebar)}
              >
                {isSmallScreen ? <IconMenu2 /> : <IconLayoutSidebarLeftExpand />}
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
              className="tracking-tight"
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
