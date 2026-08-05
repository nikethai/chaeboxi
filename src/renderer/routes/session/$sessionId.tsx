import NiceModal from '@ebay/nice-modal-react'
import { Button, Flex, Text } from '@mantine/core'
import { type Message, type ModelProvider, ModelProviderEnum } from '@shared/types'
import { IconMessage, IconShield } from '@tabler/icons-react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { type FC, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import MessageList, { type MessageListRef } from '@/components/chat/MessageList'
import SessionStatusBar from '@/components/chat/SessionStatusBar'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import InputBox from '@/components/InputBox/InputBox'
import Header from '@/components/layout/Header'
import ThreadHistoryDrawer from '@/components/session/ThreadHistoryDrawer'
import { updateSessionWithMessages as updateSessionStore, useSession } from '@/stores/chatStore'
import { lastUsedModelStore } from '@/stores/lastUsedModelStore'
import * as scrollActions from '@/stores/scrollActions'
import { modifyMessage, removeCurrentThread, startNewThread, submitNewUserMessage } from '@/stores/sessionActions'
import { getAllMessageList } from '@/stores/sessionHelpers'
import { CHATBOX_BUILD_PLATFORM } from '@/variables'

// Agent-mode panels are not used on Android. Use compile-time conditional
// dynamic imports so the modules (and their @mantine/openclaw deps) are
// fully tree-shaken from the Android session chunk.
const isAgentEnabled = CHATBOX_BUILD_PLATFORM !== 'android'

const SessionPanel = isAgentEnabled ? lazy(() => import('@/openclaw/components/SessionPanel')) : null
const ToolAuditPanel = isAgentEnabled
  ? lazy(() => import('@/components/ToolAuditPanel').then((m) => ({ default: m.ToolAuditPanel })))
  : null
const TaskProgress = isAgentEnabled
  ? lazy(() => import('@/components/TaskProgress/TaskProgress').then((m) => ({ default: m.TaskProgress })))
  : null

export const Route = createFileRoute('/session/$sessionId')({
  component: RouteComponent,
})

function RouteComponent() {
  const { t } = useTranslation()
  const { sessionId: currentSessionId } = Route.useParams()
  const navigate = useNavigate()
  const { session: currentSession, isFetching } = useSession(currentSessionId)
  const [showToolAudit, setShowToolAudit] = useState(false)

  const currentMessageList = useMemo(() => (currentSession ? getAllMessageList(currentSession) : []), [currentSession])
  const lastGeneratingMessage = useMemo(
    () => currentMessageList.find((m: Message) => m.generating),
    [currentMessageList]
  )

  const messageListRef = useRef<MessageListRef>(null)

  const goHome = useCallback(() => {
    navigate({ to: '/', replace: true })
  }, [navigate])

  useEffect(() => {
    setTimeout(() => {
      scrollActions.scrollToBottom('auto') // 每次启动时自动滚动到底部
    }, 200)
  }, [])

  // currentSession变化时（包括session settings变化），存下当前的settings作为新Session的默认值
  const currentSessionType = currentSession?.type
  const currentSessionProvider = currentSession?.settings?.provider
  const currentSessionModelId = currentSession?.settings?.modelId
  useEffect(() => {
    if (!currentSessionType || !currentSessionProvider || !currentSessionModelId) {
      return
    }

    const { chat, picture, setChatModel, setPictureModel } = lastUsedModelStore.getState()
    if (
      currentSessionType === 'chat' &&
      (chat?.provider !== currentSessionProvider || chat?.modelId !== currentSessionModelId)
    ) {
      setChatModel(currentSessionProvider, currentSessionModelId)
      return
    }
    if (
      currentSessionType === 'picture' &&
      (picture?.provider !== currentSessionProvider || picture?.modelId !== currentSessionModelId)
    ) {
      setPictureModel(currentSessionProvider, currentSessionModelId)
    }
  }, [currentSessionType, currentSessionProvider, currentSessionModelId])

  const onSelectModel = useCallback(
    (provider: ModelProvider, modelId: string) => {
      if (!currentSession) {
        return
      }
      void updateSessionStore(currentSession.id, {
        messages:
          provider === ModelProviderEnum.OpenClaw
            ? currentSession.messages.filter((message) => message.role !== 'system')
            : currentSession.messages,
        settings: {
          ...(currentSession.settings || {}),
          provider,
          modelId,
        },
      })
    },
    [currentSession]
  )

  const onStartNewThread = useCallback(() => {
    if (!currentSession) {
      return false
    }
    void startNewThread(currentSession.id)
    return true
  }, [currentSession])

  const onRollbackThread = useCallback(() => {
    if (!currentSession) {
      return false
    }
    void removeCurrentThread(currentSession.id)
    return true
  }, [currentSession])

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
      if (!currentSession) {
        return
      }
      messageListRef.current?.scrollToBottom('instant')
      await submitNewUserMessage(currentSession.id, {
        newUserMsg: constructedMessage,
        needGenerating,
        onUserMessageReady,
      })
    },
    [currentSession]
  )

  const onClickSessionSettings = useCallback(() => {
    if (!currentSession) {
      return false
    }
    NiceModal.show('session-settings', {
      session: currentSession,
    })
    return true
  }, [currentSession])

  const onStopGenerating = useCallback(() => {
    if (!currentSession) {
      return false
    }
    if (lastGeneratingMessage?.generating) {
      lastGeneratingMessage?.cancel?.()
      void modifyMessage(currentSession.id, { ...lastGeneratingMessage, generating: false }, true)
    }
    return true
  }, [currentSession, lastGeneratingMessage])

  const model = useMemo(() => {
    if (!currentSession?.settings?.modelId || !currentSession?.settings?.provider) {
      return undefined
    }
    return {
      provider: currentSession.settings.provider,
      modelId: currentSession.settings.modelId,
    }
  }, [currentSession?.settings?.provider, currentSession?.settings?.modelId])

  const isOpenClawProvider = currentSession?.settings?.provider === ModelProviderEnum.OpenClaw
  const [showSessionPanel, setShowSessionPanel] = useState(false)

  return currentSession ? (
    <div className="session-shell">
      <Header session={currentSession} />

      {/* MessageList 设置 key，确保每个 session 对应新的 MessageList 实例 */}
      <div className="session-thread">
        <MessageList ref={messageListRef} key={`message-list${currentSessionId}`} currentSession={currentSession} />
      </div>

      {/* <ScrollButtons /> */}
      {TaskProgress && (
        <Suspense fallback={null}>
          <TaskProgress sessionId={currentSession.id} />
        </Suspense>
      )}

      {/* Agent chrome — compact strip above composer (OpenClaw + tool audit) */}
      {isAgentEnabled && isOpenClawProvider && (
        <div className="agent-dock">
          <div className="agent-dock-bar chat-col">
            <Flex align="center" justify="space-between" gap="sm" className="min-w-0 w-full">
              <Text className="agent-dock-label" lineClamp={1}>
                {t('Agent')}
              </Text>
              <Flex align="center" gap={6} className="shrink-0">
                <button
                  type="button"
                  className={`agent-dock-chip ${showSessionPanel ? 'is-on' : ''}`}
                  onClick={() => setShowSessionPanel((v) => !v)}
                  aria-pressed={showSessionPanel}
                >
                  <IconMessage size={14} stroke={1.5} />
                  <span>{t('Gateway')}</span>
                </button>
                <button
                  type="button"
                  className={`agent-dock-chip ${showToolAudit ? 'is-on' : ''}`}
                  onClick={() => setShowToolAudit((v) => !v)}
                  aria-pressed={showToolAudit}
                >
                  <IconShield size={14} stroke={1.5} />
                  <span>{t('Audit')}</span>
                </button>
              </Flex>
            </Flex>
          </div>
          {showSessionPanel && SessionPanel && (
            <div className="agent-dock-panel chat-col">
              <Suspense fallback={null}>
                <SessionPanel />
              </Suspense>
            </div>
          )}
          {showToolAudit && ToolAuditPanel && (
            <div className="agent-dock-panel chat-col">
              <Suspense fallback={null}>
                <ToolAuditPanel sessionId={currentSession.id} />
              </Suspense>
            </div>
          )}
        </div>
      )}

      <div className="session-dock">
        <div className="session-dock-pad">
          <ErrorBoundary name="session-inputbox">
            <InputBox
              key={`input-box${currentSession.id}`}
              sessionId={currentSession.id}
              sessionType={currentSession.type}
              model={model}
              agentMode={currentSession.agentMode ?? false}
              onStartNewThread={onStartNewThread}
              onRollbackThread={onRollbackThread}
              onSelectModel={onSelectModel}
              onToggleAgentMode={(agentMode) => {
                void updateSessionStore(currentSession.id, { agentMode })
              }}
              onClickSessionSettings={onClickSessionSettings}
              generating={!!lastGeneratingMessage}
              onSubmit={onSubmit}
              onStopGenerating={onStopGenerating}
            />
          </ErrorBoundary>
        </div>
        <SessionStatusBar
          messages={currentMessageList}
          modelLabel={model?.modelId}
          providerId={model?.provider}
          generating={!!lastGeneratingMessage}
        />
      </div>
      <ThreadHistoryDrawer session={currentSession} />
    </div>
  ) : (
    !isFetching && (
      <div className="flex flex-1 flex-col items-center justify-center min-h-[60vh]">
        <div className="text-2xl font-semibold text-gray-700 mb-4">{t('Conversation not found')}</div>
        <Button variant="outline" onClick={goHome}>
          {t('Back to HomePage')}
        </Button>
      </div>
    )
  )
}
