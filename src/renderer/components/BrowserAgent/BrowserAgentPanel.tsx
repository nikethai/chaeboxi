import { ActionIcon, Badge, Collapse, Flex, Paper, Text, Tooltip } from '@mantine/core'
import { IconBrowser, IconChevronDown, IconChevronUp, IconPlayerStop } from '@tabler/icons-react'
import { type FC, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useBrowserAgentStatus } from '@/stores/browserAgentUiStore'
import { cancelSessionGeneration } from '@/stores/session/generation-cancel'
import { stopBrowserSession } from '@/packages/model-calls/toolsets/browser'

export type BrowserAgentPanelProps = {
  sessionId: string
  armed?: boolean
  generating?: boolean
}

/**
 * Collapsible live status for Chaeboxi isolated browser.
 * Shows URL, last tool, errors; Stop aborts generation + browser session.
 */
const BrowserAgentPanel: FC<BrowserAgentPanelProps> = ({ sessionId, armed, generating }) => {
  const { t } = useTranslation()
  const status = useBrowserAgentStatus(sessionId)
  const [open, setOpen] = useState(true)

  if (!armed && !status.running && !status.lastTool) {
    return null
  }

  const onStop = () => {
    cancelSessionGeneration(sessionId)
    void stopBrowserSession(sessionId)
  }

  return (
    <Paper
      withBorder
      radius="md"
      p="xs"
      mx="sm"
      mb="xs"
      className="browser-agent-panel"
      style={{ borderColor: 'var(--chatbox-border-primary)' }}
    >
      <Flex align="center" justify="space-between" gap="xs">
        <Flex align="center" gap={8} className="min-w-0">
          <IconBrowser size={16} stroke={1.5} className="text-[var(--chatbox-tint-brand)] shrink-0" />
          <Text size="sm" fw={600} className="truncate">
            {t('Chaeboxi Browser (isolated)')}
          </Text>
          {status.running && (
            <Badge size="xs" color="green" variant="light">
              {t('Running')}
            </Badge>
          )}
          {armed && !status.running && (
            <Badge size="xs" color="gray" variant="light">
              {t('Armed')}
            </Badge>
          )}
        </Flex>
        <Flex align="center" gap={4}>
          {(status.running || generating) && (
            <Tooltip label={t('Stop browser and generation')}>
              <ActionIcon color="red" variant="light" size="sm" onClick={onStop} aria-label={t('Stop')}>
                <IconPlayerStop size={14} />
              </ActionIcon>
            </Tooltip>
          )}
          <ActionIcon variant="subtle" size="sm" onClick={() => setOpen((v) => !v)} aria-label={t('Toggle')}>
            {open ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
          </ActionIcon>
        </Flex>
      </Flex>
      <Collapse in={open}>
        <Flex direction="column" gap={2} mt={6} px={2}>
          <Text size="xs" c="dimmed" className="truncate">
            URL: {status.url || '—'}
          </Text>
          <Text size="xs" c="dimmed" className="truncate">
            {t('Last action')}: {status.lastTool || '—'}
          </Text>
          {status.error && (
            <Text size="xs" c="red" className="line-clamp-2">
              {status.error}
            </Text>
          )}
          <Text size="xs" c="dimmed">
            {t('Not your personal Chrome — empty isolated profile.')}
          </Text>
        </Flex>
      </Collapse>
    </Paper>
  )
}

export default BrowserAgentPanel
