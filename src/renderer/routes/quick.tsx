/**
 * Floating quick chat — same conversation UX as full app:
 * session shell + MessageList + InputBox + SessionStatusBar.
 * Compact header, keyboard hints, open full app.
 */
import NiceModal from '@ebay/nice-modal-react'
import { ActionIcon, Flex, Kbd, Text, Tooltip } from '@mantine/core'
import type { Message, ModelProvider } from '@shared/types'
import { IconCamera, IconClipboard, IconExternalLink } from '@tabler/icons-react'
import { createFileRoute } from '@tanstack/react-router'
import { useAtom } from 'jotai'
import { type CSSProperties, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ChatDockStack from '@/components/chat/ChatDockStack'
import MessageList, { type MessageListRef } from '@/components/chat/MessageList'
import SessionStatusBar from '@/components/chat/SessionStatusBar'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import InputBox, { type InputBoxRef } from '@/components/InputBox/InputBox'
import { formatShortcutLabel } from '@/components/Shortcut'
import { attachScreenshotToComposer } from '@/hooks/useDesktopShell'
import platform from '@/platform'
import { currentSessionIdAtom } from '@/stores/atoms'
import { createSession, listSessionsMeta, updateSessionWithMessages, useSession } from '@/stores/chatStore'
import { lastUsedModelStore } from '@/stores/lastUsedModelStore'
import {
  modifyMessage,
  removeCurrentThread,
  startNewThread,
  submitNewUserMessage,
} from '@/stores/sessionActions'
import { continueActiveSessionTasks } from '@/stores/session/messages'
import { getAllMessageList, initEmptyChatSession } from '@/stores/sessionHelpers'
import { useSettingsStore } from '@/stores/settingsStore'
import * as toastActions from '@/stores/toastActions'
import { isThreadVisuallyEmpty } from '@/utils/chat-starters'

export const Route = createFileRoute('/quick')({
  component: QuickChatPage,
})

function ShortcutHint({ label }: { label?: string }) {
  if (!label) return null
  const parts = label.split(/[+-]/).filter(Boolean)
  if (parts.length === 0) return null
  return (
    <span className="inline-flex items-center gap-0.5 opacity-70">
      {parts.map((p) => (
        <Kbd key={p} size="xs" className="!text-[10px] !px-1 !min-w-0 !h-auto !leading-none py-0.5">
          {formatShortcutLabel(p)}
        </Kbd>
      ))}
    </span>
  )
}

function QuickChatPage() {
  const { t } = useTranslation()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const messageListRef = useRef<MessageListRef>(null)
  const inputBoxRef = useRef<InputBoxRef>(null)
  const { session } = useSession(sessionId)
  const [cachedSessionId, setCachedSessionId] = useAtom(currentSessionIdAtom)
  const shortcuts = useSettingsStore((s) => s.shortcuts)

  // Same session as full app
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const list = await listSessionsMeta()
      const chatSessions = list.filter((s) => !s.type || s.type === 'chat')

      let target: string | null = null
      if (cachedSessionId && chatSessions.some((s) => s.id === cachedSessionId)) {
        target = cachedSessionId
      } else if (chatSessions[0]?.id) {
        target = chatSessions[0].id
      }

      if (cancelled) return
      if (target) {
        setSessionId(target)
        setCachedSessionId(target)
        return
      }
      const created = await createSession({
        ...initEmptyChatSession(),
      })
      if (!cancelled) {
        setSessionId(created.id)
        setCachedSessionId(created.id)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [cachedSessionId, setCachedSessionId])

  useEffect(() => {
    void platform.notifyQuickRendererReady?.()
    return () => {
      void platform.notifyQuickRendererGone?.()
    }
  }, [])

  // Portaled popovers leave .quick-chat-shell — flag root early so density CSS applies same paint.
  useLayoutEffect(() => {
    const root = document.documentElement
    root.dataset.quickChat = '1'
    return () => {
      delete root.dataset.quickChat
    }
  }, [])

  const currentMessageList = useMemo(() => (session ? getAllMessageList(session) : []), [session])
  const threadEmpty = useMemo(() => isThreadVisuallyEmpty(currentMessageList), [currentMessageList])

  const model = useMemo(() => {
    if (session?.settings?.provider && session?.settings?.modelId) {
      return { provider: session.settings.provider, modelId: session.settings.modelId }
    }
    const chat = lastUsedModelStore.getState().chat
    if (chat) {
      return { provider: chat.provider, modelId: chat.modelId }
    }
    return undefined
  }, [session?.settings?.provider, session?.settings?.modelId])

  const lastGenerating = useMemo(() => currentMessageList.find((m: Message) => m.generating), [currentMessageList])

  const onSelectModel = useCallback(
    (provider: ModelProvider | string, modelId: string) => {
      if (!session) return
      void updateSessionWithMessages(session.id, {
        settings: {
          ...(session.settings || {}),
          provider: provider as ModelProvider,
          modelId,
        },
      })
      lastUsedModelStore.getState().setChatModel(provider as ModelProvider, modelId)
    },
    [session]
  )

  const onSubmit = useCallback(
    async ({
      constructedMessage,
      needGenerating = true,
      onUserMessageReady,
    }: {
      constructedMessage: Message
      needGenerating?: boolean
      onUserMessageReady?: () => void
    }) => {
      if (!session) return
      messageListRef.current?.scrollToBottom('instant')
      await submitNewUserMessage(session.id, {
        newUserMsg: constructedMessage,
        needGenerating,
        onUserMessageReady,
      })
    },
    [session]
  )

  const onStopGenerating = useCallback(() => {
    if (!session || !lastGenerating?.generating) return false
    lastGenerating.cancel?.()
    void modifyMessage(session.id, { ...lastGenerating, generating: false }, true)
    return true
  }, [session, lastGenerating])

  const onContinueTasks = useCallback(() => {
    if (!session) return
    void continueActiveSessionTasks(session.id)
  }, [session])

  const onStartNewThread = useCallback(() => {
    if (!session) return false
    void startNewThread(session.id)
    return true
  }, [session])

  const onRollbackThread = useCallback(() => {
    if (!session) return false
    void removeCurrentThread(session.id)
    return true
  }, [session])

  const onClickSessionSettings = useCallback(() => {
    if (!session) return false
    void NiceModal.show('session-settings', { session })
    return true
  }, [session])

  const openFullApp = useCallback(async () => {
    // Ensure main reloads this session from shared store before/as it focuses
    if (sessionId) {
      const { broadcastSessionChanged, invalidateAndRefetchSession } = await import('@/stores/chatStore')
      await broadcastSessionChanged(sessionId)
      // Local no-op for main; main will also get event + focus refetch
      void invalidateAndRefetchSession(sessionId)
      await platform.openSessionInMain?.(sessionId)
    } else {
      await platform.showMainWindow?.()
    }
  }, [sessionId])

  const onScreenshot = useCallback(async () => {
    try {
      const payload = await platform.captureScreenshotRegion?.()
      if (payload) {
        await attachScreenshotToComposer(payload)
        toastActions.add(t('Screenshot attached to chat'))
      }
    } catch (err) {
      toastActions.add(String(err) || t('Screenshot failed'))
    }
  }, [t])

  const onClipboard = useCallback(async () => {
    try {
      const payload = await platform.readClipboardImage?.()
      if (!payload) {
        toastActions.add(t('No image on clipboard'))
        return
      }
      await attachScreenshotToComposer(payload)
      toastActions.add(t('Screenshot attached to chat'))
    } catch (err) {
      toastActions.add(String(err) || t('Failed to attach screenshot'))
    }
  }, [t])

  // Focus composer + jump to latest when switching sessions / first open
  useEffect(() => {
    if (!session) return
    const tId = window.setTimeout(() => {
      messageListRef.current?.scrollToBottom('auto')
      document.getElementById('message-input')?.focus()
    }, 150)
    return () => window.clearTimeout(tId)
  }, [session?.id])

  // Keep bottom while streaming / new turns
  useEffect(() => {
    if (!session) return
    messageListRef.current?.scrollToBottom('smooth')
  }, [session?.id, lastGenerating?.id, lastGenerating?.generating])

  if (!sessionId || !session) {
    return (
      <div className="session-shell flex items-center justify-center">
        <Text size="sm" c="dimmed">
          {t('Loading…')}
        </Text>
      </div>
    )
  }

  const quickToggle = shortcuts?.quickToggle || 'Alt+`'
  const shotKey = shortcuts?.screenshotToChat || 'Alt+Shift+S'

  return (
    <div className="session-shell quick-chat-shell">
      {/* Compact floating header — shortcuts live in tooltips, not a footer row */}
      <Flex
        align="center"
        gap="xs"
        px="sm"
        py={6}
        className="quick-chat-header shrink-0 bg-[var(--chatbox-background-primary)]"
        style={{ WebkitAppRegion: 'drag' } as CSSProperties}
      >
        <Text
          size="sm"
          fw={600}
          lineClamp={1}
          className="flex-1 min-w-0 tracking-tight text-[var(--chatbox-tint-primary)]"
          style={{ letterSpacing: '-0.02em', fontSize: '0.9rem' }}
          title={session.name}
        >
          {session.name || t('Quick Chat')}
        </Text>
        <Flex gap={2} className="shrink-0 controls" style={{ WebkitAppRegion: 'no-drag' } as CSSProperties}>
          <Tooltip
            label={
              <span className="inline-flex items-center gap-1.5">
                {t('Screenshot to Chat')}
                <ShortcutHint label={shotKey} />
              </span>
            }
          >
            <ActionIcon
              variant="subtle"
              size={28}
              color="chatbox-tertiary"
              className="active:scale-[0.96] transition-transform"
              onClick={() => void onScreenshot()}
              aria-label={t('Screenshot to Chat')}
            >
              <IconCamera size={16} stroke={1.5} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={t('Attach clipboard image')}>
            <ActionIcon
              variant="subtle"
              size={28}
              color="chatbox-tertiary"
              className="active:scale-[0.96] transition-transform"
              onClick={() => void onClipboard()}
              aria-label={t('Attach clipboard image')}
            >
              <IconClipboard size={16} stroke={1.5} />
            </ActionIcon>
          </Tooltip>
          <Tooltip
            label={
              <span className="inline-flex items-center gap-1.5">
                {t('Open full app')}
                <span className="opacity-50">·</span>
                <span className="opacity-80">{t('Toggle')}</span>
                <ShortcutHint label={quickToggle} />
              </span>
            }
          >
            <ActionIcon
              variant="subtle"
              size={28}
              color="chatbox-tertiary"
              className="active:scale-[0.96] transition-transform"
              onClick={() => void openFullApp()}
              aria-label={t('Open full app')}
            >
              <IconExternalLink size={16} stroke={1.5} />
            </ActionIcon>
          </Tooltip>
        </Flex>
      </Flex>

      {/* Same thread as full session — full Message component stack */}
      <div className="session-thread">
        <MessageList ref={messageListRef} key={`quick-ml-${sessionId}`} currentSession={session} alignToBottom />
      </div>

      <div className="session-dock">
        <div className="session-dock-pad">
          <ChatDockStack
            key={session.id}
            sessionId={session.id}
            onContinueTasks={onContinueTasks}
            taskDetailsMode="sheet"
          >
            <ErrorBoundary name="quick-inputbox">
              <InputBox
                key={`quick-input-${session.id}`}
                ref={inputBoxRef}
                sessionId={session.id}
                sessionType={session.type || 'chat'}
                model={model}
                agentMode={session.agentMode ?? false}
                workspaceRoot={session.workspaceRoot}
                generating={Boolean(lastGenerating?.generating)}
                onSelectModel={onSelectModel}
                onSubmit={onSubmit}
                onStopGenerating={onStopGenerating}
                onStartNewThread={onStartNewThread}
                onRollbackThread={onRollbackThread}
                onClickSessionSettings={onClickSessionSettings}
                onToggleAgentMode={(agentMode) => {
                  void updateSessionWithMessages(session.id, { agentMode })
                }}
                onWorkspaceRootChange={(workspaceRoot) => {
                  void updateSessionWithMessages(session.id, { workspaceRoot })
                }}
              />
            </ErrorBoundary>
          </ChatDockStack>
        </div>
        <SessionStatusBar
          messages={currentMessageList}
          modelLabel={model?.modelId}
          providerId={model?.provider}
          generating={Boolean(lastGenerating?.generating)}
          sessionId={session.id}
          empty={threadEmpty}
          compact
          onInsertMemory={(content) => inputBoxRef.current?.insertMemory(content)}
          getMemorySaveContent={() => inputBoxRef.current?.getMemorySaveContent() ?? ''}
        />
      </div>
    </div>
  )
}
