import { Badge, Button, Card, Group, Stack, Text, Textarea } from '@mantine/core'
import type { MessagePlanPart } from '@shared/types'
import { IconCheck, IconX } from '@tabler/icons-react'
import { type FC, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Markdown from '@/components/Markdown'

interface PlanApprovalProps {
  planPart: MessagePlanPart
  onApprove: () => Promise<void>
  onRequestChanges: (feedback: string) => Promise<void>
  onReject: () => Promise<void>
}

const PlanApproval: FC<PlanApprovalProps> = ({ planPart, onApprove, onRequestChanges, onReject }) => {
  const { t } = useTranslation()
  const [feedback, setFeedback] = useState('')
  const [showRevisionForm, setShowRevisionForm] = useState(false)
  const [pendingAction, setPendingAction] = useState<'approve' | 'request-changes' | 'reject' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const runAction = useCallback(async (action: NonNullable<typeof pendingAction>, operation: () => Promise<void>) => {
    setPendingAction(action)
    setError(null)
    try {
      await operation()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setPendingAction(null)
    }
  }, [])

  const handleApprove = useCallback(() => {
    void runAction('approve', onApprove)
  }, [onApprove, runAction])

  const handleRequestChanges = useCallback(() => {
    void runAction('request-changes', () => onRequestChanges(feedback))
  }, [feedback, onRequestChanges, runAction])

  const handleReject = useCallback(() => {
    void runAction('reject', onReject)
  }, [onReject, runAction])

  const isBusy = pendingAction !== null

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
          <>
            {showRevisionForm && (
              <Stack gap="xs">
                <Textarea
                  label={t('Request changes')}
                  placeholder={t('Describe what the revised plan should change')}
                  value={feedback}
                  onChange={(event) => setFeedback(event.currentTarget.value)}
                  autosize
                  minRows={3}
                  disabled={isBusy}
                />
                <Group justify="flex-end" gap="sm">
                  <Button variant="subtle" size="sm" onClick={() => setShowRevisionForm(false)} disabled={isBusy}>
                    {t('Cancel')}
                  </Button>
                  <Button
                    size="sm"
                    variant="light"
                    onClick={handleRequestChanges}
                    loading={pendingAction === 'request-changes'}
                    disabled={!feedback.trim() || isBusy}
                  >
                    {t('Request revised plan')}
                  </Button>
                </Group>
              </Stack>
            )}
            {!showRevisionForm && (
              <Group justify="flex-end" gap="sm">
                <Button
                  variant="default"
                  size="sm"
                  leftSection={<IconX size={16} />}
                  onClick={handleReject}
                  loading={pendingAction === 'reject'}
                  disabled={isBusy}
                >
                  {t('Reject')}
                </Button>
                <Button variant="light" size="sm" onClick={() => setShowRevisionForm(true)} disabled={isBusy}>
                  {t('Request changes')}
                </Button>
                <Button
                  size="sm"
                  leftSection={<IconCheck size={16} />}
                  onClick={handleApprove}
                  loading={pendingAction === 'approve'}
                  disabled={isBusy}
                >
                  {t('Approve & Execute')}
                </Button>
              </Group>
            )}
            {error && (
              <Text size="xs" c="red">
                {error}
              </Text>
            )}
          </>
        )}
      </Stack>
    </Card>
  )
}

export default PlanApproval
