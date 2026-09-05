import { Button } from '@mantine/core'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import platform from '@/platform'

type Op = { id: string; kind: string; relativePath: string }

export function ProjectChangeReview({ changeSetId }: { changeSetId: string }) {
  const { t } = useTranslation()
  const [ops, setOps] = useState<Op[]>([])
  const [digest, setDigest] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  const refresh = async () => {
    if (!changeSetId) {
      setMessage(t('No staged project file changes for this chat.'))
      setOps([])
      setDigest('')
      return
    }
    if (!platform.getWorkspaceChangeSet) return
    const raw = (await platform.getWorkspaceChangeSet(changeSetId)) as {
      digest?: string
      operations?: Op[]
      sealed?: boolean
    }
    if (!raw.sealed && platform.sealWorkspaceChangeSet) {
      const sealed = (await platform.sealWorkspaceChangeSet(changeSetId)) as { digest?: string; operations?: Op[] }
      setDigest(sealed.digest || '')
      setOps(sealed.operations || [])
      return
    }
    setDigest(raw.digest || '')
    setOps(raw.operations || [])
  }

  const apply = async () => {
    if (!platform.prepareWorkspaceApply || !platform.applyWorkspaceChangeSet) return
    const prepared = await platform.prepareWorkspaceApply(
      changeSetId,
      digest,
      ops.map((op) => op.id)
    )
    if (!prepared?.applyTicket) {
      setMessage(t('Apply requires a native one-use ticket.'))
      return
    }
    const result = await platform.applyWorkspaceChangeSet(prepared.applyTicket)
    setMessage(result?.status || t('Applied'))
  }

  return (
    <section aria-label={t('Change Review')} className="project-change-review">
      <Button size="xs" onClick={() => void refresh()}>
        {t('Review changes')}
      </Button>
      <ul>
        {ops.map((op) => (
          <li key={op.id}>
            {op.kind} {op.relativePath}
          </li>
        ))}
      </ul>
      <Button size="xs" onClick={() => void apply()} disabled={!digest}>
        {t('Apply selected')}
      </Button>
      {message ? <p>{message}</p> : null}
    </section>
  )
}

export function ProjectChangeDiff({ label, summary }: { label: string; summary: string }) {
  return (
    <pre className="project-change-diff" aria-label={label}>
      {summary}
    </pre>
  )
}
