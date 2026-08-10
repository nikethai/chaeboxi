import type { Message } from '@shared/types'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AssistantStatusRow, PendingDots } from './AssistantPending'

export default function MessageStatuses(props: { statuses: Message['status'] }) {
  const { statuses } = props
  if (!statuses || statuses.length === 0) {
    return null
  }
  return (
    <>
      {statuses.map((status, index) => (
        <MessageStatus key={index} status={status} />
      ))}
    </>
  )
}

function MessageStatus(props: { status: NonNullable<Message['status']>[number] }) {
  const { status } = props
  const { t } = useTranslation()
  if (status.type === 'sending_file') {
    return (
      <AssistantStatusRow className="mb-1.5">
        <span className="assistant-status-row-title">{t('Reading file…')}</span>
        {status.mode ? (
          <span className="assistant-status-row-meta">
            {status.mode === 'local' ? t('Local') : t('Advanced')}
          </span>
        ) : null}
      </AssistantStatusRow>
    )
  }
  if (status.type === 'loading_webpage') {
    return (
      <AssistantStatusRow className="mb-1.5">
        <span className="assistant-status-row-title">{t('Loading webpage…')}</span>
        {status.mode ? (
          <span className="assistant-status-row-meta">
            {status.mode === 'local' ? t('Local') : t('Advanced')}
          </span>
        ) : null}
      </AssistantStatusRow>
    )
  }
  if (status.type === 'retrying') {
    return <RetryingIndicator attempt={status.attempt} maxAttempts={status.maxAttempts} />
  }
  return null
}

function RetryingIndicator(props: { attempt: number; maxAttempts: number }) {
  const { attempt, maxAttempts } = props
  const { t } = useTranslation()
  return (
    <AssistantStatusRow className="mb-1.5">
      <span className="assistant-status-row-title">
        {t('Retrying {{attempt}}/{{maxAttempts}}', { attempt, maxAttempts })}
      </span>
    </AssistantStatusRow>
  )
}

/** @deprecated Prefer AssistantStatusRow — kept for any external imports. */
export function LoadingBubble(props: { children: ReactNode }) {
  return (
    <AssistantStatusRow>
      <span className="assistant-status-row-title">{props.children}</span>
    </AssistantStatusRow>
  )
}

// silence unused if tree-shaken — PendingDots re-export for convenience
export { PendingDots }
