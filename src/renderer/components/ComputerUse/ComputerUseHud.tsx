import { ActionIcon, Flex, Paper, Text, Tooltip } from '@mantine/core'
import { IconDeviceDesktop, IconPlayerStop } from '@tabler/icons-react'
import { type FC } from 'react'
import { useTranslation } from 'react-i18next'
import { computerUseUiStore } from '@/stores/computerUseUiStore'
import { cancelSessionGeneration } from '@/stores/session/generation-cancel'
import platform from '@/platform'

export type ComputerUseHudProps = {
  sessionId: string
  armed?: boolean
}

/**
 * Always-visible-while-active HUD: agent is controlling / observing the computer.
 * Abort stops generation and disables further act until re-arm (backend abort flag).
 */
const ComputerUseHud: FC<ComputerUseHudProps> = ({ sessionId, armed }) => {
  const { t } = useTranslation()
  const active = computerUseUiStore((s) => Boolean(s.activeBySession[sessionId]))

  if (!armed && !active) return null

  const onAbort = () => {
    cancelSessionGeneration(sessionId)
    void platform.computerAbort?.()
    computerUseUiStore.getState().setActive(sessionId, false)
  }

  return (
    <Paper
      withBorder
      radius="md"
      p="xs"
      mx="sm"
      mb="xs"
      style={{
        borderColor: 'var(--mantine-color-orange-6)',
        background: 'color-mix(in srgb, var(--mantine-color-orange-6) 12%, transparent)',
      }}
    >
      <Flex align="center" justify="space-between" gap="xs">
        <Flex align="center" gap={8}>
          <IconDeviceDesktop size={16} stroke={1.5} className="text-orange-500" />
          <Text size="sm" fw={600}>
            {active ? t('Agent controlling computer') : t('Computer use armed')}
          </Text>
        </Flex>
        <Tooltip label={t('Abort computer control')}>
          <ActionIcon color="orange" variant="filled" size="sm" onClick={onAbort} aria-label={t('Abort')}>
            <IconPlayerStop size={14} />
          </ActionIcon>
        </Tooltip>
      </Flex>
      <Text size="xs" c="dimmed" mt={4}>
        {t('Approvals required for clicks and typing. Screen content is untrusted.')}
      </Text>
    </Paper>
  )
}

export default ComputerUseHud
