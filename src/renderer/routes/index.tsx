import NiceModal from '@ebay/nice-modal-react'
import { Button } from '@mantine/core'
import type { Session } from '@shared/types'
import { ModelProviderEnum } from '@shared/types'
import { toSessionAgentFieldsFromSelection } from '@shared/new-chat-agents'
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
import { useIsSmallScreen } from '@/hooks/useScreenChange'
import { createSession as createSessionStore } from '@/stores/chatStore'
import { submitNewUserMessage, switchCurrentSession } from '@/stores/sessionActions'
import { initEmptyChatSession } from '@/stores/sessionHelpers'
import { useUIStore } from '@/stores/uiStore'

export const Route = createFileRoute('/')({
  component: Index,
  validateSearch: zodValidator(
    z.object({
      copilotId: z.string().optional(),
    })
  ),
})

function Index() {
  const { t } = useTranslation()
  const isSmallScreen = useIsSmallScreen()

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

  const fillComposer = useCallback((text: string) => {
    setComposerDraft(text)
    setComposerKey((k) => k + 1)
    localStorage.setItem('new-chat', text)
    requestAnimationFrame(() => {
      document.getElementById('message-input')?.focus()
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
    for (const a of myCopilots) map.set(a.id, a)
    for (const a of remoteCopilots || []) {
      if (!map.has(a.id)) map.set(a.id, a)
    }
    return Array.from(map.values())
  }, [myCopilots, remoteCopilots])

  const selectedAgentIds = useMemo(
    () => session.agentIds ?? (session.copilotId ? [session.copilotId] : []),
    [session.agentIds, session.copilotId]
  )

  const selectedAgents = useMemo(
    () => selectedAgentIds.map((id) => allAgents.find((a) => a.id === id)).filter(Boolean) as typeof allAgents,
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
  }, [selectedAgentIds.join(','), primaryAgent?.id, primaryAgent?.prompt, primaryAgent?.name, primaryAgent?.picUrl, primaryAgent?.emojiAvatar])

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

      switchCurrentSession(newSession.id)

      void submitNewUserMessage(newSession.id, {
        newUserMsg: userMsg,
        needGenerating,
        onUserMessageReady,
      })
    },
    [
      session,
      addSessionKnowledgeBase,
      newSessionState.knowledgeBase,
      setNewSessionState,
      sessionWebBrowsingMap,
      setSessionWebBrowsing,
      clearSessionWebBrowsing,
    ]
  )

  const onSelectModel = useCallback((p: string, m: string) => {
    setSession((old) => ({
      ...old,
      messages:
        p === ModelProviderEnum.OpenClaw ? old.messages.filter((message) => message.role !== 'system') : old.messages,
      settings: {
        ...(old.settings || {}),
        provider: p,
        modelId: m,
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

  const starters = useMemo(
    () => [
      {
        n: '01',
        title: t('Trace session store modules'),
        hint: t('Architecture · TypeScript'),
        fill: 'Map the session store modules and call out circular deps.',
      },
      {
        n: '02',
        title: t('PR: kill MUI drawer'),
        hint: t('Write-up · shipping note'),
        fill: 'Draft a PR description for replacing the MUI drawer with a custom rail.',
      },
      {
        n: '03',
        title: t('Stream cancel race'),
        hint: t('Debug · concurrency'),
        fill: 'Debug intermittent stream cancel when switching models mid-response.',
      },
      {
        n: '04',
        title: t('Composer context meter'),
        hint: t('UX · tokens'),
        fill: 'Propose token budget UI for the composer context meter.',
      },
    ],
    [t]
  )

  return (
    <Page title="">
      <div className="p-0 flex flex-col h-full session-shell">
        <div className="blank-workbench flex-1 min-h-0 overflow-auto">
          <div className="blank-copy">
            <h1 className="blank-title">{t('Pick a thread. Or start one.')}</h1>
            <p className="blank-sub">
              {t(
                'Desktop copilot for people who live in providers, tools, and long context — not another soft chat toy.'
              )}
            </p>
            {!providers.length && (
              <Button
                mt="md"
                size="sm"
                variant="light"
                color="chatbox-brand"
                onClick={() => {
                  void import('@/router').then(({ router }) => router.navigate({ to: '/settings/provider' }))
                }}
              >
                {t('Setup Provider')}
              </Button>
            )}
          </div>

          {!isSmallScreen && (
            <div className="blank-starters" role="list">
              <header className="blank-starters-head">
                <span>{t('Starters')}</span>
                <span>{t('press to fill')}</span>
              </header>
              {starters.map((s) => (
                <button
                  key={s.n}
                  type="button"
                  className="blank-starter"
                  role="listitem"
                  onClick={() => fillComposer(s.fill)}
                >
                  <span className="blank-starter-n">{s.n}</span>
                  <span>
                    <span className="blank-starter-t">{s.title}</span>
                    <span className="blank-starter-h">{s.hint}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="session-dock">
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
              draftRoomMode={session.roomMode === 'work' ? 'work' : 'discuss'}
              onDraftRoomModeChange={(mode) => setSession((old) => ({ ...old, roomMode: mode }))}
              onSelectModel={onSelectModel}
              onToggleAgentMode={(agentMode) => setSession((old) => ({ ...old, agentMode }))}
              onWorkspaceRootChange={(workspaceRoot) => setSession((old) => ({ ...old, workspaceRoot }))}
              onClickSessionSettings={onClickSessionSettings}
              onSubmit={handleSubmit}
            />
          </div>
        </div>
      </div>
    </Page>
  )
}
