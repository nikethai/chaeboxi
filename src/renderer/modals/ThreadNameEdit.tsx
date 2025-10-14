import NiceModal, { muiDialogV5, useModal } from '@ebay/nice-modal-react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Session } from '@/../shared/types'
import { useIsSmallScreen } from '@/hooks/useScreenChange'
import { useSession } from '@/stores/chatStore'
import { editThread } from '@/stores/sessionActions'

const ThreadNameEdit = NiceModal.create((props: { sessionId: string; threadId: string }) => {
  const { sessionId, threadId } = props
  const { session: currentSession } = useSession(sessionId)
  const modal = useModal()
  const { t } = useTranslation()
  const isSmallScreen = useIsSmallScreen()
  const currentThreadName = useMemo(() => {
    if (currentSession?.id === threadId) {
      return currentSession.threadName || ''
    }
    const threads = currentSession?.threads ?? []
    return threads.find((thread: NonNullable<Session['threads']>[number]) => thread.id === threadId)?.name || ''
  }, [currentSession?.threadName, currentSession?.threads, currentSession?.id, threadId])

  const [threadName, setThreadName] = useState(currentThreadName)

  const onClose = useCallback(() => {
    modal.resolve()
    modal.hide()
  }, [modal])

  const onSave = useCallback(async () => {
    if (!currentSession) return
    await editThread(currentSession.id, threadId, { name: threadName })
    onClose()
  }, [onClose, threadId, threadName, currentSession?.id])

  const onContentInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    setThreadName(e.target.value)
  }, [])

  return (
    <Dialog {...muiDialogV5(modal)} onClose={onClose}>
      <DialogTitle>{t('Edit Thread Name')}</DialogTitle>
      <DialogContent>
        <TextField
          className="w-full"
          autoFocus={!isSmallScreen}
          placeholder="Thread Name"
          defaultValue={currentThreadName}
          onChange={onContentInput}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('cancel')}</Button>
        <Button onClick={onSave}>{t('save')}</Button>
      </DialogActions>
    </Dialog>
  )
})

export default ThreadNameEdit
