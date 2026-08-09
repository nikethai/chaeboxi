import { Text } from '@mantine/core'
import { IconInfoCircle } from '@tabler/icons-react'
import type { ReactNode } from 'react'

export type SettingsCalloutTone = 'info' | 'success' | 'warning' | 'neutral'

export interface SettingsCalloutProps {
  title?: ReactNode
  children: ReactNode
  tone?: SettingsCalloutTone
  icon?: ReactNode
  className?: string
}

/**
 * Quiet status/helper panel — replaces loud solid blue Alert slabs.
 * Brand mix stays low so it matches AI studio chrome.
 */
export function SettingsCallout({ title, children, tone = 'info', icon, className }: SettingsCalloutProps) {
  return (
    <div className={`settings-callout settings-callout-${tone}${className ? ` ${className}` : ''}`} role="note">
      <div className="settings-callout-icon" aria-hidden>
        {icon ?? <IconInfoCircle size={16} stroke={1.5} />}
      </div>
      <div className="settings-callout-body min-w-0">
        {title ? (
          <Text size="sm" fw={600} className="settings-callout-title mb-0.5">
            {title}
          </Text>
        ) : null}
        <div className="settings-callout-content text-sm leading-relaxed">{children}</div>
      </div>
    </div>
  )
}
