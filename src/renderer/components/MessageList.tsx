import NiceModal from '@ebay/nice-modal-react'
import { Button, Transition } from '@mantine/core'
import AddIcon from '@mui/icons-material/AddCircleOutline'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import EditIcon from '@mui/icons-material/Edit'
import SegmentIcon from '@mui/icons-material/Segment'
import SwapCallsIcon from '@mui/icons-material/SwapCalls'
import { IconButton, MenuItem } from '@mui/material'
import { IconArrowUp } from '@tabler/icons-react'
import { useSetAtom } from 'jotai'
import { type FC, Fragment, memo, type UIEventHandler, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { type StateSnapshot, Virtuoso, type VirtuosoHandle } from 'react-virtuoso'
import type { Session, SessionThreadBrief } from 'src/shared/types'
import { useIsSmallScreen } from '@/hooks/useScreenChange'
import { cn } from '@/lib/utils'
import * as atoms from '@/stores/atoms'
import * as scrollActions from '@/stores/scrollActions'
import { deleteFork, moveThreadToConversations, removeThread, switchFork, switchThread } from '@/stores/sessionActions'
import { getAllMessageList, getCurrentThreadHistoryHash } from '@/stores/sessionHelpers'
import { useUIStore } from '@/stores/uiStore'
import { ConfirmDeleteMenuItem } from './ConfirmDeleteButton'
import Message from './Message'
import MessageNavigation, { ScrollToBottomButton } from './MessageNavigation'
import StyledMenu from './StyledMenu'

const sessionScrollPositionCache = new Map<string, StateSnapshot>()

export default function MessageList(props: { className?: string; currentSession: Session }) {
  const { t } = useTranslation()
  const isSmallScreen = useIsSmallScreen()

  const { currentSession } = props
  const currentThreadHash = useMemo(
    () => currentSession && getCurrentThreadHistoryHash(currentSession),
    [currentSession]
  )
  const currentMessageList = useMemo(() => getAllMessageList(currentSession), [currentSession])

  const virtuoso = useRef<VirtuosoHandle>(null)
  const messageListRef = useRef<HTMLDivElement>(null)

  const setMessageListElement = useUIStore((s) => s.setMessageListElement)
  const setMessageScrolling = useUIStore((s) => s.setMessageScrolling)
  const setMessageScrollingScrollPosition = useUIStore((s) => s.setMessageScrollingScrollPosition)

  // message navigation handlers
  const [messageNavigationVisible, setMessageNavigationVisible] = useState(false)
  const handleMessageNavigationVisibleChanged = useCallback((v: boolean) => setMessageNavigationVisible(v), [])

  const handleScrollToTop = useCallback(() => {
    virtuoso.current?.scrollToIndex({ index: 0, align: 'start', behavior: 'smooth' })
  }, [])

  const handleScrollToBottom = useCallback(() => {
    virtuoso.current?.scrollTo({ top: Infinity, behavior: 'smooth' })
  }, [])

  const handleScrollToPrev = useCallback(() => {
    if (messageListRef?.current && virtuoso?.current) {
      const containerRect = messageListRef.current.getBoundingClientRect()
      for (let i = 0; i < currentMessageList.length; i++) {
        const msg = currentMessageList[i]
        if (msg.role !== 'user' && msg.role !== 'assistant') {
          continue
        }
        const msgElement = messageListRef.current.querySelector(
          `[data-testid="virtuoso-item-list"] > [data-index="${i}"]`
        )
        if (msgElement) {
          const rect = msgElement.getBoundingClientRect()
          // 找到第一个出现在可视区域顶部的元素，滚动到上一条用户消息
          if (rect.bottom > containerRect.top) {
            for (let j = i - 1; j >= 0; j--) {
              if (currentMessageList[j].role === 'user') {
                virtuoso.current.scrollToIndex({
                  index: j,
                  align: 'start',
                  offset: isSmallScreen ? -28 : 0,
                  behavior: 'smooth',
                })
                return
              }
            }
            // 没有上一条用户消息了，滚动到顶部
            virtuoso.current.scrollToIndex({ index: 0, align: 'start', behavior: 'smooth' })
            return
          }
        }
      }
    }
  }, [currentMessageList, isSmallScreen])

  const handleScrollToNext = useCallback(() => {
    if (messageListRef?.current && virtuoso?.current) {
      const containerRect = messageListRef.current.getBoundingClientRect()
      for (let i = 0; i < currentMessageList.length; i++) {
        const msg = currentMessageList[i]
        if (msg.role !== 'user' && msg.role !== 'assistant') {
          continue
        }
        const msgElement = messageListRef.current.querySelector(
          `[data-testid="virtuoso-item-list"] > [data-index="${i}"]`
        )
        if (msgElement) {
          const rect = msgElement.getBoundingClientRect()
          // 找到第一个出现在可视区域顶部的元素，滚动到下一条用户消息
          if (rect.bottom > containerRect.top) {
            for (let j = i + 1; j < currentMessageList.length; j++) {
              if (currentMessageList[j].role === 'user') {
                virtuoso.current.scrollToIndex({ index: j, align: 'start', behavior: 'smooth' })
                return
              }
            }
            // 没有下一条用户消息了，滚动到底部
            virtuoso.current.scrollToIndex({ index: currentMessageList.length - 1, align: 'end', behavior: 'smooth' })
            return
          }
        }
      }
    }
  }, [currentMessageList])

  const [atBottom, setAtBottom] = useState(false)
  const [atTop, setAtTop] = useState(false)

  const [showScrollToPrev, setShowScrollToPrev] = useState(false)
  const lastScrollTop = useRef<number>()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])
  const handleScroll = useCallback<UIEventHandler>(
    (e) => {
      // 为什么不合并到 onWheel 中？
      // 实践中发现 onScroll 处理时效果会更加丝滑一些
      if (virtuoso.current) {
        virtuoso.current.getState((state) => {
          if (messageListRef.current) {
            setMessageScrollingScrollPosition(state.scrollTop + messageListRef.current.clientHeight)
          }
        })
      }

      const scrollTop = e.currentTarget.scrollTop
      if (lastScrollTop.current) {
        if (scrollTop < lastScrollTop.current) {
          // 是向上滚动
          setShowScrollToPrev(true)
          if (timerRef.current) {
            clearTimeout(timerRef.current)
            timerRef.current = null
          }
          timerRef.current = setTimeout(() => setShowScrollToPrev(false), 3000)
        } else {
          setShowScrollToPrev(false)
          if (timerRef.current) {
            clearTimeout(timerRef.current)
            timerRef.current = null
          }
        }
      }
      lastScrollTop.current = scrollTop
    },
    [setMessageScrollingScrollPosition]
  )

  // message navigation handlers end

  // biome-ignore lint/correctness/useExhaustiveDependencies: 仅执行一次
  useEffect(() => {
    setMessageScrolling(virtuoso)
    const currentVirtuoso = virtuoso.current // 清理时 virtuoso.current 已经为 null
    return () => {
      currentVirtuoso?.getState((state) => {
        if (state.ranges.length > 0) {
          // useEffect 可能执行两次，这里根据 ranges 判断是否为第一次 useEffect 严格测试导致的执行
          sessionScrollPositionCache.set(currentSession.id, state)
        }
      })
    }
  }, [])
  // biome-ignore lint/correctness/useExhaustiveDependencies: 仅执行一次
  useEffect(() => {
    setMessageListElement(messageListRef)
  }, [])

  const [threadMenuAnchorEl, setThreadMenuAnchorEl] = useState<null | HTMLElement>(null)
  const [threadMenuClickedTopicId, setThreadMenuClickedTopicId] = useState<null | string>(null)

  const openThreadMenu = useCallback((event: React.MouseEvent<HTMLElement>, topicId: string) => {
    setThreadMenuAnchorEl(event.currentTarget)
    setThreadMenuClickedTopicId(topicId)
  }, [])

  const closeThreadMenu = useCallback(() => {
    setThreadMenuAnchorEl(null)
    setThreadMenuClickedTopicId(null)
  }, [])

  return (
    <div className={cn('w-full h-full mx-auto', props.className)}>
      <div className="overflow-hidden h-full pr-0 pl-1 sm:pl-0 relative" ref={messageListRef}>
        <Virtuoso
          style={{ scrollbarGutter: 'stable' }}
          data={currentMessageList}
          ref={virtuoso}
          followOutput={true}
          {...(sessionScrollPositionCache.has(currentSession.id)
            ? {
                restoreStateFrom: sessionScrollPositionCache.get(currentSession.id),
                // 需要额外设置 initialScrollTop，否则恢复位置后 scrollTop 为 0。这时如果用户没有滚动，那么下次保存时 scrollTop 将记为 0，导致下一次恢复时位置始终为顶部。
                initialScrollTop: sessionScrollPositionCache.get(currentSession.id)?.scrollTop,
              }
            : {
                initialTopMostItemIndex: currentMessageList.length - 1,
              })}
          increaseViewportBy={{ top: 2000, bottom: 2000 }}
          itemContent={(index, msg) => {
            return (
              <Fragment key={msg.id}>
                {currentThreadHash[msg.id] && (
                  <ThreadLabel thread={currentThreadHash[msg.id]} onThreadLabelClick={openThreadMenu} />
                )}
                <Message
                  id={msg.id}
                  msg={msg}
                  sessionId={currentSession.id}
                  sessionType={currentSession.type || 'chat'}
                  className={index === 0 ? 'pt-4' : ''}
                  collapseThreshold={msg.role === 'system' ? 150 : undefined}
                  preferCollapsedCodeBlock={index < currentMessageList.length - 10}
                  assistantAvatarKey={currentSession.assistantAvatarKey}
                  sessionPicUrl={currentSession.picUrl}
                />
                {currentSession.messageForksHash?.[msg.id] && (
                  <ForkNav
                    sessionId={currentSession.id}
                    msgId={msg.id}
                    forks={currentSession.messageForksHash?.[msg.id]}
                  />
                )}
              </Fragment>
            )
          }}
          components={{
            // biome-ignore lint/nursery/noNestedComponentDefinitions: todo
            Footer: () =>
              isSmallScreen &&
              currentMessageList &&
              currentMessageList.filter((m) => m.role !== 'system').length > 0 && (
                <Flex justify="center" align="center" gap="sm" mx="xs" pt="xxs" pb="sm">
                  <Box h="0.5px" bg="chatbox-border-primary" flex={1} />
                  {currentThreadHash[currentMessageList[currentMessageList.length - 1].id] ? (
                    <Button
                      leftSection={<IconArrowBackUp size={16} />}
                      classNames={{
                        root: ' shadow-sm',
                        section: '!mr-xxs',
                      }}
                      size="xs"
                      c="chatbox-tertiary"
                      variant="default"
                      radius="xl"
                      onClick={() => sessionActions.removeCurrentThread(currentSession.id)}
                    >
                      {t('Back to Previous')}
                    </Button>
                  ) : (
                    <Button
                      leftSection={<IconFilePencil size={16} />}
                      classNames={{
                        section: '!mr-xxs',
                      }}
                      size="xs"
                      c="chatbox-tertiary"
                      variant="default"
                      radius="xl"
                      onClick={() => sessionActions.startNewThread()}
                    >
                      {t('Start a New Thread')}
                    </Button>
                  )}
                  <Box h="0.5px" bg="chatbox-border-primary" flex={1} />
                </Flex>
              ),
          }}
          onWheel={() => {
            scrollActions.clearAutoScroll() // 鼠标滚轮滚动时，清除自动滚动
          }}
          onTouchMove={() => {
            scrollActions.clearAutoScroll() // 手机上触摸屏幕滑动时，清除自动滚动
          }}
          atTopStateChange={setAtTop}
          atBottomThreshold={100}
          atBottomStateChange={setAtBottom}
          onScroll={handleScroll}
          totalListHeightChanged={() => {
            if (virtuoso.current) {
              virtuoso.current.getState((state) => {
                if (messageListRef.current) {
                  setMessageScrollingScrollPosition(state.scrollTop + messageListRef.current.clientHeight)
                }
              })
            }
          }}
        />
        <ThreadMenu
          threadMenuAnchorEl={threadMenuAnchorEl}
          threadMenuClickedTopicId={threadMenuClickedTopicId}
          onThreadMenuClose={closeThreadMenu}
          currentSessionId={currentSession.id}
        />

        {!isSmallScreen ? (
          <MessageNavigation
            visible={messageNavigationVisible}
            onVisibleChange={handleMessageNavigationVisibleChanged}
            onScrollToTop={handleScrollToTop}
            onScrollToBottom={handleScrollToBottom}
            onScrollToPrev={handleScrollToPrev}
            onScrollToNext={handleScrollToNext}
          />
        ) : (
          <>
            <Transition mounted={showScrollToPrev && !atTop} transition="fade-down">
              {(transitionStyle) => (
                <Button
                  className="absolute top-0 left-0 right-0 leading-tight"
                  size="xs"
                  h="auto"
                  py={6}
                  radius={0}
                  bd={0}
                  bg="chatbox-background-secondary"
                  c="chatbox-tertiary"
                  style={transitionStyle}
                  onClick={handleScrollToPrev}
                  leftSection={<IconArrowUp size={16} />}
                >
                  {t('Tap to go to previous message')}
                </Button>
              )}
            </Transition>
            <Transition mounted={!atBottom} transition="slide-up">
              {(transitionStyle) => <ScrollToBottomButton onClick={handleScrollToBottom} style={transitionStyle} />}
            </Transition>
          </>
        )}
      </div>
    </div>
  )
}

function ForkNav(props: { sessionId: string; msgId: string; forks: NonNullable<Session['messageForksHash']>[string] }) {
  const { sessionId, msgId, forks } = props
  const widthFull = useUIStore((s) => s.widthFull)
  const [flash, setFlash] = useState(false)
  const prevLength = useRef(forks.lists.length)
  const { t } = useTranslation()

  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null)
  const [, setMenuDelete] = useState<boolean>(false)
  const openMenu = (event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchorEl(event.currentTarget)
    setMenuDelete(false)
  }
  const closeMenu = () => {
    setMenuAnchorEl(null)
    setMenuDelete(false)
  }

  useEffect(() => {
    if (forks.lists.length > prevLength.current) {
      setFlash(true)
      const timer = setTimeout(() => setFlash(false), 2000)
      return () => clearTimeout(timer)
    }
    prevLength.current = forks.lists.length
  }, [forks.lists.length])

  return (
    <div className={cn('flex items-center justify-end', widthFull ? 'w-full' : 'max-w-4xl mx-auto')}>
      <div
        className={cn(
          'mt-[-35px] pr-4 inline-flex items-center gap-2',
          'opacity-50 hover:opacity-100',
          flash && 'animate-flash opacity-100 font-bold'
        )}
      >
        <IconButton
          aria-label="fork-left"
          size="small"
          className="hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"
          onClick={() => void switchFork(sessionId, msgId, 'prev')}
        >
          <ChevronLeftIcon className="w-5 h-5" />
        </IconButton>
        <div className="flex items-center gap-1 text-xs cursor-pointer" onClick={openMenu}>
          <span>{forks.position + 1}</span>
          <span>/</span>
          <span>{forks.lists.length}</span>
        </div>
        <IconButton
          aria-label="fork-right"
          size="small"
          className="hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"
          onClick={() => void switchFork(sessionId, msgId, 'next')}
        >
          <ChevronRightIcon className="w-5 h-5" />
        </IconButton>
      </div>
      <StyledMenu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={closeMenu}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
        PaperProps={{
          style: {
            minWidth: '120px',
          },
        }}
      >
        <ConfirmDeleteMenuItem
          onDelete={() => {
            void deleteFork(sessionId, msgId)
            closeMenu()
          }}
        />
      </StyledMenu>
    </div>
  )
}

type ThreadLabelProps = {
  thread: SessionThreadBrief
  onThreadLabelClick?: (event: React.MouseEvent<HTMLElement>, threadId: string) => void
}
const ThreadLabel: FC<ThreadLabelProps> = memo((props) => {
  const { t } = useTranslation()
  const { thread, onThreadLabelClick } = props
  const onClick = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      onThreadLabelClick?.(event, thread.id)
    },
    [thread.id, onThreadLabelClick]
  )

  return (
    <div className="text-center pb-4 pt-8">
      <span
        className="cursor-pointer font-bold border-solid border rounded-xxl py-2 px-3 border-slate-400/25"
        onClick={onClick}
      >
        <span className="pr-1 opacity-60">#</span>
        <span className="truncate inline-block align-bottom max-w-[calc(50%-4rem)] md:max-w-[calc(30%-4rem)]">
          {thread.name || t('New Thread')}
        </span>
        {thread.createdAtLabel && <span className="pl-1 opacity-60 text-xs">{thread.createdAtLabel}</span>}
      </span>
    </div>
  )
})

type ThreadMenuProps = {
  threadMenuAnchorEl: null | HTMLElement
  threadMenuClickedTopicId: null | string
  onThreadMenuClose?: () => void
  currentSessionId: string
}
const ThreadMenu: FC<ThreadMenuProps> = memo((props) => {
  const { t } = useTranslation()
  const { threadMenuAnchorEl, threadMenuClickedTopicId, onThreadMenuClose, currentSessionId } = props
  const setShowHistoryDrawer = useSetAtom(atoms.showThreadHistoryDrawerAtom)
  const openHistoryDrawer = useCallback(() => {
    setShowHistoryDrawer(threadMenuClickedTopicId || true)
    onThreadMenuClose?.()
  }, [threadMenuClickedTopicId, setShowHistoryDrawer, onThreadMenuClose])

  const onEditThreadNameClick = useCallback(() => {
    if (!threadMenuClickedTopicId) return
    NiceModal.show('thread-name-edit', { sessionId: currentSessionId, threadId: threadMenuClickedTopicId })

    onThreadMenuClose?.()
  }, [threadMenuClickedTopicId, currentSessionId, onThreadMenuClose])

  const onContinueThreadClick = useCallback(() => {
    if (!threadMenuClickedTopicId) return
    void switchThread(currentSessionId, threadMenuClickedTopicId)
    onThreadMenuClose?.()
  }, [threadMenuClickedTopicId, currentSessionId, onThreadMenuClose])

  const onMoveToConversationsClick = useCallback(() => {
    if (!threadMenuClickedTopicId) return
    void moveThreadToConversations(currentSessionId, threadMenuClickedTopicId)
    onThreadMenuClose?.()
  }, [threadMenuClickedTopicId, currentSessionId, onThreadMenuClose])

  const onDeleteThreadClick = useCallback(() => {
    if (!threadMenuClickedTopicId) return
    void removeThread(currentSessionId, threadMenuClickedTopicId)
    onThreadMenuClose?.()
  }, [threadMenuClickedTopicId, currentSessionId, onThreadMenuClose])

  return (
    <StyledMenu
      anchorEl={threadMenuAnchorEl}
      open={Boolean(threadMenuAnchorEl)}
      onClose={onThreadMenuClose}
      onDoubleClick={openHistoryDrawer}
      anchorOrigin={{
        vertical: 'bottom',
        horizontal: 'center',
      }}
      transformOrigin={{
        vertical: 'top',
        horizontal: 'center',
      }}
    >
      <MenuItem disableRipple onClick={onEditThreadNameClick}>
        <EditIcon fontSize="small" />
        {t('Edit Thread Name')}
      </MenuItem>

      <MenuItem disableRipple onClick={openHistoryDrawer}>
        <SegmentIcon fontSize="small" />
        {t('Show in Thread List')}
      </MenuItem>
      <MenuItem disableRipple onClick={onContinueThreadClick}>
        <SwapCallsIcon fontSize="small" />
        {t('Continue this thread')}
      </MenuItem>
      <MenuItem disableRipple divider onClick={onMoveToConversationsClick}>
        <AddIcon fontSize="small" />
        {t('Move to Conversations')}
      </MenuItem>
      <ConfirmDeleteMenuItem onDelete={onDeleteThreadClick} />
    </StyledMenu>
  )
})
