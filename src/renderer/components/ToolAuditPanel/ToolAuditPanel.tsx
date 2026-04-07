import { Badge, Group, Paper, Stack, Table, Text, UnstyledButton } from '@mantine/core'
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react'
import { Fragment, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ToolRiskTier } from '@shared/types/mcp'
import { useToolApprovalStore, type ToolApprovalAuditEntry } from '@/stores/toolApprovalStore'

interface ToolAuditPanelProps {
  sessionId: string
}

function riskBadgeColor(tier: ToolRiskTier): string {
  switch (tier) {
    case 'low':
      return 'green'
    case 'medium':
      return 'yellow'
    case 'high':
      return 'orange'
    case 'critical':
      return 'red'
    default:
      return 'gray'
  }
}

function decisionBadgeColor(decision: ToolApprovalAuditEntry['decision']): string {
  switch (decision) {
    case 'allow':
      return 'green'
    case 'auto-approve':
      return 'blue'
    case 'deny':
      return 'red'
    default:
      return 'gray'
  }
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function ExpandRow({ entry }: { entry: ToolApprovalAuditEntry }) {
  const [opened, setOpened] = useState(false)
  const { t } = useTranslation()

  return (
    <>
      <Table.Tr>
        <Table.Td colSpan={4} className="p-0">
          <UnstyledButton
            className="w-full text-left hover:bg-[var(--mantine-color-gray-1)] transition-colors"
            onClick={() => setOpened((o) => !o)}
          >
            <Group gap="xs" px="md" py="xs">
              {opened ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
              <Text size="xs" c="dimmed">
                {t('View details')}
              </Text>
            </Group>
          </UnstyledButton>
        </Table.Td>
      </Table.Tr>
      {opened && (
        <Table.Tr>
          <Table.Td colSpan={4} className="bg-[var(--mantine-color-gray-0)]">
            <Stack gap="xs" px="lg" py="sm">
              {entry.args !== undefined && (
                <>
                  <Text size="xs" fw={600}>
                    {t('Arguments')}
                  </Text>
                  <Paper withBorder radius="sm" p="sm" className="bg-white">
                    <Text size="xs" component="pre" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {JSON.stringify(entry.args, null, 2)}
                    </Text>
                  </Paper>
                </>
              )}
            </Stack>
          </Table.Td>
        </Table.Tr>
      )}
    </>
  )
}

export function ToolAuditPanel({ sessionId }: ToolAuditPanelProps) {
  const { t } = useTranslation()
  const auditLog = useToolApprovalStore((state) => state.auditLog)
  const sessionEntries = auditLog.filter((entry) => entry.sessionId === sessionId)

  if (sessionEntries.length === 0) {
    return null
  }

  return (
    <Paper shadow="xs" radius="md" p="sm" withBorder className="mx-3 mb-2">
      <Stack gap="xs">
        <Group justify="space-between" align="center">
          <Text size="sm" fw={600}>
            {t('Tool Audit Log')}
          </Text>
          <Badge variant="light" color="gray" size="sm">
            {sessionEntries.length}
          </Badge>
        </Group>

        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th className="text-xs">{t('Time')}</Table.Th>
              <Table.Th className="text-xs">{t('Tool')}</Table.Th>
              <Table.Th className="text-xs">{t('Risk')}</Table.Th>
              <Table.Th className="text-xs">{t('Decision')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {sessionEntries.map((entry, idx) => (
              <Fragment key={`entry-${idx}`}>
                <Table.Tr>
                  <Table.Td className="text-xs whitespace-nowrap">{formatTimestamp(entry.timestamp)}</Table.Td>
                  <Table.Td className="text-xs">{entry.toolName}</Table.Td>
                  <Table.Td>
                    <Badge size="xs" variant="light" color={riskBadgeColor(entry.riskTier)}>
                      {entry.riskTier}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Badge size="xs" variant="light" color={decisionBadgeColor(entry.decision)}>
                      {entry.decision}
                    </Badge>
                  </Table.Td>
                </Table.Tr>
                <ExpandRow entry={entry} />
              </Fragment>
            ))}
          </Table.Tbody>
        </Table>
      </Stack>
    </Paper>
  )
}

export default ToolAuditPanel
