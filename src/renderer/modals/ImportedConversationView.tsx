import NiceModal, { useModal } from '@ebay/nice-modal-react'
import { Button, Checkbox, Stack, Text } from '@mantine/core'
import type { ImportedConversation, ImportedMessage, ImportedSource } from '@shared/imported-history'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AdaptiveModal } from '@/components/common/AdaptiveModal'
import {
  buildHandoffPreview,
  continueImportedConversation,
  deleteImportedSourceAndReconcile,
} from '@/packages/imported-history'
import * as chatStore from '@/stores/chatStore'
import { lastUsedModelStore } from '@/stores/lastUsedModelStore'
import { switchCurrentSession } from '@/stores/sessionActions'

type Props = {
  source: ImportedSource
  conversation: ImportedConversation
}

const ImportedConversationView = NiceModal.create(({ source, conversation }: Props) => {
  const modal = useModal()
  const { t } = useTranslation()
  const [selectedIds, setSelectedIds] = useState<string[]>(() => conversation.messages.map((m) => m.id))
  const selectedMessages = useMemo(
    () => conversation.messages.filter((message) => selectedIds.includes(message.id)),
    [conversation.messages, selectedIds]
  )
  const target = lastUsedModelStore.getState().chat
  const preview = buildHandoffPreview({
    sourceId: source.id,
    conversation,
    selectedMessages,
    recentTurnCount: 2,
    targetProvider: target?.provider,
    targetModelId: target?.modelId,
  })

  const toggle = (message: ImportedMessage) => {
    setSelectedIds((current) =>
      current.includes(message.id) ? current.filter((id) => id !== message.id) : [...current, message.id]
    )
  }

  const onContinue = async () => {
    const session = await continueImportedConversation({
      sourceId: source.id,
      conversation,
      selectedMessages,
      recentTurnCount: 2,
      targetProvider: target?.provider,
      targetModelId: target?.modelId,
    })
    switchCurrentSession(session.id)
    modal.hide()
  }

  return (
    <AdaptiveModal opened={modal.visible} onClose={() => modal.hide()} centered title={conversation.title}>
      <Stack gap="sm" p="sm" className="max-h-[70vh] overflow-auto">
        <Text size="xs">
          {t('Imported from {{filename}} · ChatGPT export · read-only', { filename: source.originalFilename })}
        </Text>
        {conversation.messages.map((message) => (
          <Checkbox
            key={message.id}
            checked={selectedIds.includes(message.id)}
            label={`${message.role}: ${message.text.slice(0, 280)}`}
            onChange={() => toggle(message)}
          />
        ))}
        <Text size="sm">
          {t('Destination')}: {preview.provider || '—'} / {preview.modelId || '—'} · {preview.estimatedTokens}{' '}
          {t('tokens')}
        </Text>
        <Text size="sm">{preview.disclosure}</Text>
        {preview.omittedCount > 0 ? (
          <Text size="xs">
            {t('Omitted')}: {preview.omittedReasons.join(', ')}
          </Text>
        ) : null}
        <Button onClick={() => void onContinue()}>{t('Continue in Chaeboxi')}</Button>
        <Button
          color="red"
          variant="light"
          onClick={() => {
            void deleteImportedSourceAndReconcile(source.id, {
              listNativeSessions: async () => {
                const metas = await chatStore.listSessionsMeta()
                const sessions = await Promise.all(metas.map((meta) => chatStore.getSession(meta.id)))
                return sessions.filter((session): session is NonNullable<typeof session> => Boolean(session))
              },
              persistNativeSession: async (session) => {
                await chatStore.updateSessionWithMessages(session.id, () => session)
              },
            }).then(() => modal.hide())
          }}
        >
          {t('Delete imported source')}
        </Button>
        <Button variant="default" onClick={() => modal.hide()}>
          {t('Close')}
        </Button>
      </Stack>
    </AdaptiveModal>
  )
})

export default ImportedConversationView
