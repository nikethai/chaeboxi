import { IconChevronDown } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import { useId, useState } from 'react'

export interface SettingsCollapsibleProps {
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  /** Start expanded (default false for advanced groups). */
  defaultOpen?: boolean
  /** Force open when true (e.g. section has values). */
  forceOpen?: boolean
  className?: string
  /** Optional badge on the right of the trigger (e.g. "Advanced"). */
  badge?: ReactNode
  /** Visual weight for the badge: quiet (default) or active (configured / on). */
  badgeTone?: 'quiet' | 'active'
}

/**
 * Progressive disclosure for long settings pages — keeps essentials above the fold.
 */
export function SettingsCollapsible({
  title,
  description,
  children,
  defaultOpen = false,
  forceOpen,
  className,
  badge,
  badgeTone = 'quiet',
}: SettingsCollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen || Boolean(forceOpen))
  const panelId = useId()
  const expanded = forceOpen ? true : open

  return (
    <section className={`settings-collapsible${expanded ? ' is-open' : ''}${className ? ` ${className}` : ''}`}>
      <button
        type="button"
        className="settings-collapsible-head"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => {
          if (!forceOpen) setOpen((v) => !v)
        }}
      >
        <span className="settings-collapsible-head-copy min-w-0">
          <span className="settings-collapsible-title">{title}</span>
          {description ? <span className="settings-collapsible-desc text-pretty">{description}</span> : null}
        </span>
        <span className="settings-collapsible-meta">
          {badge ? (
            <span
              className={`settings-collapsible-badge${badgeTone === 'active' ? ' settings-collapsible-badge-active' : ''}`}
            >
              {badge}
            </span>
          ) : null}
          <span className="settings-collapsible-chevron" aria-hidden data-open={expanded ? 'true' : undefined}>
            <IconChevronDown size={16} stroke={1.75} />
          </span>
        </span>
      </button>
      {expanded ? (
        <div id={panelId} className="settings-collapsible-body">
          {children}
        </div>
      ) : null}
    </section>
  )
}
