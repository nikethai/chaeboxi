import NiceModal, { useModal } from '@ebay/nice-modal-react'
import { Button, Text } from '@mantine/core'
import { IconPlayerPlay } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { AdaptiveModal } from '@/components/common/AdaptiveModal'
import { ScalableIcon } from '@/components/common/ScalableIcon'
import { ImageInStorage } from '@/components/Image'
import { formatBytesForDisplay, formatDurationForDisplay, getVideoLimits } from '@/packages/video'
import platform from '@/platform'

interface VideoAttachmentPreviewProps {
  fileName: string
  posterStorageKey?: string
  videoStorageKey?: string
  durationSec?: number
  byteLength?: number
}

const VideoAttachmentPreview = NiceModal.create(
  ({ fileName, posterStorageKey, videoStorageKey, durationSec, byteLength }: VideoAttachmentPreviewProps) => {
    const modal = useModal()
    const { t } = useTranslation()
    const limits = getVideoLimits(platform.formFactor === 'desktop' ? 'desktop' : 'mobile')
    const maxMinutes = Math.floor(limits.maxDurationSec / 60)
    const maxSize = formatBytesForDisplay(limits.maxFileBytes)

    const onClose = () => {
      modal.resolve()
      modal.hide()
    }

    const onPlay = async () => {
      if (!videoStorageKey) return
      onClose()
      await NiceModal.show('video-player', {
        title: fileName,
        storageKey: videoStorageKey,
        fileName,
      })
    }

    const metaParts = [
      durationSec !== undefined ? formatDurationForDisplay(durationSec) : null,
      byteLength !== undefined ? formatBytesForDisplay(byteLength) : null,
    ].filter(Boolean)

    return (
      <AdaptiveModal opened={modal.visible} onClose={onClose} size="sm" centered title={t('Video')}>
        <div className="flex flex-col gap-3">
          <div className="relative aspect-video w-full overflow-hidden rounded-md bg-[var(--chatbox-background-tertiary)] outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10">
            {posterStorageKey ? (
              <ImageInStorage storageKey={posterStorageKey} className="size-full object-cover" />
            ) : (
              <div className="flex size-full items-center justify-center text-[var(--chatbox-tint-tertiary)]">
                <ScalableIcon icon={IconPlayerPlay} size={28} />
              </div>
            )}
            {durationSec !== undefined && (
              <span className="absolute right-2 bottom-2 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-white">
                {formatDurationForDisplay(durationSec)}
              </span>
            )}
          </div>

          <div className="min-w-0">
            <Text size="sm" fw={500} className="truncate" m={0}>
              {fileName}
            </Text>
            {metaParts.length > 0 && (
              <Text size="xs" c="dimmed" className="font-mono tabular-nums" mt={4} m={0}>
                {metaParts.join(' · ')}
              </Text>
            )}
            <Text size="xs" c="dimmed" mt={8} m={0}>
              {t('MP4 · WebM · max {{minutes}} min · {{size}}', {
                minutes: maxMinutes,
                size: maxSize,
              })}
            </Text>
          </div>
        </div>

        <AdaptiveModal.Actions>
          <AdaptiveModal.CloseButton onClick={onClose} />
          <Button
            onClick={() => void onPlay()}
            disabled={!videoStorageKey}
            leftSection={<ScalableIcon size={16} icon={IconPlayerPlay} />}
          >
            {t('Play')}
          </Button>
        </AdaptiveModal.Actions>
      </AdaptiveModal>
    )
  }
)

export default VideoAttachmentPreview
