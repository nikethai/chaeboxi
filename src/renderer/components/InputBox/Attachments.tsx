import NiceModal from '@ebay/nice-modal-react'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { ChatboxAIAPIError } from '@shared/models/errors'
import { AlertCircle, CheckCircle, Eye, Link, Link2, Loader2, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import FileIcon from '../FileIcon'
import { ImageInStorage } from '../Image'

// 根据错误码获取翻译后的错误消息
function getTranslatedErrorMessage(errorCode: string | undefined, t: (key: string) => string): string | undefined {
  if (!errorCode) return undefined
  const errorDetail = ChatboxAIAPIError.codeNameMap[errorCode]
  if (errorDetail) {
    // 使用 i18nKey 进行翻译，去掉其中的 HTML 标签以便在 Tooltip 中显示纯文本
    const translated = t(errorDetail.i18nKey)
    // 移除 HTML/JSX 标签，只保留纯文本
    return translated.replace(/<[^>]*>/g, '')
  }
  return t('Processing failed')
}

const chipSurfaceClass =
  'composer-attach-chip relative m-1 inline-flex size-[88px] items-center justify-center overflow-hidden rounded-[11px] bg-[var(--chatbox-background-tertiary)] group'

const deleteButtonClass =
  'absolute top-0.5 right-0.5 z-10 flex size-8 items-center justify-center rounded-full bg-[var(--chatbox-background-secondary)]/95 text-red-500 opacity-0 shadow-[0_0_0_1px_rgba(0,0,0,0.06)] transition-[opacity,transform] duration-150 ease-[cubic-bezier(0.2,0,0,1)] group-hover:opacity-100 active:scale-[0.96] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.1)]'

export function ImageMiniCard(props: { storageKey: string; onDelete: () => void }) {
  const { storageKey, onDelete } = props
  return (
    <div key={storageKey} className={cn(chipSurfaceClass, 'group/image-mini-card')}>
      <div className="size-full overflow-hidden rounded-[9px] p-0.5">
        <div className="size-full overflow-hidden rounded-[8px] outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10">
          <ImageInStorage storageKey={storageKey} className="size-full object-cover" />
        </div>
      </div>
      {onDelete && (
        <button
          type="button"
          className={deleteButtonClass}
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

export function FileMiniCard(props: {
  name: string
  fileType: string
  onDelete: () => void
  status?: 'processing' | 'completed' | 'error'
  errorMessage?: string
  onErrorClick?: () => void
}) {
  const { name, onDelete, status, errorMessage, onErrorClick } = props
  const { t } = useTranslation()

  const handleClick = () => {
    if (status === 'error' && onErrorClick) {
      onErrorClick()
    }
  }

  // 获取翻译后的错误消息
  const translatedError = getTranslatedErrorMessage(errorMessage, t)
  const typeLabel = getFileTypeLabel(name, props.fileType)

  return (
    <div
      className={cn(chipSurfaceClass, 'group/file-mini-card cursor-default')}
      onClick={handleClick}
      role={status === 'error' ? 'button' : undefined}
    >
      <Tooltip title={status === 'error' && translatedError ? translatedError : name}>
        <div className="flex w-full flex-col items-center justify-center gap-1 px-1.5">
          <FileIcon filename={name} className="h-7 w-7 text-[var(--chatbox-tint-primary)]" />
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
      </Tooltip>

      {/* Status indicator */}
      {status && (
        <div className="absolute bottom-1 left-1">
          {status === 'processing' && (
            <Loader2 size={14} className="animate-spin text-[var(--chatbox-tint-brand)]" strokeWidth={1.8} />
          )}
          {status === 'completed' && <CheckCircle size={14} className="text-emerald-500" strokeWidth={1.8} />}
          {status === 'error' && <AlertCircle size={14} className="text-red-500" strokeWidth={1.8} />}
        </div>
      )}

      {onDelete && (
        <button
          type="button"
          className={deleteButtonClass}
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
}) {
  const { label, filename, url, storageKey, fileType, byteLength } = props
  const { t } = useTranslation()

  const handleClick = async () => {
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
  const subtitle = [typeLabel, sizeLabel].filter(Boolean).join(' · ')

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
}) {
  const { url, onDelete, status, errorMessage, onErrorClick } = props
  const { t } = useTranslation()
  const label = url.replace(/^https?:\/\//, '')

  const handleClick = () => {
    if (status === 'error' && onErrorClick) {
      onErrorClick()
    }
  }

  // 获取翻译后的错误消息
  const translatedError = getTranslatedErrorMessage(errorMessage, t)

  return (
    <div
      className={cn(chipSurfaceClass, 'group/file-mini-card cursor-default')}
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

      {status && (
        <div className="absolute bottom-1 left-1">
          {status === 'processing' && (
            <Loader2 size={14} className="animate-spin text-[var(--chatbox-tint-brand)]" strokeWidth={1.8} />
          )}
          {status === 'completed' && <CheckCircle size={14} className="text-emerald-500" strokeWidth={1.8} />}
          {status === 'error' && <AlertCircle size={14} className="text-red-500" strokeWidth={1.8} />}
        </div>
      )}

      {onDelete && (
        <button
          type="button"
          className={deleteButtonClass}
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
