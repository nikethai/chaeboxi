import { Button, Flex, Text } from '@mantine/core'
import { IconAlertCircle, IconSettings } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { navigateToSettings } from '@/modals/Settings'
import type { ModelReadiness } from '@/utils/modelReadiness'
import { ScalableIcon } from '../common/ScalableIcon'

export function ModelReadinessNotice({ readiness }: { readiness: ModelReadiness }) {
  const { t } = useTranslation()

  if (readiness.status === 'ready') return null

  const content =
    readiness.status === 'capability-required'
      ? {
          message: t('This model cannot analyze attachments. Choose a vision model.'),
          action: t('Change model'),
          onClick: () => navigateToSettings(`/provider/${readiness.providerId}`),
        }
      : readiness.status === 'model-unavailable'
        ? {
            message: t('This model is no longer available. Choose another model.'),
            action: t('Change model'),
            onClick: () => navigateToSettings(`/provider/${readiness.providerId}`),
          }
        : readiness.status === 'provider-unavailable'
          ? {
              message: t('This provider is not configured. Check its settings.'),
              action: t('Open settings'),
              onClick: () => navigateToSettings(`/provider/${readiness.providerId}`),
            }
          : {
              message: t('Choose a model to start chatting.'),
              action: t('Open settings'),
              onClick: () => navigateToSettings('/provider'),
            }

  return (
    <Flex align="center" gap="xs" px="sm" pt="xs" pb={2} className="min-w-0">
      <ScalableIcon
        icon={IconAlertCircle}
        size={14}
        className="shrink-0 text-[var(--chatbox-tint-tertiary)]"
        aria-hidden
      />
      <Text size="xs" c="chatbox-tertiary" className="min-w-0 flex-1 leading-snug">
        {content.message}
      </Text>
      <Button
        size="compact-xs"
        variant="subtle"
        color="chatbox-secondary"
        leftSection={<ScalableIcon icon={IconSettings} size={12} />}
        onClick={content.onClick}
      >
        {content.action}
      </Button>
    </Flex>
  )
}
