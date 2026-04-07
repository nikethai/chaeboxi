import { Badge, Button, Card, Group, Stack, Text } from '@mantine/core'
import type { MessagePlanPart } from '@shared/types'
import { IconCheck, IconX } from '@tabler/icons-react'
import { type FC, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import Markdown from '@/components/Markdown'

interface PlanApprovalProps {
  planPart: MessagePlanPart
  onApprove: () => void
  onReject: () => void
}

const PlanApproval: FC<PlanApprovalProps> = ({ planPart, onApprove, onReject }) => {
  const { t } = useTranslation()

  const handleApprove = useCallback(() => {
    onApprove()
  }, [onApprove])

  const handleReject = useCallback(() => {
    onReject()
  }, [onReject])

  const statusBadge = (() => {
    switch (planPart.status) {
      case 'pending':
        return (
          <Badge color="yellow" variant="light">
            {t('Awaiting Approval')}
          </Badge>
        )
      case 'approved':
        return (
          <Badge color="green" variant="light">
            {t('Approved')}
          </Badge>
        )
      case 'rejected':
        return (
          <Badge color="red" variant="light">
            {t('Rejected')}
          </Badge>
        )
      default:
        return null
    }
  })()

  return (
    <Card withBorder shadow="sm" radius="md" p="md" className="my-2 border-[var(--chatbox-border-primary)]">
      <Stack gap="sm">
        <Group justify="space-between" align="center">
          <Text fw={600} size="sm">
            {t('Proposed Plan')}
          </Text>
          {statusBadge}
        </Group>

        <Card.Section withBorder inheritPadding py="sm">
          <Markdown>{planPart.planText}</Markdown>
        </Card.Section>

        {planPart.status === 'pending' && (
          <Group justify="flex-end" gap="sm">
            <Button variant="default" size="sm" leftSection={<IconX size={16} />} onClick={handleReject}>
              {t('Reject')}
            </Button>
            <Button size="sm" leftSection={<IconCheck size={16} />} onClick={handleApprove}>
              {t('Approve & Execute')}
            </Button>
          </Group>
        )}
      </Stack>
    </Card>
  )
}

export default PlanApproval
