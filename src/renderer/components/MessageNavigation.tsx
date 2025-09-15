import { Box, Divider, Stack } from '@mantine/core'
import { IconChevronDown, IconChevronsDown, IconChevronsUp, IconChevronUp } from '@tabler/icons-react'
import { clsx } from 'clsx'
import { type FC, memo, useCallback } from 'react'
import type { Message } from 'src/shared/types'
import { useIsSmallScreen } from '@/hooks/useScreenChange'
import { uiStore } from '@/stores/uiStore'

export type MessageNavigationProps = {
  visible: boolean
  messageList: Message[]
  onMouseEnter?: () => void
  onMouseLeave?: () => void
}

export const MessageNavigation: FC<MessageNavigationProps> = ({ visible, messageList, onMouseEnter, onMouseLeave }) => {
  const isSmallScreen = useIsSmallScreen()

  const handleScrollToTop = useCallback(() => {
    const virtuoso = uiStore.getState().messageScrolling
    virtuoso?.current?.scrollToIndex({ index: 0, align: 'start', behavior: 'smooth' })
  }, [])

  const handleScrollToBottom = useCallback(() => {
    const virtuoso = uiStore.getState().messageScrolling
    if (messageList.length === 0) return
    virtuoso?.current?.scrollToIndex({ index: messageList.length - 1, align: 'end', behavior: 'smooth' })
  }, [messageList.length])

  const handleScrollToPrev = useCallback(() => {
    const virtuoso = uiStore.getState().messageScrolling
    const messageListElement = uiStore.getState().messageListElement
    if (messageListElement?.current && virtuoso?.current) {
      const containerRect = messageListElement.current.getBoundingClientRect()
      for (let i = 0; i < messageList.length; i++) {
        const msg = messageList[i]
        if (msg.role !== 'user' && msg.role !== 'assistant') {
          continue
        }
        const msgElement = messageListElement.current.querySelector(
          `[data-testid="virtuoso-item-list"] > [data-index="${i}"]`
        )
        if (msgElement) {
          const rect = msgElement.getBoundingClientRect()
          // 找到第一个出现在可视区域顶部的元素，如果是用户消息，就滚动到上一条用户消息；如果是AI消息，判断消息是否显示超过一半，不超过的话就滚动到上一条用户消息（即这条消息对应的用户消息），否则滚动到上上条用户消息
          if (rect.bottom > containerRect.top) {
            if (msg.role === 'user') {
              // 用户消息，滚动到上一条用户消息
              for (let j = i - 1; j >= 0; j--) {
                if (messageList[j].role === 'user') {
                  virtuoso.current.scrollToIndex({ index: j, align: 'start', behavior: 'smooth' })
                  return
                }
              }
              // 没有上一条用户消息了，滚动到顶部
              virtuoso.current.scrollToIndex({ index: 0, align: 'start', behavior: 'smooth' })
              return
            } else if (msg.role === 'assistant') {
              // AI消息，判断显示高度
              const visibleHeight = rect.bottom - containerRect.top
              if (visibleHeight < rect.height / 2) {
                // 显示高度不超过一半，滚动到上一条用户消息
                for (let j = i - 1; j >= 0; j--) {
                  if (messageList[j].role === 'user') {
                    virtuoso.current.scrollToIndex({ index: j, align: 'start', behavior: 'smooth' })
                    return
                  }
                }
                // 没有上一条用户消息了，滚动到顶部
                virtuoso.current.scrollToIndex({ index: 0, align: 'start', behavior: 'smooth' })
                return
              } else {
                // 显示高度超过一半，滚动到上上条用户消息
                let userMsgCount = 0
                for (let j = i - 1; j >= 0; j--) {
                  if (messageList[j].role === 'user') {
                    userMsgCount++
                    if (userMsgCount === 2) {
                      virtuoso.current.scrollToIndex({ index: j, align: 'start', behavior: 'smooth' })
                      return
                    }
                  }
                }
                // 没有上上条用户消息了，滚动到顶部
                virtuoso.current.scrollToIndex({ index: 0, align: 'start', behavior: 'smooth' })
                return
              }
            }

            break
          }
        }
      }
    }
  }, [messageList])

  const handleScrollToNext = useCallback(() => {
    const virtuoso = uiStore.getState().messageScrolling
    const messageListElement = uiStore.getState().messageListElement
    if (messageListElement?.current && virtuoso?.current) {
      const containerRect = messageListElement.current.getBoundingClientRect()
      for (let i = messageList.length - 1; i >= 0; i--) {
        const msg = messageList[i]
        if (msg.role !== 'user' && msg.role !== 'assistant') {
          continue
        }
        const msgElement = messageListElement.current.querySelector(
          `[data-testid="virtuoso-item-list"] > [data-index="${i}"]`
        )
        if (msgElement) {
          const rect = msgElement.getBoundingClientRect()
          // 从下往上找到第一个出现在可视区域底部的元素，如果是用户消息，就滚动到当前用户消息；如果是AI消息，判断消息是否显示超过一半(或者已经占据超过2/3的屏幕高度)，超过的话就滚动到下一条用户消息，否则滚动到上条用户消息（即这条消息对应的用户消息）
          if (rect.top < containerRect.bottom) {
            if (msg.role === 'user') {
              // 用户消息，滚动到当前用户消息
              virtuoso.current.scrollToIndex({ index: i, align: 'start', behavior: 'smooth' })
              return
            } else if (msg.role === 'assistant') {
              // AI消息，判断显示高度
              const visibleHeight = containerRect.bottom - rect.top
              if (visibleHeight > rect.height / 2 || visibleHeight > (containerRect.height * 2) / 3) {
                // 显示高度超过一半，滚动到下一条用户消息
                for (let j = i + 1; j < messageList.length; j++) {
                  if (messageList[j].role === 'user') {
                    virtuoso.current.scrollToIndex({ index: j, align: 'start', behavior: 'smooth' })
                    return
                  }
                }
                // 没有下一条用户消息了，滚动到底部
                virtuoso.current.scrollToIndex({ index: messageList.length - 1, align: 'end', behavior: 'smooth' })
                return
              } else {
                // 显示高度不超过一半，滚动到上条用户消息
                for (let j = i - 1; j >= 0; j--) {
                  if (messageList[j].role === 'user') {
                    virtuoso.current.scrollToIndex({ index: j, align: 'start', behavior: 'smooth' })
                    return
                  }
                }
                // 没有上条用户消息了，滚动到顶部
                virtuoso.current.scrollToIndex({ index: i, align: 'start', behavior: 'smooth' })
                return
              }
            }

            break
          }
        }
      }
    }
  }, [messageList])

  return (
    <div
      className={clsx('absolute right-0 translate-x-1/2 py-6', isSmallScreen ? 'top-1/2 -translate-y-1/2' : 'bottom-0')}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <Stack
        gap={isSmallScreen ? 'xs' : 6}
        p={isSmallScreen ? 0 : 'xxs'}
        className={clsx(
          'transition-all duration-300 rounded [&>.mantine-Divider-root]:border-[var(--mantine-color-chatbox-border-primary-outline)]',
          isSmallScreen
            ? '[&>.mantine-Divider-root]:hidden'
            : 'shadow bg-[var(--mantine-color-chatbox-background-primary-text)]',
          visible
            ? clsx('opacity-100', isSmallScreen ? '-translate-x-3/4' : '-translate-x-full')
            : 'opacity-0 translate-x-1/2 pointer-events-none'
        )}
      >
        <MessageNavigationButton icon={<IconChevronsUp />} onClick={handleScrollToTop} />
        <Divider />
        <MessageNavigationButton icon={<IconChevronUp />} onClick={handleScrollToPrev} />
        <Divider />
        <MessageNavigationButton icon={<IconChevronDown />} onClick={handleScrollToNext} />
        <Divider />
        <MessageNavigationButton icon={<IconChevronsDown />} onClick={handleScrollToBottom} />
      </Stack>
    </div>
  )
}

export default memo(MessageNavigation)

const MessageNavigationButton = ({ icon, ...others }: { icon: React.ReactElement; onClick: () => void }) => {
  const isSmallScreen = useIsSmallScreen()
  const iconSize = isSmallScreen ? 20 : 16
  return (
    <button
      className={clsx(
        'flex border-0 outline-none [-webkit-tap-highlight-color:transparent] p-0 cursor-pointer text-[var(--mantine-color-chatbox-tertiary-text)] active:translate-y-px',
        isSmallScreen
          ? 'p-1.5 rounded-full bg-[rgba(134,142,150,0.10)] backdrop-blur-lg active:text-[var(--mantine-color-chatbox-secondary-text)]'
          : 'bg-transparent hover:text-[var(--mantine-color-chatbox-secondary-text)]'
      )}
      {...others}
    >
      <Box component="span" w={iconSize} h={iconSize} className="[&>svg]:w-full [&>svg]:h-full">
        {icon}
      </Box>
    </button>
  )
}
