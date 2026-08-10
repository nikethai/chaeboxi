import platform from '@/platform'
import type { NormalizedVideoRead, ParsedVideoUrl, VideoUrlSettings } from '../types'

export type DesktopExtractResult = {
  /** Local or temporary media path / URL suitable for STT or frames */
  mediaUrl?: string
  subtitleText?: string
  title?: string
  durationSec?: number
  error?: string
}

/**
 * Optional desktop yt-dlp path. Uses platform IPC when available; otherwise no-op.
 * Does not ship yt-dlp binary — user must install and optionally set path.
 */
export async function desktopExtract(input: {
  parsed: ParsedVideoUrl
  settings: VideoUrlSettings
  abortSignal?: AbortSignal
}): Promise<DesktopExtractResult | null> {
  if (!input.settings.desktopExtractorEnabled) return null
  if (platform.type !== 'desktop') {
    return { error: 'Desktop extractor is only available in the desktop app.' }
  }

  // IPC hook: prefer typed desktop API when present
  const desktopApi = (window as unknown as { desktopAPI?: Record<string, unknown> }).desktopAPI
  const extract = desktopApi?.extractVideoUrl as
    | ((args: { url: string; ytDlpPath?: string }) => Promise<DesktopExtractResult>)
    | undefined

  if (!extract) {
    return {
      error:
        'Desktop video extractor is not available in this build. Install yt-dlp and await a future IPC command, or use a BYOK provider.',
    }
  }

  try {
    return await extract({
      url: input.parsed.canonicalUrl,
      ytDlpPath: input.settings.desktopExtractorPath,
    })
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}

export function mergeDesktopSubtitles(base: NormalizedVideoRead, extract: DesktopExtractResult): NormalizedVideoRead {
  if (!extract.subtitleText?.trim()) return base
  return {
    ...base,
    title: base.title || extract.title,
    durationSec: base.durationSec ?? extract.durationSec,
    transcript: {
      source: 'desktop',
      text: extract.subtitleText.trim(),
    },
    partial: false,
    errorCode: undefined,
    errorMessage: undefined,
    warnings: [...base.warnings, 'Transcript from desktop extractor subtitles.'],
  }
}
