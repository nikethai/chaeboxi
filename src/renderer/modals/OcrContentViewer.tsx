import NiceModal, { muiDialogV5, useModal } from '@ebay/nice-modal-react'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { copyToClipboard } from '@/packages/navigator'
import * as toastActions from '@/stores/toastActions'

interface OcrContentViewerProps {
  content: string
}

const OcrContentViewer = NiceModal.create(({ content }: OcrContentViewerProps) => {
  const modal = useModal()
  const { t } = useTranslation()

  const onClose = () => {
    modal.resolve()
    modal.hide()
  }

  const onCopy = () => {
    copyToClipboard(content)
    toastActions.add(t('copied to clipboard'), 2000)
  }

  return (
    <Dialog {...muiDialogV5(modal)} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{t('OCR Text Content')}</DialogTitle>
      <DialogContent>
        <Box
          sx={{
            backgroundColor: 'background.paper',
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            p: 2,
            maxHeight: '60vh',
            overflowY: 'auto',
          }}
        >
          <Typography
            variant="body1"
            component="pre"
            sx={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontFamily: 'monospace',
            }}
          >
            {content}
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCopy} startIcon={<ContentCopyIcon />}>
          {t('copy')}
        </Button>
        <Button onClick={onClose}>{t('close')}</Button>
      </DialogActions>
    </Dialog>
  )
})

export default OcrContentViewer
