import type { ReactNode } from 'react'

export interface SettingsPageProps {
  children: ReactNode
  className?: string
  /**
   * Wide layout for split panes / dense catalogs (skills lists, provider detail).
   * Default is measured form column (~40rem).
   */
  wide?: boolean
}

/** Content shell: studio measure + vertical rhythm for settings routes. */
export function SettingsPage({ children, className, wide }: SettingsPageProps) {
  return (
    <div className={`settings-page-body${wide ? ' settings-page-body-wide' : ''}${className ? ` ${className}` : ''}`}>
      {children}
    </div>
  )
}
