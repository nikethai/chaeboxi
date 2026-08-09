import type { ReactNode } from 'react'

export interface SettingsSectionProps {
  title?: ReactNode
  description?: ReactNode
  children: ReactNode
  className?: string
  /** Compact gap for dense form groups */
  dense?: boolean
}

/** Grouped settings block: micro label above body (usually a SettingsCard). */
export function SettingsSection({ title, description, children, className, dense }: SettingsSectionProps) {
  return (
    <section className={`settings-section${dense ? ' settings-section-dense' : ''}${className ? ` ${className}` : ''}`}>
      {(title || description) && (
        <div className="settings-section-head">
          {title ? <h3 className="settings-section-label">{title}</h3> : null}
          {description ? <p className="settings-section-desc text-pretty">{description}</p> : null}
        </div>
      )}
      <div className="settings-section-body">{children}</div>
    </section>
  )
}
