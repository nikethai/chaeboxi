import NiceModal from '@ebay/nice-modal-react'
import { ActionIcon, Avatar, Box, Button, Divider, Flex, ScrollArea, Space, Stack, Text } from '@mantine/core'
import type { CopilotDetail, Session } from '@shared/types'
import { ModelProviderEnum } from '@shared/types'
import { IconChevronLeft, IconChevronRight, IconX } from '@tabler/icons-react'
import { createFileRoute, useRouterState } from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import clsx from 'clsx'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'
import { ScalableIcon } from '@/components/common/ScalableIcon'
import InputBox, { type InputBoxPayload } from '@/components/InputBox/InputBox'
import Page from '@/components/layout/Page'
import { useMyCopilots, useRemoteCopilots } from '@/hooks/useCopilots'
import { useProviders } from '@/hooks/useProviders'
import { useIsSmallScreen } from '@/hooks/useScreenChange'
import { router } from '@/router'
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
    // also seed draft storage so remount restores if needed
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
  const selectedCopilotId = useMemo(() => session?.copilotId, [session?.copilotId])
  const selectedCopilot = useMemo(
    () => myCopilots.find((c) => c.id === selectedCopilotId) || remoteCopilots.find((c) => c.id === selectedCopilotId),
    [myCopilots, remoteCopilots, selectedCopilotId]
  )
  useEffect(() => {
    setSession((old) => ({
      ...old,
      picUrl: selectedCopilot?.emojiAvatar ? undefined : selectedCopilot?.picUrl,
      name: selectedCopilot?.name || 'Untitled',
      messages: selectedCopilot
        ? [
            {
              id: uuidv4(),
              role: 'system',
              contentParts: [
                {
                  type: 'text',
                  text: selectedCopilot.prompt,
                },
              ],
            },
          ]
        : initEmptyChatSession().messages,
    }))
  }, [selectedCopilot])

  const routerState = useRouterState()
  useEffect(() => {
    const { copilotId } = routerState.location.search
    if (copilotId) {
      setSession((old) => ({ ...old, copilotId }))
    }
  }, [routerState.location.search])

  const handleSubmit = useCallback(
    async ({ constructedMessage, needGenerating = true, onUserMessageReady }: InputBoxPayload) => {
      const newSession = await createSessionStore({
        name: session.name,
        type: 'chat',
        assistantAvatarKey: session.assistantAvatarKey,
        picUrl: session.picUrl,
        messages: session.messages,
        copilotId: session.copilotId,
        agentMode: session.agentMode,
        settings: session.settings,
      })

      // Transfer knowledge base from newSessionState to the actual session
      if (newSessionState.knowledgeBase) {
        addSessionKnowledgeBase(newSession.id, newSessionState.knowledgeBase)
        // Clear newSessionState after transfer
        setNewSessionState({})
      }

      // Transfer web browsing setting from "new" session to the actual session
      const newSessionWebBrowsing = sessionWebBrowsingMap.new
      if (newSessionWebBrowsing !== undefined) {
        setSessionWebBrowsing(newSession.id, newSessionWebBrowsing)
        clearSessionWebBrowsing('new')
      }

      switchCurrentSession(newSession.id)

      void submitNewUserMessage(newSession.id, {
        newUserMsg: constructedMessage,
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
        {/* Mock .blank — asymmetric workbench empty state */}
        <div className="blank-workbench flex-1 min-h-0 overflow-auto">
          <div className="blank-copy">
            <h1 className="blank-title">{t('Pick a thread. Or start one.')}</h1>
            <p className="blank-sub">
              {t(
                'Desktop copilot for people who live in providers, tools, and long context — not another soft chat toy.'
              )}
            </p>
            <div className="blank-tags">
              <span className="blank-tag">dark-first</span>
              <span className="blank-tag">indigo · solid</span>
              <span className="blank-tag">no MUI shell</span>
              <span className="blank-tag">local-first</span>
            </div>
            {!providers.length && (
              <Button
                mt="md"
                size="sm"
                variant="light"
                color="chatbox-brand"
                onClick={() => router.navigate({ to: '/settings/provider' })}
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
          <Stack gap="sm" className="session-dock-pad">
            {session.copilotId ? (
              <Box className="chat-col">
                <Stack gap="sm" className="w-full">
                  <Flex align="center" gap="sm">
                    <CopilotItem
                      name={session.name}
                      picUrl={session.picUrl}
                      emojiAvatar={selectedCopilot?.emojiAvatar}
                      selected
                    />
                    <ActionIcon
                      size={28}
                      radius="md"
                      c="chatbox-tertiary"
                      variant="subtle"
                      onClick={() => setSession((old) => ({ ...old, copilotId: undefined }))}
                    >
                      <ScalableIcon icon={IconX} size={18} />
                    </ActionIcon>
                  </Flex>

                  <Text c="chatbox-secondary" className="line-clamp-5">
                    {session.messages[0]?.contentParts
                      ?.map((part) => (part.type === 'text' ? part.text : ''))
                      .join('') || ''}
                  </Text>
                </Stack>
              </Box>
            ) : (
              showCopilotsInNewSession && (
                <CopilotPicker onSelect={(copilot) => setSession((old) => ({ ...old, copilotId: copilot?.id }))} />
              )
            )}

            <InputBox
              key={`new-composer-${composerKey}`}
              sessionType="chat"
              sessionId="new"
              model={selectedModel}
              agentMode={session.agentMode ?? false}
              initialMessage={composerDraft}
              onSelectModel={onSelectModel}
              onToggleAgentMode={(agentMode) => setSession((old) => ({ ...old, agentMode }))}
              onClickSessionSettings={onClickSessionSettings}
              onSubmit={handleSubmit}
            />
          </Stack>
        </div>
      </div>
    </Page>
  )
}

const MAX_COPILOTS_TO_SHOW = 10

const CopilotPicker = ({ selectedId, onSelect }: { selectedId?: string; onSelect?(copilot?: CopilotDetail): void }) => {
  const { t } = useTranslation()
  const isSmallScreen = useIsSmallScreen()
  const { copilots: myCopilots } = useMyCopilots()
  const { copilots: remoteCopilots } = useRemoteCopilots()

  const copilots = useMemo(
    () =>
      myCopilots.length >= MAX_COPILOTS_TO_SHOW
        ? myCopilots
        : [
            ...myCopilots,
            ...(myCopilots.length && remoteCopilots.length ? [undefined] : []),
            ...remoteCopilots
              .filter((c) => !myCopilots.map((mc) => mc.id).includes(c.id))
              .slice(0, MAX_COPILOTS_TO_SHOW - myCopilots.length - 1),
          ],
    [myCopilots, remoteCopilots]
  )

  const showMoreButton = useMemo(
    () => copilots.length < myCopilots.length + remoteCopilots.length,
    [copilots.length, myCopilots.length, remoteCopilots.length]
  )

  const viewportRef = useRef<HTMLDivElement>(null)
  const [scrollPosition, onScrollPositionChange] = useState({ x: 0, y: 0 })

  if (!copilots.length) {
    return null
  }

  return (
    <Box className="chat-col">
      <Stack gap="xs" className="w-full">
        <Flex align="center" justify="space-between">
          <Text
            size="xs"
            c="chatbox-tertiary"
            className="uppercase tracking-wider"
            style={{ fontFamily: 'var(--chatbox-font-mono)', fontSize: '0.7rem', letterSpacing: '0.08em' }}
          >
            {t('My Copilots')}
          </Text>

          {!isSmallScreen && (
            <Flex align="center" gap="sm">
              <ActionIcon
                variant="transparent"
                color="chatbox-tertiary"
                // onClick={() => setPage((p) => Math.max(p - 1, 0))}
                onClick={() => {
                  if (viewportRef.current) {
                    // const scrollWidth = viewportRef.current.scrollWidth
                    const clientWidth = viewportRef.current.clientWidth
                    const newScrollPosition = Math.max(scrollPosition.x - clientWidth, 0)
                    viewportRef.current.scrollTo({ left: newScrollPosition, behavior: 'smooth' })
                    onScrollPositionChange({ x: newScrollPosition, y: 0 })
                  }
                }}
              >
                <ScalableIcon icon={IconChevronLeft} />
              </ActionIcon>
              <ActionIcon
                variant="transparent"
                color="chatbox-tertiary"
                // onClick={() => setPage((p) => p + 1)}
                onClick={() => {
                  if (viewportRef.current) {
                    const scrollWidth = viewportRef.current.scrollWidth
                    const clientWidth = viewportRef.current.clientWidth
                    const newScrollPosition = Math.min(scrollPosition.x + clientWidth, scrollWidth - clientWidth)
                    viewportRef.current.scrollTo({ left: newScrollPosition, behavior: 'smooth' })
                    onScrollPositionChange({ x: newScrollPosition, y: 0 })
                  }
                }}
              >
                <ScalableIcon icon={IconChevronRight} />
              </ActionIcon>
            </Flex>
          )}
        </Flex>

        <ScrollArea
          type={isSmallScreen ? 'never' : 'scroll'}
          mx="-md"
          scrollbars="x"
          offsetScrollbars="x"
          viewportRef={viewportRef}
          onScrollPositionChange={onScrollPositionChange}
          className="copilot-picker-scroll-area"
        >
          {scrollPosition.x > 8 && !isSmallScreen && (
            <div className="absolute top-0 left-0 w-8 h-full bg-gradient-to-r from-chatbox-background-primary to-transparent"></div>
          )}
          {!isSmallScreen && (
            <div className="absolute top-0 right-0 w-8 h-full bg-gradient-to-l from-chatbox-background-primary to-transparent"></div>
          )}
          <Flex wrap="nowrap" gap="xs">
            <Space w="xs" />
            {copilots.map((copilot) =>
              copilot ? (
                <CopilotItem
                  key={copilot.id}
                  name={copilot.name}
                  picUrl={copilot.picUrl}
                  emojiAvatar={copilot.emojiAvatar}
                  selected={selectedId === copilot.id}
                  onClick={() => {
                    onSelect?.(copilot)
                  }}
                />
              ) : (
                <Divider key="divider" orientation="vertical" my="xs" mx="xxs" />
              )
            )}
            {showMoreButton && (
              <CopilotItem
                name={t('View All Copilots')}
                noAvatar={true}
                selected={false}
                onClick={() =>
                  router.navigate({
                    to: '/settings/copilots',
                  })
                }
              />
            )}
            <Space w="xs" />
          </Flex>
        </ScrollArea>
      </Stack>
    </Box>
  )
}

const CopilotItem = ({
  name,
  picUrl,
  emojiAvatar,
  selected,
  onClick,
  noAvatar = false,
}: {
  name: string
  picUrl?: string
  emojiAvatar?: string
  selected?: boolean
  onClick?(): void
  noAvatar?: boolean
}) => {
  const isSmallScreen = useIsSmallScreen()
  return (
    <Flex
      align="center"
      gap={isSmallScreen ? 'xxs' : 'xs'}
      py="xs"
      px={isSmallScreen ? 'xs' : 'md'}
      bd={selected ? 'none' : '1px solid var(--chatbox-border-primary)'}
      bg={selected ? 'var(--chatbox-background-brand-secondary)' : 'transparent'}
      className={clsx(
        'cursor-pointer shrink-0 shadow-[0px_2px_12px_0px_rgba(0,0,0,0.04)]',
        isSmallScreen ? 'rounded-full' : 'rounded-md'
      )}
      onClick={onClick}
    >
      {!noAvatar && (
        <Avatar src={emojiAvatar ? undefined : picUrl} color="chatbox-brand" size={isSmallScreen ? 20 : 24}>
          {emojiAvatar || name.slice(0, 1)}
        </Avatar>
      )}
      <Text fw="600" c={selected ? 'chatbox-brand' : 'chatbox-primary'}>
        {name}
      </Text>
    </Flex>
  )
}
