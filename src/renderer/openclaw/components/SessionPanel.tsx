import { ActionIcon, Flex, ScrollArea, Text, Tooltip, UnstyledButton } from '@mantine/core'
import { IconMessage, IconPlugConnected, IconRefresh } from '@tabler/icons-react'
import { useAtom, useAtomValue } from 'jotai'
import { useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ScalableIcon } from '@/components/common/ScalableIcon'
import { cn } from '@/lib/utils'
import {
  openclawActiveSessionIdAtom,
  openclawGatewayStatusAtom,
  openclawSessionsAtom,
  useGatewaySync,
} from '@/openclaw/atoms'

interface SessionPanelProps {
  className?: string
}

function gatewayLabel(
  status: string,
  t: (k: string) => string
): { text: string; tone: 'ok' | 'warn' | 'muted' } {
  if (status === 'connected') return { text: t('Connected'), tone: 'ok' }
  if (status === 'disconnected') return { text: t('Disconnected'), tone: 'warn' }
  return { text: t('Connecting…'), tone: 'muted' }
}

export default function SessionPanel({ className }: SessionPanelProps) {
  const { t } = useTranslation()
  const [sessions] = useAtom(openclawSessionsAtom)
  const [activeSessionId, setActiveSessionId] = useAtom(openclawActiveSessionIdAtom)
  const gatewayStatus = useAtomValue(openclawGatewayStatusAtom)

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

  const status = gatewayLabel(gatewayStatus, t)

  return (
    <div className={cn('agent-panel', className)}>
      <Flex align="center" justify="space-between" gap="xs" className="agent-panel-head">
        <Flex align="center" gap={8} miw={0}>
          <span className={cn('agent-status-dot', `is-${status.tone}`)} aria-hidden />
          <Text className="agent-panel-title" lineClamp={1}>
            {t('Gateway Sessions')}
          </Text>
          <Text className="agent-panel-meta" lineClamp={1}>
            {status.text}
          </Text>
        </Flex>
        <Tooltip label={t('Refresh sessions')} withArrow openDelay={400}>
          <ActionIcon
            variant="subtle"
            size={28}
            color="chatbox-tertiary"
            radius="md"
            onClick={() => void ensureConnected()}
            className="agent-panel-icon-btn"
          >
            <ScalableIcon icon={IconRefresh} size={14} />
          </ActionIcon>
        </Tooltip>
      </Flex>

      {sessions.length === 0 ? (
        <Flex direction="column" align="center" justify="center" className="agent-panel-empty" gap={6}>
          <ScalableIcon
            icon={gatewayStatus === 'connected' ? IconMessage : IconPlugConnected}
            size={20}
            className="text-[var(--chatbox-tint-tertiary)] opacity-70"
          />
          <Text size="xs" c="chatbox-tertiary" ta="center" className="max-w-[220px] leading-snug">
            {gatewayStatus === 'connected'
              ? t('No gateway sessions yet. Start a run in OpenClaw.')
              : gatewayStatus === 'disconnected'
                ? t('Gateway disconnected. Check OpenClaw is running.')
                : t('Connecting to gateway…')}
          </Text>
        </Flex>
      ) : (
        <ScrollArea className="agent-panel-list" type="auto">
          {sessions.map((session) => {
            const on = activeSessionId === session.id
            return (
              <UnstyledButton
                key={session.id}
                onClick={() => handleSelectSession(session.id)}
                className={cn('agent-session-row', on && 'is-on')}
              >
                <span className="agent-session-count">{session.messageCount ?? 0}</span>
                <Flex direction="column" gap={1} miw={0} style={{ flex: 1 }}>
                  <Text size="sm" fw={on ? 600 : 500} truncate="end" className="tracking-tight">
                    {session.name || t('Unnamed Session')}
                  </Text>
                  {session.agentId && (
                    <Text size="xs" c="chatbox-tertiary" truncate="end" className="font-mono opacity-80">
                      {session.agentId}
                    </Text>
                  )}
                </Flex>
              </UnstyledButton>
            )
          })}
        </ScrollArea>
      )}
    </div>
  )
}
