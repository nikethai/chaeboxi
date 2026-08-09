import type { ReactNode } from 'react'

export interface SettingsCardProps {
  children: ReactNode
  className?: string
  /** Optional padding (default true). Set false for full-bleed lists. */
  padded?: boolean
  /** Hairline dividers between direct children (preference rows). */
  divided?: boolean
}

/** Soft elevated surface for settings groups (concentric with inner controls). */
export function SettingsCard({ children, className, padded = true, divided }: SettingsCardProps) {
  return (
    <div
      className={`settings-card${padded ? ' settings-card-padded' : ''}${divided ? ' settings-card-divided' : ''}${className ? ` ${className}` : ''}`}
    >
      {children}
    </div>
  )
}
