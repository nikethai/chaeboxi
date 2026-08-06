/**
 * Floating quick chat — same conversation UX as full app:
 * session shell + MessageList + InputBox + SessionStatusBar.
 * Compact header, keyboard hints, open full app.
 */
import NiceModal from '@ebay/nice-modal-react'
import { ActionIcon, Flex, Kbd, Text, Tooltip } from '@mantine/core'
import type { Message, ModelProvider } from '@shared/types'
import { IconCamera, IconClipboard, IconExternalLink, IconSettings } from '@tabler/icons-react'
import { createFileRoute } from '@tanstack/react-router'
import { useAtom } from 'jotai'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import MessageList, { type MessageListRef } from '@/components/chat/MessageList'
import SessionStatusBar from '@/components/chat/SessionStatusBar'
import InputBox from '@/components/InputBox/InputBox'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
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
import { getAllMessageList, initEmptyChatSession } from '@/stores/sessionHelpers'
import { useSettingsStore } from '@/stores/settingsStore'
import * as toastActions from '@/stores/toastActions'

export const Route = createFileRoute('/quick')({
  component: QuickChatPage,
})

function ShortcutHint({ label }: { label?: string }) {
  if (!label) return null
  const parts = label.split(/[+\-]/).filter(Boolean)
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

  const currentMessageList = useMemo(() => (session ? getAllMessageList(session) : []), [session])

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

  const lastGenerating = useMemo(
    () => currentMessageList.find((m: Message) => m.generating),
    [currentMessageList]
  )

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
    if (sessionId) {
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
      {/* Title row — same density as full session header */}
      <Flex
        align="center"
        gap="xs"
        px="md"
        py={8}
        className="quick-chat-header shrink-0 bg-[var(--chatbox-background-primary)]"
        style={{ WebkitAppRegion: 'drag' } as CSSProperties}
      >
        <Text
          size="sm"
          fw={600}
          lineClamp={1}
          className="flex-1 min-w-0 tracking-tight text-[var(--chatbox-tint-primary)]"
          style={{ letterSpacing: '-0.02em', fontSize: '0.95rem' }}
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
              onClick={() => void onClipboard()}
              aria-label={t('Attach clipboard image')}
            >
              <IconClipboard size={16} stroke={1.5} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={t('Session Settings')}>
            <ActionIcon
              variant="subtle"
              size={28}
              color="chatbox-tertiary"
              onClick={() => void onClickSessionSettings()}
              aria-label={t('Session Settings')}
            >
              <IconSettings size={16} stroke={1.5} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={t('Open full window')}>
            <ActionIcon
              variant="subtle"
              size={28}
              color="chatbox-tertiary"
              onClick={() => void openFullApp()}
              aria-label={t('Open full window')}
            >
              <IconExternalLink size={16} stroke={1.5} />
            </ActionIcon>
          </Tooltip>
        </Flex>
      </Flex>

      {/* Same thread as full session — full Message component stack */}
      <div className="session-thread">
        <MessageList
          ref={messageListRef}
          key={`quick-ml-${sessionId}`}
          currentSession={session}
          alignToBottom
        />
      </div>

      <div className="session-dock">
        <div className="session-dock-pad">
          <ErrorBoundary name="quick-inputbox">
            <InputBox
              key={`quick-input-${session.id}`}
              sessionId={session.id}
              sessionType={session.type || 'chat'}
              model={model}
              agentMode={session.agentMode ?? false}
              generating={Boolean(lastGenerating?.generating)}
              onSelectModel={onSelectModel}
              onSubmit={onSubmit}
              onStopGenerating={onStopGenerating}
              onStartNewThread={onStartNewThread}
              onRollbackThread={onRollbackThread}
              onClickSessionSettings={onClickSessionSettings}
            />
          </ErrorBoundary>
          <Flex justify="space-between" align="center" mt={8} gap="sm" wrap="wrap" className="quick-chat-hints">
            <Text size="xs" c="dimmed" className="inline-flex items-center gap-1.5 flex-wrap">
              <span>{t('Toggle')}</span>
              <ShortcutHint label={quickToggle} />
              <span className="opacity-30 mx-0.5">·</span>
              <span>{t('Screenshot')}</span>
              <ShortcutHint label={shotKey} />
            </Text>
            <button
              type="button"
              className="text-xs font-medium text-[var(--chatbox-tint-brand)] hover:underline inline-flex items-center gap-1 shrink-0"
              onClick={() => void openFullApp()}
            >
              <IconExternalLink size={12} stroke={1.75} />
              {t('Open full app')}
            </button>
          </Flex>
        </div>
        <SessionStatusBar
          messages={currentMessageList}
          modelLabel={model?.modelId}
          providerId={model?.provider}
          generating={Boolean(lastGenerating?.generating)}
          sessionId={session.id}
        />
      </div>
    </div>
  )
}
