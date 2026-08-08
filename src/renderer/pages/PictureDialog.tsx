/**
 * Image lightbox (photos / raster only). Mermaid uses WorkspacePanel instead.
 * Studio chrome: scrim + toolbar island (no MUI Fab).
 */

import { ActionIcon, Text, Tooltip, UnstyledButton } from '@mantine/core'
import { IconDownload, IconX, IconZoomIn, IconZoomOut, IconZoomReset } from '@tabler/icons-react'
import type { MessagePicture } from '@shared/types'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TransformComponent, TransformWrapper, useControls } from 'react-zoom-pan-pinch'
import { Img } from '@/components/Image'
import platform from '@/platform'
import storage from '@/storage'
import { useUIStore } from '@/stores/uiStore'

export default function PictureDialog(_props: {}) {
  const pictureShow = useUIStore((s) => s.pictureShow)
  if (!pictureShow) return null
  if (!pictureShow.picture.url && !pictureShow.picture.storageKey) return null
  return (
    <_PictureDialog picture={pictureShow.picture} onSave={pictureShow.onSave} extraButtons={pictureShow.extraButtons} />
  )
}

function ZoomToolbar() {
  const { t } = useTranslation()
  const { zoomIn, zoomOut, resetTransform } = useControls()
  return (
    <div className="picture-dialog-zoom">
      <Tooltip label={t('Zoom out')}>
        <ActionIcon variant="subtle" color="gray" size="md" onClick={() => zoomOut()} aria-label={t('Zoom out')}>
          <IconZoomOut size={16} stroke={1.6} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label={t('Reset zoom')}>
        <ActionIcon
          variant="subtle"
          color="gray"
          size="md"
          onClick={() => resetTransform()}
          aria-label={t('Reset zoom')}
        >
          <IconZoomReset size={16} stroke={1.6} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label={t('Zoom in')}>
        <ActionIcon variant="subtle" color="gray" size="md" onClick={() => zoomIn()} aria-label={t('Zoom in')}>
          <IconZoomIn size={16} stroke={1.6} />
        </ActionIcon>
      </Tooltip>
    </div>
  )
}

function _PictureDialog(props: {
  picture: MessagePicture
  onSave?: () => void
  extraButtons?: {
    onClick: () => void
    icon: React.ReactNode
  }[]
}) {
  const { picture, onSave, extraButtons } = props
  const { t } = useTranslation()
  const setPictureShow = useUIStore((s) => s.setPictureShow)
  const [url, setUrl] = useState(picture.url)
  const scrimRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    ;(async () => {
      if (picture.url) return
      if (picture.storageKey) {
        const base64 = await storage.getBlob(picture.storageKey)
        if (base64) {
          setUrl(base64.startsWith('data:image/') ? base64 : `data:image/png;base64,${base64}`)
        }
      }
    })()
  }, [picture.url, picture.storageKey])

  const onClose = useCallback(() => setPictureShow(null), [setPictureShow])

  const onSaveDefault = async () => {
    if (onSave) {
      onSave()
      return
    }
    const basename = `export_${Math.random().toString(36).substring(7)}`
    if (picture.storageKey) {
      const base64 = await storage.getBlob(picture.storageKey)
      if (base64) platform.exporter.exportImageFile(basename, base64)
      return
    }
    if (picture.url) {
      if (picture.url.startsWith('data:image')) {
        platform.exporter.exportImageFile(basename, picture.url)
        return
      }
      platform.exporter.exportByUrl(`${basename}.png`, picture.url)
    }
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  useEffect(() => {
    scrimRef.current?.focus()
  }, [])

  return (
    <div
      ref={scrimRef}
      className="picture-dialog-scrim"
      onClick={onClose}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={t('Image preview')}
    >
      <div
        className="picture-dialog-toolbar"
        onClick={(e) => {
          e.stopPropagation()
        }}
      >
        {extraButtons?.map((button, index) => (
          <UnstyledButton
            key={index}
            className="picture-dialog-fab"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              button.onClick()
              onClose()
            }}
          >
            {button.icon}
          </UnstyledButton>
        ))}
        <Tooltip label={t('Download')}>
          <UnstyledButton
            className="picture-dialog-fab is-primary"
            aria-label={t('Download')}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              void onSaveDefault()
            }}
          >
            <IconDownload size={18} stroke={1.6} />
          </UnstyledButton>
        </Tooltip>
        <Tooltip label={t('Close')}>
          <UnstyledButton
            className="picture-dialog-fab"
            aria-label={t('Close')}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onClose()
            }}
          >
            <IconX size={18} stroke={1.6} />
          </UnstyledButton>
        </Tooltip>
      </div>

      {url ? (
        <div
          className="picture-dialog-stage"
          onClick={(e) => e.stopPropagation()}
        >
          <TransformWrapper initialScale={1} centerOnInit minScale={0.15} maxScale={8} limitToBounds={false}>
            <div className="picture-dialog-controls-host">
              <ZoomToolbar />
            </div>
            <TransformComponent
              wrapperStyle={{ width: '100%', height: '100%' }}
              contentStyle={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                width: '100%',
                height: '100%',
              }}
            >
              <Img
                src={url}
                className="picture-dialog-img"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
              />
            </TransformComponent>
          </TransformWrapper>
          <Text size="xs" className="picture-dialog-hint">
            {t('Scroll or pinch to zoom · Esc to close')}
          </Text>
        </div>
      ) : null}
    </div>
  )
}
