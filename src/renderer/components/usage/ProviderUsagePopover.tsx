import { Button, Popover, Stack, Text } from '@mantine/core'
import type { ProviderUsageStatus } from '@shared/providers/usage'
import { Link } from '@tanstack/react-router'
import type { FC, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { LocalUsageBreakdown } from './LocalUsageBreakdown'
import { QuotaMeter } from './QuotaMeter'

export const ProviderUsagePopover: FC<{
  status: ProviderUsageStatus | null
  children: ReactNode
  targetClassName?: string
}> = ({ status, children, targetClassName }) => {
  const { t } = useTranslation()

  if (!status) {
    return <>{children}</>
  }

  return (
    <Popover width={320} position="top" withArrow shadow="md" withinPortal>
      <Popover.Target>
        <button type="button" className={targetClassName ?? 'session-statusline-plan'}>
          {children}
        </button>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap="sm">
          <div>
            <Text size="sm" fw={600}>
              {status.providerName}
              {status.plan ? ` · ${status.plan.label}` : ''}
            </Text>
            {status.plan?.accountHint && (
              <Text size="xs" c="dimmed">
                {status.plan.accountHint}
              </Text>
            )}
          </div>
          <div>
            <Text size="xs" fw={600} c="dimmed" tt="uppercase" mb={4}>
              {t('In this app')}
            </Text>
            <LocalUsageBreakdown local={status.local} showModels={false} />
          </div>
          <div>
            <Text size="xs" fw={600} c="dimmed" tt="uppercase" mb={4}>
              {t('Provider plan')}
            </Text>
            <QuotaMeter quota={status.quota} />
          </div>
          <Button component={Link} to="/settings/usage" size="xs" variant="light" fullWidth>
            {t('Open Usage')}
          </Button>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  )
}
