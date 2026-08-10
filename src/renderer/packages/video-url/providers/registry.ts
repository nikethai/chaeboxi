import type { VideoUrlSettings } from '../types'
import { customHttpProvider } from './custom-http'
import { supadataProvider } from './supadata'
import type { TranscriptProvider } from './types'

const providers: TranscriptProvider[] = [supadataProvider, customHttpProvider]

export function getConfiguredTranscriptProvider(settings: VideoUrlSettings): TranscriptProvider | null {
  if (settings.provider === 'none') return null
  const match = providers.find((p) => p.id === settings.provider)
  if (match?.isConfigured(settings)) return match
  return null
}

export function listTranscriptProviders(): TranscriptProvider[] {
  return providers
}

export type { TranscriptProvider }
