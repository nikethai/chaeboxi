import { Stack, Text, Title } from '@mantine/core'
import type { ReactNode } from 'react'

export interface SettingsPageHeaderProps {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
}

/** Quiet page title for settings content — studio hierarchy, not admin H1. */
export function SettingsPageHeader({ title, description, actions, className }: SettingsPageHeaderProps) {
  return (
    <div className={`settings-page-header${className ? ` ${className}` : ''}`}>
      <Stack gap={6} className="min-w-0 flex-1">
        <Title order={3} className="settings-page-title text-balance">
          {title}
        </Title>
        {description ? (
          <Text size="sm" c="chatbox-secondary" className="settings-page-desc text-pretty max-w-2xl">
            {description}
          </Text>
        ) : null}
      </Stack>
      {actions ? <div className="settings-page-header-actions">{actions}</div> : null}
    </div>
  )
}
