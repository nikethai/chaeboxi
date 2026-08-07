import type { FormFactor } from '@/platform/interfaces'

export type VideoFormFactor = FormFactor | 'web'

export interface VideoLimits {
  maxFileBytes: number
  maxDurationSec: number
  defaultAutoFrames: number
  maxFramesPerToolCall: number
  maxFramesPerVideoPerTurn: number
  maxVideosPerMessage: number
  jpegQuality: number
}

const DESKTOP_LIMITS: VideoLimits = {
  maxFileBytes: 200 * 1024 * 1024,
  maxDurationSec: 10 * 60,
  defaultAutoFrames: 6,
  maxFramesPerToolCall: 8,
  maxFramesPerVideoPerTurn: 8,
  maxVideosPerMessage: 2,
  jpegQuality: 0.85,
}

const MOBILE_LIMITS: VideoLimits = {
  maxFileBytes: 50 * 1024 * 1024,
  maxDurationSec: 5 * 60,
  defaultAutoFrames: 4,
  maxFramesPerToolCall: 6,
  maxFramesPerVideoPerTurn: 6,
  maxVideosPerMessage: 1,
  jpegQuality: 0.85,
}

/** Web uses mobile-tier caps (memory / browser decode risk). */
export function getVideoLimits(formFactor: VideoFormFactor): VideoLimits {
  if (formFactor === 'desktop') {
    return { ...DESKTOP_LIMITS }
  }
  return { ...MOBILE_LIMITS }
}

export function clampFrameCount(requested: number, max: number): number {
  if (!Number.isFinite(requested) || requested < 1) {
    return 1
  }
  return Math.min(Math.floor(requested), max)
}

export function formatBytesForDisplay(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  return `${(bytes / (1024 * 1024)).toFixed(0)} MB`
}

export function formatDurationForDisplay(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const m = Math.floor(s / 60)
  const rem = s % 60
  if (m === 0) {
    return `${rem}s`
  }
  return `${m}m ${rem.toString().padStart(2, '0')}s`
}
