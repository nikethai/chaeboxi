import { type FC, memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { buildChatStarters } from '@/utils/chat-starters'

export type EmptyThreadStateProps = {
  sessionName?: string
  onPickStarter: (fill: string) => void
  /** Compact layout for quick chat / narrow panels */
  compact?: boolean
}

/**
 * Docked empty-thread content: short headline + shared starters.
 * Composer stays in the session dock (no layout flip on first send).
 */
const EmptyThreadState: FC<EmptyThreadStateProps> = ({ sessionName, onPickStarter, compact = false }) => {
  const { t } = useTranslation()
  const starters = useMemo(() => buildChatStarters(t), [t])

  const title = sessionName && sessionName !== 'Untitled' ? sessionName : t('New thread')
  const sub = t('Type below, or pick a starter to fill the composer.')

  return (
    <div
      className={compact ? 'empty-thread empty-thread--compact' : 'empty-thread'}
      role="region"
      aria-label={t('Empty conversation')}
    >
      <div className="empty-thread-copy">
        <h2 className="empty-thread-title">{title}</h2>
        <p className="empty-thread-sub">{sub}</p>
      </div>

      {!compact && (
        <div className="blank-starters empty-thread-starters" role="list">
          <header className="blank-starters-head">
            <span>{t('Starters')}</span>
            <span>{t('press to fill')}</span>
          </header>
          {starters.map((s, i) => (
            <button
              key={s.n}
              type="button"
              className="blank-starter"
              role="listitem"
              style={{ animationDelay: `${i * 80}ms` }}
              onClick={() => onPickStarter(s.fill)}
            >
              <span className="blank-starter-n">{s.n}</span>
              <span>
                <span className="blank-starter-t">{s.title}</span>
                <span className="blank-starter-h">{s.hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {compact && (
        <div className="empty-thread-chips" role="list">
          {starters.slice(0, 3).map((s) => (
            <button
              key={s.n}
              type="button"
              className="empty-thread-chip"
              role="listitem"
              onClick={() => onPickStarter(s.fill)}
            >
              {s.title}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default memo(EmptyThreadState)
