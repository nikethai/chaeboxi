import { useTranslation } from 'react-i18next'

type BlankStateStartersProps = {
  onSelect: (prompt: string) => void
}

const starters = [
  {
    label: 'Help me plan something',
    prompt: 'Help me plan ',
  },
  {
    label: 'Explain a topic simply',
    prompt: 'Explain ',
  },
  {
    label: 'Write a first draft',
    prompt: 'Help me write ',
  },
]

export default function BlankStateStarters({ onSelect }: BlankStateStartersProps) {
  const { t } = useTranslation()

  return (
    <div className="blank-starters" aria-label={t('Starter prompts')}>
      <div className="blank-starters-head">{t('Try one of these')}</div>
      {starters.map(({ label, prompt }, index) => (
        <button key={label} className="blank-starter" type="button" onClick={() => onSelect(prompt)}>
          <span className="blank-starter-n" aria-hidden="true">
            {String(index + 1).padStart(2, '0')}
          </span>
          <span className="blank-starter-t">{t(label)}</span>
        </button>
      ))}
    </div>
  )
}
