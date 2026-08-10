import { type FC, memo } from 'react'
import { useTranslation } from 'react-i18next'

export type EmptyThreadStateProps = {
  sessionName?: string
  onPickStarter: (fill: string) => void
  /** Compact layout for quick chat / narrow panels */
  compact?: boolean
}

/**
 * Quiet empty-thread stage — greeting only (Gemini DNA).
 * Composer stays in the session dock; no chips / tags / subcopy.
 */
const EmptyThreadState: FC<EmptyThreadStateProps> = ({ sessionName, compact = false }) => {
  const { t } = useTranslation()

  const hasName = Boolean(sessionName && sessionName !== 'Untitled')
  // Compact (Quick Chat): short invite. Full session: session name or default greeting.
  const title = compact
    ? t('Ask anything')
    : hasName
      ? sessionName!
      : t('What can I help with?')

  return (
    <div
      className={compact ? 'empty-thread empty-thread--compact' : 'empty-thread'}
      role="region"
      aria-label={t('Empty conversation')}
    >
      <div className="empty-thread-stage">
        <h2 className="empty-thread-title blank-enter">{title}</h2>
      </div>
    </div>
  )
}

export default memo(EmptyThreadState)
