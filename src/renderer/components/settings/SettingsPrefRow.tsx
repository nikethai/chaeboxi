import type { ReactNode } from 'react'

export interface SettingsPrefRowProps {
  title: ReactNode
  description?: ReactNode
  /** Right-side control (switch, select, button group). */
  control: ReactNode
  className?: string
  /** Stack control under title on narrow widths (default true via CSS). */
  align?: 'center' | 'start'
}

/**
 * Preference row: title + optional helper left, control right.
 * Use inside SettingsCard with divided children for studio settings density.
 */
export function SettingsPrefRow({ title, description, control, className, align = 'center' }: SettingsPrefRowProps) {
  return (
    <div
      className={`settings-pref-row${align === 'start' ? ' settings-pref-row-start' : ''}${className ? ` ${className}` : ''}`}
    >
      <div className="settings-pref-row-copy min-w-0">
        <div className="settings-pref-row-title">{title}</div>
        {description ? <div className="settings-pref-row-desc text-pretty">{description}</div> : null}
      </div>
      <div className="settings-pref-row-control">{control}</div>
    </div>
  )
}
