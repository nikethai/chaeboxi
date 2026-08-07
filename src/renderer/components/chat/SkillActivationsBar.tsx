import type { SkillActivation } from '@shared/types'
import { IconSparkles } from '@tabler/icons-react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

export interface SkillActivationsBarProps {
  activations: SkillActivation[]
  className?: string
}

const MODE_LABEL: Record<SkillActivation['mode'], string> = {
  explicit: 'tagged',
  session: 'pinned',
  auto: 'auto',
}

/**
 * Compact, polished meta row showing which skills ran for a turn.
 * Designed to sit under assistant content (not inside the prose block).
 */
function SkillActivationsBar({ activations, className }: SkillActivationsBarProps) {
  const { t } = useTranslation()
  if (!activations.length) return null

  return (
    <div className={cn('skill-activations', className)} role="status" aria-label={t('Skills used')}>
      <span className="skill-activations-label">
        <IconSparkles size={12} stroke={1.75} className="skill-activations-icon" aria-hidden />
        <span>{t('Skills')}</span>
      </span>
      <ul className="skill-activations-list">
        {activations.map((act, index) => (
          <li
            key={`${act.skillId}-${act.mode}`}
            className={cn('skill-chip', `skill-chip--${act.mode}`)}
            style={{ animationDelay: `${index * 70}ms` }}
          >
            <span className="skill-chip-sigil" aria-hidden>
              $
            </span>
            <span className="skill-chip-name">{act.name}</span>
            {act.mode !== 'explicit' && (
              <span className="skill-chip-mode">{t(MODE_LABEL[act.mode])}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default memo(SkillActivationsBar)
