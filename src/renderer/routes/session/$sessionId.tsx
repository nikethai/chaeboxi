import NiceModal from '@ebay/nice-modal-react'
import ArrowCircleDownIcon from '@mui/icons-material/ArrowCircleDown'
import ArrowCircleUpIcon from '@mui/icons-material/ArrowCircleUp'
import { Box, ButtonGroup, IconButton } from '@mui/material'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAtomValue } from 'jotai'
import { useCallback, useEffect, useMemo } from 'react'
import type { Message, ModelProvider } from 'src/shared/types'
import { useStore } from 'zustand'
import Header from '@/components/Header'
import InputBox from '@/components/InputBox/InputBox'
import MessageList from '@/components/MessageList'
import ThreadHistoryDrawer from '@/components/ThreadHistoryDrawer'
import * as atoms from '@/stores/atoms'
import { lastUsedModelStore } from '@/stores/lastUsedModelStore'
import * as scrollActions from '@/stores/scrollActions'
import * as sessionActions from '@/stores/sessionActions'
import { getSessionAsync, saveSession } from '@/stores/sessionStorageMutations'
import { useLanguage } from '@/stores/settingsStore'
import { useUIStore } from '@/stores/uiStore'

export const Route = createFileRoute('/session/$sessionId')({
  component: RouteComponent,
})

function RouteComponent() {
  const { sessionId: currentSessionId } = Route.useParams()
  const navigate = useNavigate()
  const currentSession = useAtomValue(atoms.currentSessionAtom)
  const setLastUsedChatModel = useStore(lastUsedModelStore, (state) => state.setChatModel)
  const setLastUsedPictureModel = useStore(lastUsedModelStore, (state) => state.setPictureModel)
  const lastMessage = currentSession?.messages.length
    ? currentSession.messages[currentSession.messages.length - 1]
    : null

  useEffect(() => {
    let cancelled = false

    if (!currentSession && currentSessionId) {
      getSessionAsync(currentSessionId).then((session) => {
        if (!cancelled && !session) {
          navigate({ to: '/', replace: true })
        }
      })
    }

    return () => {
      cancelled = true
    }
  }, [currentSession, currentSessionId, navigate])

  useEffect(() => {
    setTimeout(() => {
      scrollActions.scrollToBottom('auto') // 每次启动时自动滚动到底部
    }, 200)
  }, [])

  // currentSession变化时（包括session settings变化），存下当前的settings作为新Session的默认值
  useEffect(() => {
    if (currentSession) {
      if (currentSession.type === 'chat' && currentSession.settings) {
        const { provider, modelId } = currentSession.settings
        if (provider && modelId) {
          setLastUsedChatModel(provider, modelId)
        }
      }
      if (currentSession.type === 'picture' && currentSession.settings) {
        const { provider, modelId } = currentSession.settings
        if (provider && modelId) {
          setLastUsedPictureModel(provider, modelId)
        }
      }
    }
  }, [currentSession?.settings, currentSession?.type, currentSession, setLastUsedChatModel, setLastUsedPictureModel])

  const onSelectModel = useCallback(
    (provider: ModelProvider, modelId: string) => {
      if (!currentSession) {
        return
      }
      saveSession(currentSession.id, {
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
    sessionActions.startNewThread()
    return true
  }, [])

  const onRollbackThread = useCallback(() => {
    sessionActions.removeCurrentThread(currentSessionId)
    return true
  }, [currentSessionId])

  const onSubmit = useCallback(
    async ({
      constructedMessage,
      needGenerating = true,
    }: {
      constructedMessage: Message
      needGenerating?: boolean
    }) => {
      await sessionActions.submitNewUserMessage({
        currentSessionId: currentSessionId,
        newUserMsg: constructedMessage,
        needGenerating,
      })
    },
    [currentSessionId]
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
    if (lastMessage?.generating) {
      lastMessage?.cancel?.()
      sessionActions.modifyMessage(currentSession.id, { ...lastMessage, generating: false }, true)
    }
    return true
  }, [currentSession, lastMessage])

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
      <Header />

      {/* MessageList 设置 key，确保每个 session 对应新的 MessageList 实例 */}
      <MessageList key={`message-list${currentSessionId}`} currentSession={currentSession} />

      {/* <ScrollButtons /> */}
      <InputBox
        key={`input-box${currentSession.id}`}
        sessionId={currentSession.id}
        sessionType={currentSession.type}
        model={model}
        onStartNewThread={onStartNewThread}
        onRollbackThread={onRollbackThread}
        onSelectModel={onSelectModel}
        onClickSessionSettings={onClickSessionSettings}
        generating={lastMessage?.generating}
        onSubmit={onSubmit}
        onStopGenerating={onStopGenerating}
      />
      {/* <InputBox /> */}
      <ThreadHistoryDrawer />
    </div>
  ) : null
}

function ScrollButtons() {
  const atScrollTop = useUIStore((s) => s.messageScrollingAtTop)
  const atScrollBottom = useUIStore((s) => s.messageScrollingAtBottom)
  const language = useLanguage()
  return (
    <Box className="relative">
      <ButtonGroup
        sx={
          language === 'ar'
            ? {
                position: 'absolute',
                left: '0.4rem',
                top: '-5.5rem',
                opacity: 0.6,
              }
            : {
                position: 'absolute',
                right: '0.4rem',
                top: '-5.5rem',
                opacity: 0.6,
              }
        }
        orientation="vertical"
      >
        <IconButton
          onClick={() => scrollActions.scrollToTop()}
          sx={{
            visibility: atScrollTop ? 'hidden' : 'visible',
          }}
        >
          <ArrowCircleUpIcon />
        </IconButton>
        <IconButton
          onClick={() => scrollActions.scrollToBottom()}
          sx={{
            visibility: atScrollBottom ? 'hidden' : 'visible',
          }}
        >
          <ArrowCircleDownIcon />
        </IconButton>
      </ButtonGroup>
    </Box>
  )
}
