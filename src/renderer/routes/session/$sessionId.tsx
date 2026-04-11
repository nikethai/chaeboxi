import NiceModal from '@ebay/nice-modal-react'
import { ActionIcon, Button, Flex, Tooltip } from '@mantine/core'
import { ModelProviderEnum, type Message, type ModelProvider } from '@shared/types'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { IconShield } from '@tabler/icons-react'
import { type FC, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import MessageList, { type MessageListRef } from '@/components/chat/MessageList'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { CostDashboard } from '@/components/CostDashboard'
import InputBox from '@/components/InputBox/InputBox'
import Header from '@/components/layout/Header'
import ThreadHistoryDrawer from '@/components/session/ThreadHistoryDrawer'
import { ToolAuditPanel } from '@/components/ToolAuditPanel'
import { TaskProgress } from '@/components/TaskProgress/TaskProgress'
import { updateSession as updateSessionStore, useSession } from '@/stores/chatStore'
import { lastUsedModelStore } from '@/stores/lastUsedModelStore'
import * as scrollActions from '@/stores/scrollActions'
import { modifyMessage, removeCurrentThread, startNewThread, submitNewUserMessage } from '@/stores/sessionActions'
import { getAllMessageList } from '@/stores/sessionHelpers'

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

  return currentSession ? (
    <div className="flex flex-col h-full">
      <Header session={currentSession} />

      {/* MessageList 设置 key，确保每个 session 对应新的 MessageList 实例 */}
      <MessageList ref={messageListRef} key={`message-list${currentSessionId}`} currentSession={currentSession} />

      {/* <ScrollButtons /> */}
      <TaskProgress sessionId={currentSession.id} />
      <Flex justify="flex-end" px="sm" py="xs">
        <Tooltip label={t('Tool Audit')}>
          <ActionIcon
            variant={showToolAudit ? 'filled' : 'subtle'}
            size="sm"
            color={showToolAudit ? 'chatbox-primary' : 'chatbox-tertiary'}
            onClick={() => setShowToolAudit((v) => !v)}
          >
            <IconShield size={16} />
          </ActionIcon>
        </Tooltip>
      </Flex>
      {showToolAudit && <ToolAuditPanel sessionId={currentSession.id} />}
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
      <CostDashboard messages={currentMessageList} />
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
