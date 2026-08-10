import NiceModal from '@ebay/nice-modal-react'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { ProviderAPIError } from '@shared/models/errors'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, CheckCircle, Eye, Film, Link, Link2, Loader2, Trash2 } from 'lucide-react'
import { type CSSProperties, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useIsSmallScreen } from '@/hooks/useScreenChange'
import { cn } from '@/lib/utils'
import { formatDurationForDisplay } from '@/packages/video'
import storage from '@/storage'
import FileIcon from '../FileIcon'

// (legacy comment removed)
function getTranslatedErrorMessage(errorCode: string | undefined, t: (key: string) => string): string | undefined {
  if (!errorCode) return undefined
  const errorDetail = ProviderAPIError.codeNameMap[errorCode]
  if (errorDetail) {
    // (legacy comment)
    const translated = t(errorDetail.i18nKey)
    // (legacy comment)
    return translated.replace(/<[^>]*>/g, '')
  }
  return t('Processing failed')
}

const chipSurfaceClass =
  'composer-attach-chip relative m-1 inline-flex size-[88px] items-center justify-center overflow-hidden rounded-[11px] bg-[var(--chatbox-background-tertiary)] group'

const deleteButtonClass =
  'composer-attach-delete absolute top-0.5 right-0.5 z-10 flex size-8 min-h-10 min-w-10 items-center justify-center rounded-full bg-[var(--chatbox-background-secondary)]/95 text-red-500 opacity-0 shadow-[0_0_0_1px_rgba(0,0,0,0.06)] transition-[opacity,transform] duration-150 ease-[cubic-bezier(0.2,0,0,1)] group-hover:opacity-100 group-focus-within:opacity-100 active:scale-[0.96] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.1)]'

function chipStaggerStyle(staggerIndex?: number): CSSProperties | undefined {
  if (staggerIndex === undefined || staggerIndex <= 0) return undefined
  return { animationDelay: `${Math.min(staggerIndex, 10) * 40}ms` }
}

/** Poster/thumbnail with skeleton shimmer → opacity crossfade when storage loads. */
function PosterThumb(props: { storageKey: string; className?: string }) {
  const { storageKey, className } = props
  const { data: base64 } = useQuery({
    queryKey: ['image-in-storage', storageKey],
    queryFn: async () => {
      const blob = await storage.getBlob(storageKey)
      return blob ? blob : false
    },
    staleTime: Infinity,
  })
  const [revealed, setRevealed] = useState(false)
  const ready = typeof base64 === 'string' && base64.length > 0
  const picBase64 = ready ? (base64.startsWith('data:image/') ? base64 : `data:image/png;base64,${base64}`) : null

  useEffect(() => {
    if (!ready) {
      setRevealed(false)
      return
    }
    // Next frame so CSS transition runs from opacity 0
    const id = requestAnimationFrame(() => setRevealed(true))
    return () => cancelAnimationFrame(id)
  }, [ready, storageKey])

  return (
    <div className={cn('relative size-full overflow-hidden', className)}>
      <div
        className={cn(
          'composer-poster-skeleton absolute inset-0',
          ready && revealed && 'composer-poster-skeleton-hidden'
        )}
        aria-hidden
      />
      {picBase64 && (
        <img
          src={picBase64}
          alt=""
          className={cn(
            'composer-poster-image size-full object-cover',
            revealed ? 'composer-poster-image-visible' : 'composer-poster-image-hidden'
          )}
          draggable={false}
        />
      )}
    </div>
  )
}

export function ImageMiniCard(props: { storageKey: string; onDelete: () => void; staggerIndex?: number }) {
  const { storageKey, onDelete, staggerIndex } = props
  const isSmallScreen = useIsSmallScreen()
  return (
    <div
      key={storageKey}
      className={cn(chipSurfaceClass, 'group/image-mini-card')}
      style={chipStaggerStyle(staggerIndex)}
    >
      <div className="size-full overflow-hidden rounded-[9px] p-0.5">
        <div className="size-full overflow-hidden rounded-[8px] outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10">
          <PosterThumb storageKey={storageKey} className="size-full" />
        </div>
      </div>
      {onDelete && (
        <button
          type="button"
          className={cn(deleteButtonClass, isSmallScreen && 'opacity-90')}
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          aria-label="Remove image"
        >
          <Trash2 size={16} strokeWidth={1.8} />
        </button>
      )}
    </div>
  )
}

function StatusBadge(props: { status?: 'processing' | 'completed' | 'error' }) {
  const { status } = props
  const [showCompleted, setShowCompleted] = useState(false)

  useEffect(() => {
    if (status !== 'completed') {
      setShowCompleted(false)
      return
    }
    setShowCompleted(true)
    const timer = window.setTimeout(() => setShowCompleted(false), 1200)
    return () => window.clearTimeout(timer)
  }, [status])

  if (!status) return null
  if (status === 'processing') {
    return (
      <div className="absolute top-1 left-1 z-[5] flex size-6 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-[2px]">
        <Loader2 size={13} className="animate-spin text-[var(--chatbox-tint-brand)]" strokeWidth={1.8} />
      </div>
    )
  }
  if (status === 'error') {
    return (
      <div className="absolute top-1 left-1 z-[5] flex size-6 items-center justify-center rounded-full bg-black/45 backdrop-blur-[2px]">
        <AlertCircle size={13} className="text-red-400" strokeWidth={1.8} />
      </div>
    )
  }
  if (status === 'completed' && showCompleted) {
    return (
      <div className="absolute top-1 left-1 z-[5] flex size-6 items-center justify-center rounded-full bg-black/45 text-white opacity-100 transition-opacity duration-300 ease-out backdrop-blur-[2px]">
        <CheckCircle size={13} className="text-emerald-400" strokeWidth={1.8} />
      </div>
    )
  }
  return null
}

export function FileMiniCard(props: {
  name: string
  fileType: string
  onDelete: () => void
  status?: 'processing' | 'completed' | 'error'
  errorMessage?: string
  onErrorClick?: () => void
  /** Optional poster frame for video attachments */
  posterStorageKey?: string
  durationLabel?: string
  mediaKind?: 'document' | 'video'
  /** Stored video blob key — enables chip preview when ready */
  videoStorageKey?: string
  durationSec?: number
  byteLength?: number
  staggerIndex?: number
}) {
  const {
    name,
    onDelete,
    status,
    errorMessage,
    onErrorClick,
    posterStorageKey,
    durationLabel,
    mediaKind,
    videoStorageKey,
    durationSec,
    byteLength,
    staggerIndex,
  } = props
  const { t } = useTranslation()
  const isSmallScreen = useIsSmallScreen()
  const isVideo = mediaKind === 'video' || !!posterStorageKey
  const canPreviewVideo = isVideo && !!videoStorageKey && status !== 'error' && status !== 'processing'

  const handleClick = () => {
    if (status === 'error' && onErrorClick) {
      onErrorClick()
      return
    }
    if (canPreviewVideo) {
      void NiceModal.show('video-attachment-preview', {
        fileName: name,
        posterStorageKey,
        videoStorageKey,
        durationSec,
        byteLength,
      })
    }
  }

  // (legacy comment removed)
  const translatedError = getTranslatedErrorMessage(errorMessage, t)
  const typeLabel = durationLabel || getFileTypeLabel(name, props.fileType)
  const tooltipTitle =
    status === 'error' && translatedError ? translatedError : canPreviewVideo ? t('Preview video') : name

  return (
    <div
      className={cn(
        chipSurfaceClass,
        'group/file-mini-card',
        canPreviewVideo && 'cursor-pointer active:scale-[0.96]',
        !canPreviewVideo && 'cursor-default',
        status === 'processing' && isVideo && 'composer-attach-chip-processing',
        status === 'error' && 'composer-attach-chip-error'
      )}
      style={chipStaggerStyle(staggerIndex)}
      onClick={handleClick}
      role={status === 'error' || canPreviewVideo ? 'button' : undefined}
      tabIndex={status === 'error' || canPreviewVideo ? 0 : undefined}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && (status === 'error' || canPreviewVideo)) {
          e.preventDefault()
          handleClick()
        }
      }}
    >
      <Tooltip title={tooltipTitle}>
        {posterStorageKey ? (
          <div className="size-full overflow-hidden rounded-[9px] p-0.5">
            <div className="relative size-full overflow-hidden rounded-[8px] outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10">
              <PosterThumb storageKey={posterStorageKey} className="size-full" />
              <span className="pointer-events-none absolute bottom-1 right-1 rounded bg-black/60 px-1 font-mono text-[10px] tabular-nums text-white">
                {typeLabel || t('Video')}
              </span>
              {status === 'processing' && (
                <div className="composer-attach-chip-shimmer pointer-events-none absolute inset-0" aria-hidden />
              )}
            </div>
          </div>
        ) : (
          <div className="flex w-full flex-col items-center justify-center gap-1 px-1.5">
            {isVideo ? (
              <Film className="h-7 w-7 text-[var(--chatbox-tint-primary)]" strokeWidth={1.5} />
            ) : (
              <FileIcon filename={name} className="h-7 w-7 text-[var(--chatbox-tint-primary)]" />
            )}
            <Typography
              className="w-full text-center text-[var(--chatbox-tint-primary)]"
              noWrap
              sx={{ fontSize: '11px', lineHeight: 1.3, letterSpacing: '-0.01em' }}
            >
              {name}
            </Typography>
            {typeLabel && (
              <span className="max-w-full truncate font-mono text-[10px] tabular-nums text-[var(--chatbox-tint-tertiary)]">
                {typeLabel}
              </span>
            )}
          </div>
        )}
      </Tooltip>

      {/* Status indicator — top-left so it never collides with duration (bottom-right) */}
      <StatusBadge status={status} />

      {onDelete && (
        <button
          type="button"
          className={cn(deleteButtonClass, isSmallScreen && 'opacity-90')}
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          aria-label={`Remove ${name}`}
        >
          <Trash2 size={16} strokeWidth={1.8} />
        </button>
      )}
    </div>
  )
}

function formatFileSize(bytes: number | undefined): string {
  if (bytes === undefined || bytes === null) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function getFileTypeLabel(filename: string, fileType?: string): string {
  const ext = filename.split('.').pop()?.toUpperCase()
  if (ext) return ext
  if (fileType) return fileType.split('/').pop()?.toUpperCase() || fileType
  return ''
}

export function MessageAttachment(props: {
  label: string
  filename?: string
  url?: string
  storageKey?: string
  fileType?: string
  byteLength?: number
  mediaKind?: 'document' | 'video'
  posterStorageKey?: string
  durationSec?: number
}) {
  const { label, filename, url, storageKey, fileType, byteLength, mediaKind, posterStorageKey, durationSec } = props
  const { t } = useTranslation()
  const isVideo = mediaKind === 'video'

  const handleClick = async () => {
    if (isVideo && storageKey) {
      await NiceModal.show('video-player', {
        title: filename || label,
        storageKey,
        fileName: filename,
      })
      return
    }

    if (storageKey) {
      let title: string
      if (filename) {
        title = `${t('File Content')}: ${filename}`
      } else if (url) {
        const truncatedUrl = url.length > 50 ? `${url.slice(0, 50)}...` : url
        title = `${t('Link Content')}: ${truncatedUrl}`
      } else {
        title = t('Content')
      }
      await NiceModal.show('content-viewer', { title, storageKey })
    }
  }

  const isClickable = !!storageKey
  const typeLabel = filename ? getFileTypeLabel(filename, fileType) : ''
  const sizeLabel = formatFileSize(byteLength)
  const durationLabel = durationSec !== undefined ? formatDurationForDisplay(durationSec) : ''
  const subtitle = isVideo
    ? [durationLabel || t('Video'), sizeLabel].filter(Boolean).join(' · ')
    : [typeLabel, sizeLabel].filter(Boolean).join(' · ')

  if (isVideo) {
    return (
      <Tooltip title={isClickable ? t('Open video') : label}>
        <button
          type="button"
          className={cn(
            'group/attachment flex w-full min-w-0 items-stretch gap-0 overflow-hidden rounded-md',
            'bg-chatbox-background-secondary text-left',
            'transition-[background-color,transform] duration-150 ease-out',
            isClickable && 'cursor-pointer hover:bg-chatbox-background-secondary-hover active:scale-[0.96]'
          )}
          onClick={handleClick}
          disabled={!isClickable}
          aria-label={t('Open video')}
        >
          <div className="relative h-[52px] w-[72px] shrink-0 overflow-hidden bg-[var(--chatbox-background-tertiary)]">
            {posterStorageKey ? (
              <PosterThumb storageKey={posterStorageKey} className="size-full" />
            ) : (
              <div className="flex size-full items-center justify-center">
                <Film className="size-5 text-chatbox-tertiary" strokeWidth={1.5} />
              </div>
            )}
            {durationLabel && (
              <span className="absolute right-1 bottom-1 rounded bg-black/60 px-1 font-mono text-[10px] tabular-nums text-white">
                {durationLabel}
              </span>
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-2 py-1.5">
            <Typography className="text-xs leading-tight" noWrap>
              {label}
            </Typography>
            {subtitle && (
              <Typography className="text-chatbox-tertiary" noWrap sx={{ fontSize: '10px', lineHeight: 1.4 }}>
                {subtitle}
              </Typography>
            )}
          </div>
          {isClickable && (
            <div className="flex shrink-0 items-center pr-2">
              <Eye
                className="size-3.5 text-chatbox-tertiary opacity-0 transition-opacity duration-150 group-hover/attachment:opacity-100"
                strokeWidth={1.5}
              />
            </div>
          )}
        </button>
      </Tooltip>
    )
  }

  return (
    <Tooltip title={isClickable ? t('Click to view parsed content') : label}>
      <div
        className={`flex items-center gap-2 px-2 py-1.5 min-w-0
            rounded-md
            bg-chatbox-background-secondary
            ${isClickable ? 'cursor-pointer hover:bg-chatbox-background-secondary-hover transition-colors' : ''}`}
        onClick={handleClick}
      >
        <div className="flex-none w-7 h-7 rounded-md bg-chatbox-background-primary flex items-center justify-center">
          {filename && <FileIcon filename={filename} className="w-4 h-4" />}
          {url && !filename && <Link2 className="w-4 h-4 text-chatbox-secondary" strokeWidth={1.5} />}
        </div>
        <div className="min-w-0 flex-1">
          <Typography className="text-xs leading-tight" noWrap>
            {label}
          </Typography>
          {subtitle && (
            <Typography className="text-chatbox-tertiary" noWrap sx={{ fontSize: '10px', lineHeight: 1.4 }}>
              {subtitle}
            </Typography>
          )}
        </div>
        {isClickable && (
          <Eye
            className="flex-none w-3.5 h-3.5 text-chatbox-tertiary opacity-0 group-hover/attachment:opacity-100 transition-opacity"
            strokeWidth={1.5}
          />
        )}
      </div>
    </Tooltip>
  )
}

export function LinkMiniCard(props: {
  url: string
  onDelete: () => void
  status?: 'processing' | 'completed' | 'error'
  errorMessage?: string
  onErrorClick?: () => void
  staggerIndex?: number
}) {
  const { url, onDelete, status, errorMessage, onErrorClick, staggerIndex } = props
  const { t } = useTranslation()
  const isSmallScreen = useIsSmallScreen()
  const label = url.replace(/^https?:\/\//, '')

  const handleClick = () => {
    if (status === 'error' && onErrorClick) {
      onErrorClick()
    }
  }

  // (legacy comment removed)
  const translatedError = getTranslatedErrorMessage(errorMessage, t)

  return (
    <div
      className={cn(chipSurfaceClass, 'group/file-mini-card cursor-default')}
      style={chipStaggerStyle(staggerIndex)}
      onClick={handleClick}
      role={status === 'error' ? 'button' : undefined}
    >
      <Tooltip title={status === 'error' && translatedError ? translatedError : url}>
        <div className="flex w-full flex-col items-center justify-center gap-1 px-1.5">
          <Link className="h-7 w-7 text-[var(--chatbox-tint-primary)]" strokeWidth={1.5} />
          <Typography
            className="w-full text-center text-[var(--chatbox-tint-primary)]"
            noWrap
            sx={{ fontSize: '11px', lineHeight: 1.3, letterSpacing: '-0.01em' }}
          >
            {label}
          </Typography>
          <span className="font-mono text-[10px] text-[var(--chatbox-tint-tertiary)]">URL</span>
        </div>
      </Tooltip>

      <StatusBadge status={status} />

      {onDelete && (
        <button
          type="button"
          className={cn(deleteButtonClass, isSmallScreen && 'opacity-90')}
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          aria-label="Remove link"
        >
          <Trash2 size={16} strokeWidth={1.8} />
        </button>
      )}
    </div>
  )
}
