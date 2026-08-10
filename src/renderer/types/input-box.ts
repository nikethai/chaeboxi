import type { Message } from '@shared/types'

export type PreprocessingStatus = 'processing' | 'completed' | 'error' | undefined

export interface PreprocessedFile {
  file: File
  content: string
  storageKey: string
  tokenCountMap?: Record<string, number>
  lineCount?: number
  byteLength?: number
  error?: string
  mediaKind?: 'document' | 'video'
  durationSec?: number
  width?: number
  height?: number
  posterStorageKey?: string
  sampledFrameKeys?: string[]
  sampledFrameTimestamps?: number[]
}

export interface PreprocessedLink {
  url: string
  title: string
  content: string
  storageKey: string
  tokenCountMap?: Record<string, number>
  lineCount?: number
  byteLength?: number
  error?: string
  /** Stored poster/OG image for composer chip preview */
  imageStorageKey?: string
  /** Remote image URL (fallback if not yet stored) */
  thumbnailUrl?: string
}

export interface PreConstructedMessageState {
  text: string
  pictureKeys: string[]
  attachments: File[]
  links: Array<{ url: string }>
  preprocessedFiles: PreprocessedFile[]
  preprocessedLinks: PreprocessedLink[]
  preprocessingStatus: {
    files: Record<string, PreprocessingStatus>
    links: Record<string, PreprocessingStatus>
  }
  preprocessingPromises: {
    files: Map<string, Promise<unknown>>
    links: Map<string, Promise<unknown>>
  }
  message?: Message
}
