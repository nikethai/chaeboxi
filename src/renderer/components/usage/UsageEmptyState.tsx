import { Button, Stack, Text } from '@mantine/core'
import { Link } from '@tanstack/react-router'
import type { FC } from 'react'
import { useTranslation } from 'react-i18next'

export const UsageEmptyState: FC<{
  onBackfill?: () => void
  backfilling?: boolean
}> = ({ onBackfill, backfilling }) => {
  const { t } = useTranslation()
  return (
    <Stack align="center" gap="sm" py="xl" className="text-center">
      <Text fw={600}>{t('No usage data yet')}</Text>
      <Text size="sm" c="dimmed" maw={420}>
        {t(
          'Usage is recorded when assistant replies complete with token counts. Connect a provider and chat, or rebuild from existing sessions.'
        )}
      </Text>
      <div className="flex gap-2 flex-wrap justify-center">
        {onBackfill && (
          <Button variant="light" loading={backfilling} onClick={onBackfill}>
            {t('Scan past sessions')}
          </Button>
        )}
        <Button component={Link} to="/settings/provider" variant="outline">
          {t('Model providers')}
        </Button>
      </div>
    </Stack>
  )
}
