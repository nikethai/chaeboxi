import { Badge } from '@mantine/core'
import type { WorkspaceStatus } from '@shared/types/workspace'
import { useTranslation } from 'react-i18next'

export function ProjectBadge({ status }: { status: WorkspaceStatus | 'no-folder' }) {
  const { t } = useTranslation()
  const label =
    status === 'ready'
      ? t('Folder ready')
      : status === 'missing'
        ? t('Folder missing')
        : status === 'permission-denied'
          ? t('Permission denied')
          : status === 'relink-required'
            ? t('Relink folder')
            : status === 'legacy-reconnect-required'
              ? t('Reconnect folder')
              : t('No folder')
  const color =
    status === 'ready' ? 'teal' : status === 'chat-only' || status === 'no-folder' ? 'gray' : 'yellow'
  return (
    <Badge size="xs" variant="light" color={color}>
      {label}
    </Badge>
  )
}
