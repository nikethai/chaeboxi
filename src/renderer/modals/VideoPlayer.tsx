import NiceModal, { useModal } from '@ebay/nice-modal-react'
import { Flex, Loader, Text } from '@mantine/core'
import { IconPlayerPauseFilled, IconPlayerPlayFilled, IconVolume, IconVolumeOff, IconX } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AdaptiveModal } from '@/components/common/AdaptiveModal'
import { ScalableIcon } from '@/components/common/ScalableIcon'
import { cn } from '@/lib/utils'
import { dataUrlToBlob } from '@/packages/video'
import storage from '@/storage'

interface VideoPlayerProps {
  title?: string
  storageKey: string
  fileName?: string
}

function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const s = Math.floor(seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const rem = s % 60
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`
  }
  return `${m}:${rem.toString().padStart(2, '0')}`
}

const VideoPlayer = NiceModal.create(({ title, storageKey, fileName }: VideoPlayerProps) => {
  const modal = useModal()
  const { t } = useTranslation()
  const objectUrlRef = useRef<string | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const hideControlsTimer = useRef<number | null>(null)

  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [decodeError, setDecodeError] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [seeking, setSeeking] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)

  const {
    data: rawBlob,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['video-player', storageKey],
    queryFn: async () => {
      const stored = await storage.getBlob(storageKey)
      if (!stored) {
        throw new Error('missing')
      }
      return stored
    },
    enabled: modal.visible && !!storageKey,
    staleTime: Infinity,
    retry: false,
  })

  useEffect(() => {
    if (!rawBlob) {
      return
    }

    let cancelled = false
    try {
      const blob =
        typeof rawBlob === 'string' && rawBlob.startsWith('data:')
          ? dataUrlToBlob(rawBlob)
          : typeof rawBlob === 'string'
            ? dataUrlToBlob(`data:video/mp4;base64,${rawBlob}`)
            : rawBlob
      const url = URL.createObjectURL(blob)
      if (cancelled) {
        URL.revokeObjectURL(url)
        return
      }
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
      }
      objectUrlRef.current = url
      setObjectUrl(url)
      setDecodeError(false)
      setPlaying(false)
      setCurrentTime(0)
      setDuration(0)
    } catch {
      if (!cancelled) {
        setDecodeError(true)
        setObjectUrl(null)
      }
    }

    return () => {
      cancelled = true
    }
  }, [rawBlob])

  const revokeUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
    setObjectUrl(null)
  }, [])

  useEffect(() => {
    if (modal.visible) {
      return
    }
    revokeUrl()
    setDecodeError(false)
    setPlaying(false)
    setCurrentTime(0)
    setDuration(0)
  }, [modal.visible, revokeUrl])

  useEffect(() => {
    return () => {
      revokeUrl()
      if (hideControlsTimer.current) {
        window.clearTimeout(hideControlsTimer.current)
      }
    }
  }, [revokeUrl])

  const scheduleHideControls = useCallback(() => {
    if (hideControlsTimer.current) {
      window.clearTimeout(hideControlsTimer.current)
    }
    hideControlsTimer.current = window.setTimeout(() => {
      const v = videoRef.current
      if (v && !v.paused) {
        setControlsVisible(false)
      }
    }, 2200)
  }, [])

  const showControls = useCallback(() => {
    setControlsVisible(true)
    scheduleHideControls()
  }, [scheduleHideControls])

  const onClose = () => {
    videoRef.current?.pause()
    revokeUrl()
    modal.resolve()
    modal.hide()
  }

  const togglePlay = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) {
      void v.play().catch(() => {
        /* autoplay / decode may reject */
      })
    } else {
      v.pause()
    }
    showControls()
  }, [showControls])

  const toggleMute = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    v.muted = !v.muted
    setMuted(v.muted)
    showControls()
  }, [showControls])

  const onSeekInput = (value: number) => {
    const v = videoRef.current
    if (!v || !Number.isFinite(value)) return
    v.currentTime = value
    setCurrentTime(value)
  }

  const progress = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0

  const displayTitle = title || fileName || t('Video')
  const failed = isError || decodeError || (!isLoading && rawBlob === undefined && modal.visible)

  return (
    <AdaptiveModal opened={modal.visible} onClose={onClose} size="lg" centered title={displayTitle}>
      {isLoading ? (
        <Flex justify="center" align="center" className="min-h-[220px]">
          <Loader />
        </Flex>
      ) : failed || !objectUrl ? (
        <div className="rounded-[9px] bg-[var(--chatbox-background-secondary)] px-3 py-8 text-center">
          <Text c="dimmed" size="sm">
            {t('Failed to load video')}
          </Text>
        </div>
      ) : (
        <div
          className="studio-video-shell group/video"
          tabIndex={0}
          role="region"
          aria-label={displayTitle}
          onMouseMove={showControls}
          onMouseLeave={() => {
            if (playing) setControlsVisible(false)
          }}
          onFocusCapture={showControls}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'k' || e.key === 'K') {
              e.preventDefault()
              togglePlay()
            } else if (e.key === 'm' || e.key === 'M') {
              e.preventDefault()
              toggleMute()
            } else if (e.key === 'ArrowRight') {
              e.preventDefault()
              const v = videoRef.current
              if (!v) return
              v.currentTime = Math.min(v.duration || 0, v.currentTime + 5)
              showControls()
            } else if (e.key === 'ArrowLeft') {
              e.preventDefault()
              const v = videoRef.current
              if (!v) return
              v.currentTime = Math.max(0, v.currentTime - 5)
              showControls()
            }
          }}
        >
          <video
            ref={videoRef}
            key={objectUrl}
            className="studio-video-el"
            playsInline
            preload="metadata"
            src={objectUrl}
            muted={muted}
            onClick={togglePlay}
            onPlay={() => {
              setPlaying(true)
              scheduleHideControls()
            }}
            onPause={() => {
              setPlaying(false)
              setControlsVisible(true)
            }}
            onTimeUpdate={() => {
              const v = videoRef.current
              if (!v || seeking) return
              setCurrentTime(v.currentTime)
            }}
            onLoadedMetadata={() => {
              const v = videoRef.current
              if (!v) return
              setDuration(Number.isFinite(v.duration) ? v.duration : 0)
            }}
            onDurationChange={() => {
              const v = videoRef.current
              if (!v) return
              setDuration(Number.isFinite(v.duration) ? v.duration : 0)
            }}
            onEnded={() => {
              setPlaying(false)
              setControlsVisible(true)
            }}
            onError={() => setDecodeError(true)}
          >
            <track kind="captions" />
          </video>

          {/* Center play affordance when paused */}
          {!playing && (
            <button type="button" className="studio-video-center-play" onClick={togglePlay} aria-label={t('Play')}>
              <ScalableIcon icon={IconPlayerPlayFilled} size={28} />
            </button>
          )}

          {/* Bottom control dock */}
          <div
            className={cn('studio-video-dock', controlsVisible || !playing ? 'is-visible' : 'is-hidden')}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="studio-video-scrub">
              <input
                type="range"
                className="studio-video-range"
                min={0}
                max={duration || 0}
                step={0.05}
                value={Number.isFinite(currentTime) ? currentTime : 0}
                aria-label={t('Seek')}
                style={{ '--progress': `${progress}%` } as CSSProperties}
                onPointerDown={() => setSeeking(true)}
                onPointerUp={() => {
                  setSeeking(false)
                  showControls()
                }}
                onChange={(e) => onSeekInput(Number(e.target.value))}
              />
            </div>

            <div className="studio-video-bar">
              <button
                type="button"
                className="studio-video-btn"
                onClick={togglePlay}
                aria-label={playing ? t('Pause') : t('Play')}
              >
                <ScalableIcon icon={playing ? IconPlayerPauseFilled : IconPlayerPlayFilled} size={16} />
              </button>

              <span className="studio-video-time font-mono tabular-nums" aria-live="off">
                {formatClock(currentTime)}
                <span className="studio-video-time-sep">/</span>
                {formatClock(duration)}
              </span>

              <div className="studio-video-bar-spacer" />

              <button
                type="button"
                className="studio-video-btn"
                onClick={toggleMute}
                aria-label={muted ? t('Unmute') : t('Mute')}
              >
                <ScalableIcon icon={muted ? IconVolumeOff : IconVolume} size={16} />
              </button>

              <button
                type="button"
                className="studio-video-btn studio-video-btn-close"
                onClick={onClose}
                aria-label={t('Close')}
              >
                <ScalableIcon icon={IconX} size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      <AdaptiveModal.Actions>
        <AdaptiveModal.CloseButton onClick={onClose} />
      </AdaptiveModal.Actions>
    </AdaptiveModal>
  )
})

export default VideoPlayer
