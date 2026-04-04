import NiceModal, { useModal } from '@ebay/nice-modal-react'
import { Alert, Badge, Button, Checkbox, Flex, Progress, Stack, Text } from '@mantine/core'
import { IconAlertTriangle } from '@tabler/icons-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AdaptiveModal } from '@/components/common/AdaptiveModal'
import { ScalableIcon } from '@/components/common/ScalableIcon'
import { useSettingsStore } from '@/stores/settingsStore'

export type ContextOverflowAction = 'compact' | 'truncate' | 'continue'

export interface ContextOverflowModalProps {
  currentTokens: number
  thresholdTokens: number
  contextWindow: number
}

const ContextOverflowModal = NiceModal.create(
  ({ currentTokens, thresholdTokens, contextWindow }: ContextOverflowModalProps) => {
    const modal = useModal()
    const { t } = useTranslation()
    const { setSettings } = useSettingsStore((state) => state)
    const [rememberChoice, setRememberChoice] = useState(false)

    const usagePercent = Math.min(Math.round((currentTokens / contextWindow) * 100), 100)
    const thresholdPercent = Math.min(Math.round((thresholdTokens / contextWindow) * 100), 100)

    const formatTokens = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n))

    const handleAction = (action: ContextOverflowAction) => {
      if (rememberChoice && action !== 'continue') {
        setSettings({ contextOverflowBehavior: action === 'compact' ? 'auto-compact' : 'truncate' })
      }
      modal.resolve(action)
      modal.hide()
    }

    const handleClose = () => {
      // Dismiss without choosing → treat as "continue" so the send is not blocked
      modal.resolve('continue' as ContextOverflowAction)
      modal.hide()
    }

    return (
      <AdaptiveModal
        opened={modal.visible}
        onClose={handleClose}
        centered
        size="md"
        title={t('Context Window Nearly Full')}
      >
        <Stack gap="md">
          <Alert icon={<ScalableIcon size={18} icon={IconAlertTriangle} />} color="orange" variant="light">
            <Text size="sm">
              {t(
                "The conversation context is approaching the model's token limit. Choose how to handle this to continue chatting."
              )}
            </Text>
          </Alert>

          {/* Token usage visualisation */}
          <Stack gap="xs">
            <Flex justify="space-between" align="center">
              <Text size="xs" c="chatbox-secondary">
                {t('Token Usage')}
              </Text>
              <Flex gap="xs" align="center">
                <Badge size="sm" color={usagePercent >= 90 ? 'red' : 'orange'} variant="light">
                  {formatTokens(currentTokens)} / {formatTokens(contextWindow)}
                </Badge>
                <Text size="xs" c="chatbox-secondary">
                  ({usagePercent}%)
                </Text>
              </Flex>
            </Flex>
            <Progress value={usagePercent} color={usagePercent >= 90 ? 'red' : 'orange'} size="sm" radius="xl" />
            <Text size="xs" c="chatbox-tertiary">
              {t('Compaction threshold: {{threshold}}', {
                threshold: `${formatTokens(thresholdTokens)} (${thresholdPercent}%)`,
              })}
            </Text>
          </Stack>

          {/* Remember choice */}
          <Checkbox
            label={t('Remember my choice and apply automatically next time')}
            checked={rememberChoice}
            onChange={(e) => setRememberChoice(e.currentTarget.checked)}
            size="sm"
          />
        </Stack>

        <AdaptiveModal.Actions>
          <AdaptiveModal.CloseButton onClick={handleClose} />
          <Button color="chatbox-gray" variant="light" onClick={() => handleAction('continue')}>
            {t('Continue Anyway')}
          </Button>
          <Button color="chatbox-gray" variant="outline" onClick={() => handleAction('truncate')}>
            {t('Truncate Context')}
          </Button>
          <Button onClick={() => handleAction('compact')}>{t('Compact')}</Button>
        </AdaptiveModal.Actions>
      </AdaptiveModal>
    )
  }
)

export default ContextOverflowModal
