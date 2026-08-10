export type VideoPlatform = 'youtube' | 'vimeo' | 'tiktok' | 'facebook' | 'unknown'

export type VideoReadMode = 'auto' | 'transcript' | 'metadata' | 'frames'

export type TranscriptSource = 'captions' | 'provider' | 'stt' | 'oembed' | 'desktop'

export type VideoUrlErrorCode =
  | 'UNSUPPORTED_URL'
  | 'PRIVATE_OR_UNAVAILABLE'
  | 'NO_CAPTIONS'
  | 'PROVIDER_REQUIRED'
  | 'PROVIDER_FAILED'
  | 'STT_FAILED'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'SSRF_BLOCKED'
  | 'BUDGET_EXCEEDED'
  | 'NETWORK_ERROR'

export type TranscriptSegment = {
  startSec: number
  endSec?: number
  text: string
}

export type NormalizedTranscript = {
  source: TranscriptSource
  language?: string
  text: string
  segments?: TranscriptSegment[]
}

export type VideoFrameResult = {
  timestampSec: number
  storageKey: string
  width: number
  height: number
}

export type NormalizedVideoRead = {
  platform: VideoPlatform
  url: string
  videoId?: string
  title?: string
  author?: string
  durationSec?: number
  description?: string
  thumbnailUrl?: string
  transcript?: NormalizedTranscript | null
  frames?: VideoFrameResult[]
  warnings: string[]
  partial: boolean
  truncated?: boolean
  originalTranscriptLength?: number
  errorCode?: VideoUrlErrorCode
  errorMessage?: string
}

export type ReadVideoUrlOptions = {
  url: string
  mode?: VideoReadMode
  language?: string
  maxChars?: number
  startSec?: number
  endSec?: number
  maxFrames?: number
  includeTimestamps?: boolean
  abortSignal?: AbortSignal
}

export type ParsedVideoUrl = {
  platform: VideoPlatform
  url: string
  canonicalUrl: string
  videoId?: string
  host: string
}

export type VideoUrlSettings = {
  enabled: boolean
  provider: 'none' | 'supadata' | 'custom'
  apiKey?: string
  customEndpoint?: string
  sttProvider: 'none' | 'openai'
  sttApiKey?: string
  preferCaptions: boolean
  maxTranscriptChars: number
  maxSttDurationSec: number
  desktopExtractorEnabled: boolean
  desktopExtractorPath?: string
}

export const DEFAULT_MAX_TRANSCRIPT_CHARS = 12_000
export const MIN_TRANSCRIPT_CHARS = 500
export const MAX_TRANSCRIPT_CHARS = 50_000
export const DEFAULT_CAPTION_TIMEOUT_MS = 20_000
export const DEFAULT_PROVIDER_TIMEOUT_MS = 45_000
export const DEFAULT_STT_TIMEOUT_MS = 120_000
