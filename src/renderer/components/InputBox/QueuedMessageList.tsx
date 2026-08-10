import { ActionIcon, Text, Tooltip } from '@mantine/core'
import { IconX } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { getMessageText } from '@shared/utils/message'
import { type QueuedMessageEntry, messageQueueStore, useQueuedMessages } from '@/stores/session/messageQueue'

interface QueuedMessageListProps {
  sessionId: string
}

function QueuedMessageItem({ entry, index, sessionId }: { entry: QueuedMessageEntry; index: number; sessionId: string }) {
  const { t } = useTranslation()
  const text = getMessageText(entry.message, false, false)
  const preview = text.length > 80 ? text.slice(0, 80) + '…' : text
  const hasFiles = (entry.message.files?.length ?? 0) > 0

  const handleRemove = () => {
    const state = messageQueueStore.getState()
    const entries = state.messageQueue.get(sessionId) || []
    const nextEntries = entries.filter((_, i) => i !== index)
    const nextQueue = new Map(state.messageQueue)
    if (nextEntries.length > 0) {
      nextQueue.set(sessionId, nextEntries)
    } else {
      nextQueue.delete(sessionId)
    }
    messageQueueStore.setState({ messageQueue: nextQueue })
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--chatbox-background-secondary)] animate-in fade-in slide-in-from-bottom-1 duration-200">
      <div className="shrink-0 w-5 h-5 rounded-full bg-[var(--chatbox-tint-brand)] flex items-center justify-center">
        <Text size="xs" fw={700} c="white" lh={1}>
          {index + 1}
        </Text>
      </div>
      <Text size="xs" c="chatbox-secondary" className="flex-1 truncate" title={text}>
        {preview}
        {hasFiles && (
          <Text span size="xs" c="chatbox-tertiary">
            {' '}
            📎 {entry.message.files!.length}
          </Text>
        )}
      </Text>
      <Tooltip label={t('Remove from queue')} position="top" withArrow>
        <ActionIcon size={16} variant="subtle" color="chatbox-tertiary" onClick={handleRemove}>
          <IconX size={12} />
        </ActionIcon>
      </Tooltip>
    </div>
  )
}

export default function QueuedMessageList({ sessionId }: QueuedMessageListProps) {
  const { t } = useTranslation()
  const queuedMessages = useQueuedMessages(sessionId)

  if (queuedMessages.length === 0) {
    return null
  }

  const handleClearAll = () => {
    messageQueueStore.getState().clearSessionQueue(sessionId)
  }

  // User turns are already in the thread when userAlreadyInserted; show a compact
  // status so we do not duplicate the same bubble under the composer.
  const allInThread = queuedMessages.every((e) => e.userAlreadyInserted)
  if (allInThread) {
    return (
      <div className="flex items-center justify-between gap-2 px-3 pb-2">
        <Text size="xs" c="chatbox-tertiary" className="opacity-90">
          {t('Waiting for current reply ({{count}} queued)', { count: queuedMessages.length })}
        </Text>
        <Text
          size="xs"
          c="chatbox-error"
          className="cursor-pointer hover:underline shrink-0"
          onClick={handleClearAll}
        >
          {t('Clear queue')}
        </Text>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1 px-2 pb-2">
      <div className="flex items-center justify-between px-1">
        <Text size="xs" fw={600} c="chatbox-tertiary">
          {t('Queued messages ({{count}})', { count: queuedMessages.length })}
        </Text>
        {queuedMessages.length > 1 && (
          <Text
            size="xs"
            c="chatbox-error"
            className="cursor-pointer hover:underline"
            onClick={handleClearAll}
          >
            {t('Clear all')}
          </Text>
        )}
      </div>
      {queuedMessages.map((entry, index) => (
        <QueuedMessageItem
          key={`${entry.message.id}-${entry.queuedAt}`}
          entry={entry}
          index={index}
          sessionId={sessionId}
        />
      ))}
    </div>
  )
}
