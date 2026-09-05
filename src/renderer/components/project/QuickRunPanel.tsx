import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import platform from '@/platform'

export function QuickRunPanel() {
  const { t } = useTranslation()
  const [detail, setDetail] = useState<string>(t('Quick Local Run is unavailable.'))

  useEffect(() => {
    if (!platform.getLocalExecutionStatus) {
      setDetail(t('Quick Local Run is desktop-only and is not a terminal, Node, or npm environment.'))
      return
    }
    void platform.getLocalExecutionStatus().then((raw) => {
      const status = raw as { detail?: string; state?: string }
      setDetail(status.detail || t('Quick Local Run is unavailable.'))
    })
  }, [t])

  return (
    <section aria-label={t('Quick Local Run')} className="quick-run-panel">
      <p>{detail}</p>
      <p>{t('Chaeboxi does not fall back to host commands, Docker, or cloud sandboxes.')}</p>
    </section>
  )
}
