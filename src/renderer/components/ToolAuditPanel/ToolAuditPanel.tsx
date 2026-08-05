import { Badge, Flex, Group, Paper, Stack, Table, Text, UnstyledButton } from '@mantine/core'
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
            className="w-full text-left hover:bg-[var(--chatbox-background-tertiary)] transition-colors"
            onClick={() => setOpened((o) => !o)}
          >
            <Group gap="xs" px="sm" py={6}>
              {opened ? <IconChevronDown size={13} /> : <IconChevronRight size={13} />}
              <Text size="xs" c="chatbox-tertiary">
                {t('View details')}
              </Text>
            </Group>
          </UnstyledButton>
        </Table.Td>
      </Table.Tr>
      {opened && (
        <Table.Tr>
          <Table.Td colSpan={4} className="bg-[var(--chatbox-background-primary)]">
            <Stack gap="xs" px="md" py="sm">
              {entry.args !== undefined && (
                <>
                  <Text size="xs" fw={600} c="chatbox-secondary">
                    {t('Arguments')}
                  </Text>
                  <Paper
                    withBorder
                    radius="sm"
                    p="sm"
                    className="bg-[var(--chatbox-background-primary)] border-[var(--chatbox-border-primary)]"
                  >
                    <Text
                      size="xs"
                      component="pre"
                      c="chatbox-secondary"
                      className="font-mono"
                      style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}
                    >
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
    return (
      <div className="agent-panel">
        <Flex align="center" justify="space-between" className="agent-panel-head">
          <Text className="agent-panel-title">{t('Tool Audit')}</Text>
        </Flex>
        <Flex direction="column" align="center" className="agent-panel-empty" gap={6}>
          <Text size="xs" c="chatbox-tertiary" ta="center">
            {t('No tool approvals in this session yet.')}
          </Text>
        </Flex>
      </div>
    )
  }

  return (
    <div className="agent-panel">
      <Flex align="center" justify="space-between" gap="xs" className="agent-panel-head">
        <Text className="agent-panel-title">{t('Tool Audit')}</Text>
        <span className="agent-session-count">{sessionEntries.length}</span>
      </Flex>

      <div className="agent-panel-table-wrap">
        <Table horizontalSpacing="sm" verticalSpacing={6} className="agent-audit-table">
          <Table.Thead>
            <Table.Tr>
              <Table.Th className="agent-audit-th">{t('Time')}</Table.Th>
              <Table.Th className="agent-audit-th">{t('Tool')}</Table.Th>
              <Table.Th className="agent-audit-th">{t('Risk')}</Table.Th>
              <Table.Th className="agent-audit-th">{t('Decision')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {sessionEntries.map((entry, idx) => (
              <Fragment key={`entry-${idx}`}>
                <Table.Tr>
                  <Table.Td className="agent-audit-td whitespace-nowrap font-mono">
                    {formatTimestamp(entry.timestamp)}
                  </Table.Td>
                  <Table.Td className="agent-audit-td">{entry.toolName}</Table.Td>
                  <Table.Td>
                    <Badge size="xs" variant="light" color={riskBadgeColor(entry.riskTier)} radius="sm">
                      {entry.riskTier}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Badge size="xs" variant="light" color={decisionBadgeColor(entry.decision)} radius="sm">
                      {entry.decision}
                    </Badge>
                  </Table.Td>
                </Table.Tr>
                <ExpandRow entry={entry} />
              </Fragment>
            ))}
          </Table.Tbody>
        </Table>
      </div>
    </div>
  )
}

export default ToolAuditPanel
