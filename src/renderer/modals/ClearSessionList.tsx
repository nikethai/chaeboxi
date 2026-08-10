import NiceModal, { useModal } from '@ebay/nice-modal-react'
import { Box, Button, Group, Slider, Stack, Text, UnstyledButton } from '@mantine/core'
import { IconTrash } from '@tabler/icons-react'
import clsx from 'clsx'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AdaptiveModal } from '@/components/common/AdaptiveModal'
import { trackingEvent } from '@/packages/event'
import { useSessionList } from '@/stores/chatStore'
import { clearConversationList } from '@/stores/sessionActions'
import * as toastActions from '@/stores/toastActions'

/**
 * Product clean-up: pick how many newest chats to keep.
 * Small lists use chips; large lists use a calm slider (never a red “keep” control).
 */
const ClearSessionList = NiceModal.create(() => {
  const modal = useModal()
  const { t } = useTranslation()
  const { sessionMetaList } = useSessionList()
  const total = sessionMetaList?.length ?? 0

  /** Prefer keeping most recent; leave room to delete when list is non-trivial. */
  const defaultKeep = useMemo(() => {
    if (total <= 1) return total
    if (total <= 6) return Math.max(1, total - 1)
    if (total <= 40) return Math.min(20, Math.ceil(total * 0.6))
    if (total <= 120) return 50
    return 100
  }, [total])

  const [keepCount, setKeepCount] = useState(defaultKeep)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setKeepCount(defaultKeep)
  }, [defaultKeep])

  useEffect(() => {
    trackingEvent('clear_conversation_list_window', { event_category: 'screen_view' })
  }, [])

  const keep = Math.min(total, Math.max(0, Math.floor(keepCount)))
  const remove = Math.max(0, total - keep)
  const canClean = total > 1 && remove > 0
  /** Chips feel better than a 0–2 slider for tiny libraries. */
  const useChips = total > 1 && total <= 8

  const chipOptions = useMemo(() => {
    if (!useChips) return [] as number[]
    // All, half-ish midpoints, and none — unique + sorted
    const set = new Set<number>([total, Math.max(1, Math.ceil(total / 2)), 1, 0])
    return Array.from(set)
      .filter((n) => n >= 0 && n <= total)
      .sort((a, b) => b - a)
  }, [total, useChips])

  const handleClose = () => {
    modal.resolve()
    modal.hide()
  }

  const clean = async () => {
    if (!canClean || submitting) return
    setSubmitting(true)
    try {
      await clearConversationList(keep)
      trackingEvent('clear_conversation_list', { event_category: 'user' })
      toastActions.add(
        keep === 0
          ? t('All conversations deleted')
          : t('Deleted {{count}} older conversations', { count: remove })
      )
      handleClose()
    } catch (err) {
      toastActions.add(err instanceof Error ? err.message : t('Failed to clean up conversations'))
    } finally {
      setSubmitting(false)
    }
  }

  if (total <= 1) {
    return (
      <AdaptiveModal
        opened={modal.visible}
        onClose={handleClose}
        centered
        size="sm"
        title={t('Clean up chats')}
        classNames={{ content: 'cleanup-modal' }}
      >
        <Stack gap="md">
          <Text size="sm" c="chatbox-secondary" className="text-pretty leading-relaxed">
            {total === 0
              ? t('You have no conversations yet.')
              : t('You only have one conversation — nothing to clean up.')}
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={handleClose}>
              {t('Done')}
            </Button>
          </Group>
        </Stack>
      </AdaptiveModal>
    )
  }

  return (
    <AdaptiveModal
      opened={modal.visible}
      onClose={handleClose}
      centered
      size="sm"
      title={t('Clean up chats')}
      classNames={{ content: 'cleanup-modal' }}
    >
      <Stack gap="md" className="cleanup-modal-body">
        <Text size="sm" c="chatbox-secondary" className="text-pretty leading-relaxed">
          {t('Keep your newest chats. Older ones will be permanently deleted.', {
            total,
          })}
        </Text>

        <Text size="xs" c="chatbox-tertiary" className="tabular-nums">
          {t('{{count}} conversations total', { count: total })}
        </Text>

        <Stack gap="xs">
          <Group justify="space-between" align="baseline">
            <Text size="sm" fw={600}>
              {t('Keep newest')}
            </Text>
            <Text size="sm" fw={650} className="tabular-nums text-[var(--chatbox-tint-primary)]">
              {keep === total
                ? t('All')
                : keep === 0
                  ? t('None')
                  : t('{{count}} of {{total}}', { count: keep, total })}
            </Text>
          </Group>

          {useChips ? (
            <div className="cleanup-keep-chips" role="listbox" aria-label={t('Keep newest')}>
              {chipOptions.map((n) => {
                const selected = keep === n
                const label =
                  n === total ? t('All') : n === 0 ? t('None') : t('{{count}} newest', { count: n })
                return (
                  <UnstyledButton
                    key={n}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={clsx('cleanup-keep-chip', selected && 'is-selected')}
                    onClick={() => setKeepCount(n)}
                  >
                    {label}
                  </UnstyledButton>
                )
              })}
            </div>
          ) : (
            <Slider
              value={keep}
              onChange={setKeepCount}
              min={0}
              max={total}
              step={1}
              label={null}
              marks={[
                { value: 0, label: t('None') },
                { value: total, label: t('All') },
              ]}
              color="chatbox-brand"
              size="sm"
              className="cleanup-keep-slider mb-1"
            />
          )}
        </Stack>

        <Box className={clsx('cleanup-summary', remove > 0 ? 'is-destructive' : 'is-idle')}>
          {remove > 0 ? (
            <Stack gap={6}>
              <Text size="sm" fw={600} className="leading-snug">
                {keep === 0
                  ? t('Delete all {{total}} conversations', { total })
                  : t('{{remove}} older chats will be deleted', { remove })}
              </Text>
              <Text size="xs" c="chatbox-secondary" className="leading-snug">
                {keep === 0
                  ? t('This cannot be undone.')
                  : t('Keeping {{keep}} newest. This cannot be undone.', { keep })}
              </Text>
            </Stack>
          ) : (
            <Text size="sm" c="chatbox-secondary" className="leading-snug">
              {t('Select fewer chats to keep if you want to free space.')}
            </Text>
          )}
        </Box>

        <Group justify="flex-end" gap="sm" mt={4}>
          <Button variant="default" onClick={handleClose} disabled={submitting}>
            {t('Cancel')}
          </Button>
          <Button
            color="red"
            leftSection={<IconTrash size={15} stroke={1.75} />}
            onClick={() => void clean()}
            loading={submitting}
            disabled={!canClean}
          >
            {keep === 0
              ? t('Delete all')
              : t('Delete {{count}}', { count: remove })}
          </Button>
        </Group>
      </Stack>
    </AdaptiveModal>
  )
})

export default ClearSessionList
