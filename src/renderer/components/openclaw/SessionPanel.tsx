import { ActionIcon, Badge, Flex, ScrollArea, Text, Tooltip, UnstyledButton } from '@mantine/core'
import { IconRefresh, IconSession } from '@tabler/icons-react'
import { useAtom, useAtomValue } from 'jotai'
import { useCallback, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useSettingsStore } from '@/stores/settingsStore'
import { ScalableIcon } from '../common/ScalableIcon'
import ProviderIcon from '../icons/ProviderIcon'
import {
  openclawActiveSessionIdAtom,
  openclawGatewayStatusAtom,
  openclawSessionsAtom,
  type OpenClawSession,
} from '@/stores/atoms/openclawAtoms'
import type { GatewayClientCreateOptions } from '@shared/models/openclaw'
import { getOrCreateGatewayClient } from '@shared/models/openclaw'

interface SessionPanelProps {
  className?: string
}

async function fetchSessionsFromGateway(opts: GatewayClientCreateOptions): Promise<OpenClawSession[]> {
  const client = getOrCreateGatewayClient(opts)
  await client.connect()
  const response = await client.listSessions()
  return response.sessions.map((session) => ({
    id: session.id,
    name: session.name,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    modelId: session.modelId,
    agentId: session.agentId,
    messageCount: session.messageCount,
  }))
}

export default function SessionPanel({ className }: SessionPanelProps) {
  const { t } = useTranslation()
  const [sessions, setSessions] = useAtom(openclawSessionsAtom)
  const [activeSessionId, setActiveSessionId] = useAtom(openclawActiveSessionIdAtom)
  const gatewayStatus = useAtomValue(openclawGatewayStatusAtom)

  const openclawSettings = useSettingsStore((state) => state.openclaw)
  const providerSettings = useSettingsStore((state) => state.providers?.['openclaw'])

  const activeGateway = useMemo(() => {
    if (!openclawSettings?.gateways) return null
    return openclawSettings.gateways.find((g) => g.isDefault) || openclawSettings.gateways[0]
  }, [openclawSettings])

  const apiHost = activeGateway?.url || providerSettings?.apiHost || 'http://127.0.0.1:18789'
  const apiKey = activeGateway?.token || providerSettings?.apiKey || ''
  const cloudflareClientId = activeGateway?.cloudflareClientId || providerSettings?.cloudflareClientId || ''
  const cloudflareClientSecret = activeGateway?.cloudflareClientSecret || providerSettings?.cloudflareClientSecret || ''

  const fetchSessions = useCallback(async () => {
    if (!apiHost) return
    try {
      const fetched = await fetchSessionsFromGateway({ apiHost, apiKey, cloudflareClientId, cloudflareClientSecret })
      setSessions(fetched)
    } catch (error) {
      console.error('[OpenClaw] Failed to fetch sessions:', error)
    }
  }, [apiHost, apiKey, cloudflareClientId, cloudflareClientSecret, setSessions])

  useEffect(() => {
    if (gatewayStatus === 'connected' && sessions.length === 0) {
      void fetchSessions()
    }
  }, [gatewayStatus, sessions.length, fetchSessions])

  const handleSelectSession = useCallback(
    (sessionId: string) => {
      setActiveSessionId(sessionId)
    },
    [setActiveSessionId]
  )

  return (
    <div className={cn('flex flex-col', className)}>
      <Flex align="center" gap="xs" className="px-xs py-xxs">
        <ProviderIcon size={18} provider="openclaw" />
        <Text size="sm" fw={500} c="chatbox-tint-secondary">
          {t('Gateway Sessions')}
        </Text>
        <Tooltip label={t('Refresh sessions')}>
          <ActionIcon
            variant="subtle"
            size="sm"
            onClick={() => void fetchSessions()}
            disabled={gatewayStatus !== 'connected'}
          >
            <ScalableIcon icon={IconRefresh} size={14} />
          </ActionIcon>
        </Tooltip>
      </Flex>

      {sessions.length === 0 ? (
        <Flex direction="column" align="center" py="md" gap="xs">
          {gatewayStatus === 'connected' ? (
            <>
              <ScalableIcon icon={IconSession} size={24} className="text-chatbox-tertiary" />
              <Text size="xs" c="chatbox-tertiary">
                {t('No sessions found')}
              </Text>
              <Text size="xs" c="chatbox-tertiary">
                {t('Make sure OpenClaw is running')}
              </Text>
            </>
          ) : (
            <>
              <ScalableIcon icon={IconSession} size={24} className="text-chatbox-tertiary" />
              <Text size="xs" c="chatbox-tertiary">
                {gatewayStatus === 'disconnected' ? t('Gateway disconnected') : t('Gateway connecting...')}
              </Text>
            </>
          )}
        </Flex>
      ) : (
        <ScrollArea className="max-h-[200px]">
          {sessions.map((session) => (
            <UnstyledButton
              key={session.id}
              onClick={() => handleSelectSession(session.id)}
              className={cn(
                'flex items-center gap-2 px-sm py-xs w-full hover:bg-[var(--chatbox-background-tertiary)] transition-colors',
                activeSessionId === session.id ? 'bg-[var(--chatbox-background-tertiary)]' : ''
              )}
            >
              <Badge
                size="xs"
                variant="light"
                color={activeSessionId === session.id ? 'chatbox-brand' : 'chatbox-tertiary'}
              >
                {session.messageCount ?? 0}
              </Badge>
              <Flex direction="column" gap={2} style={{ flex: 1, minWidth: 0 }}>
                <Text size="sm" fw={500} truncate="end">
                  {session.name || t('Unnamed Session')}
                </Text>
                {session.modelId && (
                  <Text size="xs" c="chatbox-tertiary" truncate="end">
                    {session.modelId}
                  </Text>
                )}
              </Flex>
            </UnstyledButton>
          ))}
        </ScrollArea>
      )}
    </div>
  )
}
