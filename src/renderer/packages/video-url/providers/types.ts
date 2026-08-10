import type { NormalizedVideoRead, ParsedVideoUrl, ReadVideoUrlOptions, VideoUrlSettings } from '../types'

export type ProviderFetchInput = {
  parsed: ParsedVideoUrl
  options: Pick<ReadVideoUrlOptions, 'language' | 'mode' | 'abortSignal'>
  settings: VideoUrlSettings
}

export type TranscriptProvider = {
  id: string
  /** Whether settings currently allow this provider to run */
  isConfigured: (settings: VideoUrlSettings) => boolean
  fetch: (input: ProviderFetchInput) => Promise<NormalizedVideoRead>
}
