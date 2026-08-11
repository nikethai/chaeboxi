import NiceModal from '@ebay/nice-modal-react'
import { Button } from '@mantine/core'
import { toSessionAgentFieldsFromSelection } from '@shared/new-chat-agents'
import { ModelProviderEnum, type Session } from '@shared/types'
import { createFileRoute, useRouterState } from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'
import InputBox, { type InputBoxPayload } from '@/components/InputBox/InputBox'
import Page from '@/components/layout/Page'
import NewChatAgentBar from '@/components/new-chat/NewChatAgentBar'
import { useMyCopilots, useRemoteCopilots } from '@/hooks/useCopilots'
import { useProviders } from '@/hooks/useProviders'
import { createSession as createSessionStore } from '@/stores/chatStore'
import { submitNewUserMessage, switchCurrentSession } from '@/stores/sessionActions'
import { initEmptyChatSession } from '@/stores/sessionHelpers'
import { useUIStore } from '@/stores/uiStore'
import BlankStateStarters from './-components/BlankStateStarters'

/** Dock center → bottom transition duration (must match CSS). */
const BLANK_DOCK_MOVE_MS = 420

export const Route = createFileRoute('/')({
  component: Index,
  validateSearch: zodValidator(
    z.object({
      copilotId: z.string().optional(),
    })
  ),
})

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function Index() {
  const { t } = useTranslation()

  const newSessionState = useUIStore((s) => s.newSessionState)
  const setNewSessionState = useUIStore((s) => s.setNewSessionState)
  const addSessionKnowledgeBase = useUIStore((s) => s.addSessionKnowledgeBase)
  const showCopilotsInNewSession = useUIStore((s) => s.showCopilotsInNewSession)
  const sessionWebBrowsingMap = useUIStore((s) => s.sessionWebBrowsingMap)
  const setSessionWebBrowsing = useUIStore((s) => s.setSessionWebBrowsing)
  const clearSessionWebBrowsing = useUIStore((s) => s.clearSessionWebBrowsing)
  const [session, setSession] = useState<Session>({
    id: 'new',
    ...initEmptyChatSession(),
  })
  const [composerDraft, setComposerDraft] = useState('')
  const [composerKey, setComposerKey] = useState(0)
  /** Center → bottom dock animation in progress (blocks double-submit). */
  const [isSending, setIsSending] = useState(false)

  const fillComposer = useCallback((text: string) => {
    // Persist first so remounted useMessageInput restore cannot race with empty draft
    localStorage.setItem('new-chat', text)
    setComposerDraft(text)
    setComposerKey((key) => key + 1)
    requestAnimationFrame(() => {
      const el = document.getElementById('message-input') as HTMLElement | null
      el?.focus()
      // contenteditable: place caret at end of starter text
      if (el && typeof window.getSelection === 'function') {
        const range = document.createRange()
        range.selectNodeContents(el)
        range.collapse(false)
        const sel = window.getSelection()
        sel?.removeAllRanges()
        sel?.addRange(range)
      }
    })
  }, [])

  const { providers } = useProviders()

  const selectedModel = useMemo(() => {
    if (session.settings?.provider && session.settings?.modelId) {
      return {
        provider: session.settings.provider,
        modelId: session.settings.modelId,
      }
    }
  }, [session.settings?.provider, session.settings?.modelId])

  const { copilots: myCopilots } = useMyCopilots()
  const { copilots: remoteCopilots } = useRemoteCopilots()

  const allAgents = useMemo(() => {
    const map = new Map<string, (typeof myCopilots)[0]>()
    for (const agent of myCopilots) map.set(agent.id, agent)
    for (const agent of remoteCopilots || []) {
      if (!map.has(agent.id)) map.set(agent.id, agent)
    }
    return Array.from(map.values())
  }, [myCopilots, remoteCopilots])

  const selectedAgentIds = useMemo(
    () => session.agentIds ?? (session.copilotId ? [session.copilotId] : []),
    [session.agentIds, session.copilotId]
  )

  const selectedAgents = useMemo(
    () => selectedAgentIds.map((id) => allAgents.find((agent) => agent.id === id)).filter(Boolean) as typeof allAgents,
    [selectedAgentIds, allAgents]
  )

  const primaryAgent = selectedAgents[0]

  // Persona inject: only for exactly one agent. Multi uses room per-speaker prompts after create.
  useEffect(() => {
    setSession((old) => {
      if (selectedAgentIds.length === 1 && primaryAgent) {
        return {
          ...old,
          picUrl: primaryAgent.emojiAvatar ? undefined : primaryAgent.picUrl,
          name: primaryAgent.name || 'Untitled',
          messages: [
            {
              id: uuidv4(),
              role: 'system',
              contentParts: [{ type: 'text', text: primaryAgent.prompt || '' }],
            },
          ],
        }
      }
      if (selectedAgentIds.length >= 2 && primaryAgent) {
        return {
          ...old,
          picUrl: primaryAgent.emojiAvatar ? undefined : primaryAgent.picUrl,
          name: primaryAgent.name || 'Untitled',
          messages: initEmptyChatSession().messages,
        }
      }
      return {
        ...old,
        picUrl: undefined,
        name: 'Untitled',
        messages: initEmptyChatSession().messages,
      }
    })
    // primaryAgent identity by id+prompt; avoid full object churn
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedAgentIds.join(','),
    primaryAgent?.id,
    primaryAgent?.prompt,
    primaryAgent?.name,
    primaryAgent?.picUrl,
    primaryAgent?.emojiAvatar,
  ])

  const routerState = useRouterState()
  useEffect(() => {
    const { copilotId } = routerState.location.search
    if (copilotId) {
      const fields = toSessionAgentFieldsFromSelection([copilotId])
      setSession((old) => ({ ...old, ...fields }))
    }
  }, [routerState.location.search])

  const handleAgentIdsChange = useCallback((ids: string[]) => {
    const fields = toSessionAgentFieldsFromSelection(ids)
    setSession((old) => ({ ...old, ...fields }))
  }, [])

  const handleSubmit = useCallback(
    async ({ constructedMessage, needGenerating = true, onUserMessageReady }: InputBoxPayload) => {
      if (isSending) return
      setIsSending(true)

      // Center → bottom motion runs in parallel with session create + first message.
      // Never delay create/send behind the animation (that was dropping sends).
      const animDone =
        prefersReducedMotion()
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              window.setTimeout(resolve, BLANK_DOCK_MOVE_MS)
            })

      try {
        const agentIds = session.agentIds?.length
          ? session.agentIds
          : session.copilotId
            ? [session.copilotId]
            : constructedMessage.mentionedAgentIds

        // Ensure first message can resolve room speakers even without re-@ chips
        const userMsg =
          agentIds && agentIds.length >= 2 && !constructedMessage.mentionedAgentIds?.length
            ? { ...constructedMessage, mentionedAgentIds: agentIds }
            : constructedMessage

        const newSession = await createSessionStore({
          name: session.name,
          type: 'chat',
          assistantAvatarKey: session.assistantAvatarKey,
          picUrl: session.picUrl,
          messages: session.messages,
          copilotId: agentIds?.[0] ?? session.copilotId,
          agentIds,
          roomMode: session.roomMode,
          roomLeadId: agentIds?.[0],
          agentMode: session.agentMode,
          workspaceRoot: session.workspaceRoot,
          settings: session.settings,
        })

        if (newSessionState.knowledgeBase) {
          addSessionKnowledgeBase(newSession.id, newSessionState.knowledgeBase)
          setNewSessionState({})
        }

        const newSessionWebBrowsing = sessionWebBrowsingMap.new
        if (newSessionWebBrowsing !== undefined) {
          setSessionWebBrowsing(newSession.id, newSessionWebBrowsing)
          clearSessionWebBrowsing('new')
        }

        // Start insert + generation immediately so the session is not empty on navigate.
        void submitNewUserMessage(newSession.id, {
          newUserMsg: userMsg,
          needGenerating,
          onUserMessageReady,
        })

        // Let the dock settle at the bottom, then enter the thread.
        await animDone
        switchCurrentSession(newSession.id)
      } catch (err) {
        console.error('Failed to start new chat', err)
        setIsSending(false)
      }
    },
    [
      isSending,
      session,
      addSessionKnowledgeBase,
      newSessionState.knowledgeBase,
      setNewSessionState,
      sessionWebBrowsingMap,
      setSessionWebBrowsing,
      clearSessionWebBrowsing,
    ]
  )

  const onSelectModel = useCallback((provider: string, modelId: string) => {
    setSession((old) => ({
      ...old,
      messages:
        provider === ModelProviderEnum.OpenClaw
          ? old.messages.filter((message) => message.role !== 'system')
          : old.messages,
      settings: {
        ...(old.settings || {}),
        provider,
        modelId,
      },
    }))
  }, [])

  const onClickSessionSettings = useCallback(async () => {
    const res: Session = await NiceModal.show('session-settings', {
      session,
      disableAutoSave: true,
    })
    if (res) {
      setSession((old) => ({
        ...old,
        ...res,
      }))
    }
    return true
  }, [session])

  return (
    <Page title="">
      <div className={`session-shell blank-home${isSending ? ' blank-home--sending' : ''}`}>
        <div className="blank-home-grow blank-home-grow-top" aria-hidden />

        <div className="blank-home-cluster">
          <div className="blank-home-greeting">
            <h1 className="blank-title blank-enter">{t('What can I help with?')}</h1>
            {!providers.length && (
              <Button
                size="sm"
                variant="light"
                color="chatbox-brand"
                className="blank-enter blank-setup-cta"
                style={{ animationDelay: '80ms' }}
                onClick={() => {
                  void import('@/router').then(({ router }) => router.navigate({ to: '/settings/provider' }))
                }}
              >
                {t('Setup Provider')}
              </Button>
            )}
          </div>
          {providers.length > 0 && <BlankStateStarters onSelect={fillComposer} />}

          <div className="session-dock blank-home-dock">
            <div className="session-dock-pad flex flex-col gap-3">
              {showCopilotsInNewSession ? (
                <NewChatAgentBar agents={allAgents} selectedIds={selectedAgentIds} onChange={handleAgentIdsChange} />
              ) : null}

              <InputBox
                key={`new-composer-${composerKey}`}
                sessionType="chat"
                sessionId="new"
                model={selectedModel}
                agentMode={session.agentMode ?? false}
                workspaceRoot={session.workspaceRoot}
                initialMessage={composerDraft}
                draftAgentIds={selectedAgentIds}
                onDraftAgentIdsChange={handleAgentIdsChange}
                draftRoomMode={
                  session.roomMode === 'work' || session.roomMode === 'swarm' ? session.roomMode : 'discuss'
                }
                onDraftRoomModeChange={(mode) => setSession((old) => ({ ...old, roomMode: mode }))}
                onSelectModel={onSelectModel}
                onToggleAgentMode={(agentMode) => setSession((old) => ({ ...old, agentMode }))}
                onWorkspaceRootChange={(workspaceRoot) => setSession((old) => ({ ...old, workspaceRoot }))}
                browserArmed={session.browserArmed ?? false}
                onBrowserArmedChange={(browserArmed) => setSession((old) => ({ ...old, browserArmed }))}
                computerArmed={session.computerArmed ?? false}
                onComputerArmedChange={(computerArmed) => setSession((old) => ({ ...old, computerArmed }))}
                onClickSessionSettings={onClickSessionSettings}
                onSubmit={handleSubmit}
              />
            </div>
          </div>
        </div>

        <div className="blank-home-grow blank-home-grow-bottom" aria-hidden />
      </div>
    </Page>
  )
}
