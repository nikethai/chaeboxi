import NiceModal, { useModal } from '@ebay/nice-modal-react'
import type { WritingModel } from '@shared/types/writing'
import { useTranslation } from 'react-i18next'
import { AdaptiveModal } from '@/components/common/AdaptiveModal'
import WritingAssistant from '@/components/writing/WritingAssistant'
import { navigateToSettings } from './Settings'

export default NiceModal.create((props: { initialDraft?: string; initialModel?: WritingModel }) => {
  const modal = useModal()
  const { t } = useTranslation()
  const close = () => {
    modal.resolve()
    // Removing immediately aborts the request and releases drafts and modal props.
    modal.remove()
  }

  return (
    <AdaptiveModal opened={modal.visible} onClose={close} title={t('Improve writing')} size="lg">
      <WritingAssistant
        {...props}
        onConfigureProvider={() => {
          close()
          navigateToSettings('/provider')
        }}
      />
    </AdaptiveModal>
  )
})
