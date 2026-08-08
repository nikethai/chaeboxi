/**
 * Post-discuss sticky actions: Team answer / Keep discussing / Switch to Work.
 */

import { Button, Flex, Text } from '@mantine/core'
import { memo, useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { keepDiscussing, requestTeamAnswer, setSessionRoomMode } from '@/stores/session/multi-agent-room'
import {
  getTeamRoomActions,
  subscribeTeamRoomState,
  type TeamRoomActionsState,
} from '@/stores/session/team-room-state'

export interface TeamRoomActionsProps {
  sessionId: string
  className?: string
}

function TeamRoomActions({ sessionId, className }: TeamRoomActionsProps) {
  const { t } = useTranslation()
  const [pending, setPending] = useState<TeamRoomActionsState>(() => getTeamRoomActions())
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    return subscribeTeamRoomState(() => {
      setPending(getTeamRoomActions())
    })
  }, [])

  const visible = pending?.sessionId === sessionId && pending.mode === 'discuss'

  const onTeamAnswer = useCallback(async () => {
    if (busy) return
    setBusy(true)
    try {
      await requestTeamAnswer(sessionId)
    } finally {
      setBusy(false)
    }
  }, [busy, sessionId])

  const onKeepDiscussing = useCallback(async () => {
    if (busy || !pending?.canKeepDiscussing) return
    setBusy(true)
    try {
      await keepDiscussing(sessionId)
    } finally {
      setBusy(false)
    }
  }, [busy, pending?.canKeepDiscussing, sessionId])

  const onSwitchToWork = useCallback(async () => {
    if (busy) return
    setBusy(true)
    try {
      await setSessionRoomMode(sessionId, 'work')
      const { clearTeamRoomState } = await import('@/stores/session/team-room-state')
      clearTeamRoomState(sessionId)
      setPending(null)
    } finally {
      setBusy(false)
    }
  }, [busy, sessionId])

  if (!visible || !pending) return null

  return (
    <Flex
      className={className}
      align="center"
      gap={8}
      wrap="wrap"
      px={8}
      py={6}
      style={{
        borderTop: '1px solid var(--chatbox-border-primary, #2a2a32)',
        background: 'var(--chatbox-background-secondary, #16161a)',
      }}
    >
      <Text size="xs" c="chatbox-tertiary" className="shrink-0">
        {t('Team discussion ready')} · {t('Round')} {pending.discussRoundsCompleted}
      </Text>
      <Button size="compact-xs" variant="filled" color="chatbox-brand" loading={busy} onClick={onTeamAnswer}>
        {t('Team answer')}
      </Button>
      {pending.canKeepDiscussing ? (
        <Button size="compact-xs" variant="light" color="gray" loading={busy} onClick={onKeepDiscussing}>
          {t('Keep discussing')}
        </Button>
      ) : null}
      <Button size="compact-xs" variant="subtle" color="gray" loading={busy} onClick={onSwitchToWork}>
        {t('Switch to Work')}
      </Button>
    </Flex>
  )
}

export default memo(TeamRoomActions)
