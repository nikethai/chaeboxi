import { ActionIcon, Badge, Flex, ScrollArea, Text, Tooltip, UnstyledButton } from '@mantine/core'
import { IconRefresh, IconMessage } from '@tabler/icons-react'
import { useAtom, useAtomValue } from 'jotai'
import { useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { ScalableIcon } from '@/components/common/ScalableIcon'
import ProviderIcon from '@/components/icons/ProviderIcon'
import {
  openclawActiveSessionIdAtom,
  openclawGatewayStatusAtom,
  openclawSessionsAtom,
  useGatewaySync,
} from '@/openclaw/atoms'

interface SessionPanelProps {
  className?: string
}

export default function SessionPanel({ className }: SessionPanelProps) {
  const { t } = useTranslation()
  const [sessions] = useAtom(openclawSessionsAtom)
  const [activeSessionId, setActiveSessionId] = useAtom(openclawActiveSessionIdAtom)
  const gatewayStatus = useAtomValue(openclawGatewayStatusAtom)

  // useGatewaySync auto-connects on mount; gatewayKey changes trigger
  // internal atom resets, so the stale-while-revalidate pattern works.
  const { ensureConnected } = useGatewaySync()

  useEffect(() => {
    void ensureConnected()
  }, [ensureConnected])

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
            onClick={() => void ensureConnected()}
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
              <ScalableIcon icon={IconMessage} size={24} className="text-chatbox-tertiary" />
              <Text size="xs" c="chatbox-tertiary">
                {t('No sessions found')}
              </Text>
              <Text size="xs" c="chatbox-tertiary">
                {t('Make sure OpenClaw is running')}
              </Text>
            </>
          ) : (
            <>
              <ScalableIcon icon={IconMessage} size={24} className="text-chatbox-tertiary" />
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
                {session.agentId && (
                  <Text size="xs" c="chatbox-tertiary" truncate="end">
                    {session.agentId}
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
