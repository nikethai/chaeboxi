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
