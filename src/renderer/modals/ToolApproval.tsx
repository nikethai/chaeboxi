import NiceModal, { useModal } from '@ebay/nice-modal-react'
import { Badge, Box, Button, Code, Group, Stack, Text } from '@mantine/core'
import type { ToolRiskTier } from '@shared/types/mcp'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { AdaptiveModal } from '@/components/common/AdaptiveModal'
import type { ToolApprovalScope } from '@/stores/toolApprovalStore'

export type ToolApprovalModalResult = ToolApprovalScope | 'deny'

type ToolApprovalModalProps = {
  toolName: string
  description?: string
  riskTier: ToolRiskTier
  parameters: unknown
}

function stringifyParameters(parameters: unknown) {
  try {
    return JSON.stringify(parameters, null, 2)
  } catch {
    return String(parameters)
  }
}

const ToolApprovalModal = NiceModal.create((props: ToolApprovalModalProps) => {
  const modal = useModal()
  const { t } = useTranslation()

  const color = useMemo(() => {
    switch (props.riskTier) {
      case 'low':
        return 'green'
      case 'medium':
        return 'yellow'
      case 'high':
        return 'red'
      default:
        return 'gray'
    }
  }, [props.riskTier])

  const riskLabel = useMemo(() => {
    switch (props.riskTier) {
      case 'low':
        return t('Low risk')
      case 'medium':
        return t('Medium risk')
      case 'high':
        return t('High risk')
      default:
        return props.riskTier
    }
  }, [props.riskTier, t])

  const onClose = (result: ToolApprovalModalResult = 'deny') => {
    modal.resolve(result)
    modal.hide()
  }

  return (
    <AdaptiveModal opened={modal.visible} onClose={() => onClose()} centered title={t('Tool approval required')}>
      <Stack gap="md">
        <Stack gap="xs">
          <Group justify="space-between" align="flex-start">
            <Stack gap={2}>
              <Text fw={600}>{props.toolName}</Text>
              {props.description && (
                <Text size="sm" c="chatbox-secondary">
                  {props.description}
                </Text>
              )}
            </Stack>
            <Badge color={color} variant="light">
              {riskLabel}
            </Badge>
          </Group>
        </Stack>

        <Stack gap="xs">
          <Text size="sm" fw={500}>
            {t('Parameters')}
          </Text>
          <Box
            component="pre"
            p="sm"
            m={0}
            className="max-h-72 overflow-auto rounded-md bg-chatbox-background-primary border border-solid border-chatbox-border-primary"
          >
            <Code block className="whitespace-pre-wrap break-words !bg-transparent !text-inherit !p-0">
              {stringifyParameters(props.parameters)}
            </Code>
          </Box>
        </Stack>
      </Stack>

      <AdaptiveModal.Actions>
        <Button variant="default" onClick={() => onClose('deny')}>
          {t('Deny')}
        </Button>
        {props.riskTier !== 'high' && (
          <Button variant="light" onClick={() => onClose('session')}>
            {t('Allow for this session')}
          </Button>
        )}
        <Button onClick={() => onClose('once')}>{t('Allow once')}</Button>
      </AdaptiveModal.Actions>
    </AdaptiveModal>
  )
})

export default ToolApprovalModal
