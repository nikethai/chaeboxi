import { Button } from '@mantine/core'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import platform from '@/platform'

export function ProjectExportDialog({
  capabilityId,
  onClose,
}: {
  capabilityId: string
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [summary, setSummary] = useState<string | null>(null)

  const run = async (kind: 'selection' | 'snapshot') => {
    if (!platform.prepareWorkspaceExport || !platform.exportWorkspace) return
    setBusy(true)
    try {
      const manifest = (await platform.prepareWorkspaceExport(capabilityId, { kind, relativePaths: [] })) as {
        manifestId?: string
        included?: number
        excluded?: number
        totalBytes?: number
      }
      setSummary(
        t('Included {{included}} files ({{excluded}} excluded, {{bytes}} bytes). Confirm native Save As.', {
          included: manifest.included ?? 0,
          excluded: manifest.excluded ?? 0,
          bytes: manifest.totalBytes ?? 0,
        })
      )
      if (manifest.manifestId) {
        await platform.exportWorkspace(manifest.manifestId)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="project-export-dialog" role="dialog" aria-label={t('Export')}>
      <p>{t('Export uses native Save As. Protected and ignored files are excluded.')}</p>
      {summary ? <p>{summary}</p> : null}
      <Button size="xs" loading={busy} onClick={() => void run('snapshot')}>
        {t('Export safe snapshot')}
      </Button>
      <Button size="xs" variant="subtle" onClick={onClose}>
        {t('Close')}
      </Button>
    </div>
  )
}
