import { Badge } from '@mantine/core'
import type { IntegrationAccountStatus } from '@shared/types/integrations'
import { useTranslation } from 'react-i18next'

export function IntegrationStatusBadge({ status }: { status: IntegrationAccountStatus }) {
  const { t } = useTranslation()
  switch (status) {
    case 'active':
      return (
        <Badge size="sm" variant="light" color="teal">
          {t('Active')}
        </Badge>
      )
    case 'needs_reauth':
    case 'expired':
      return (
        <Badge size="sm" variant="light" color="orange">
          {t('Needs reconnect')}
        </Badge>
      )
    case 'revoked':
      return (
        <Badge size="sm" variant="light" color="red">
          {t('Revoked')}
        </Badge>
      )
    case 'disabled':
      return (
        <Badge size="sm" variant="light" color="gray">
          {t('Disabled')}
        </Badge>
      )
    default:
      return (
        <Badge size="sm" variant="light">
          {status}
        </Badge>
      )
  }
}
