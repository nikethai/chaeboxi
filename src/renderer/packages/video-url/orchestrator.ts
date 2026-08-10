import { getExtensionSettings } from '@/stores/settingActions'
import { facebookAdapter } from './adapters/facebook'
import { tiktokAdapter } from './adapters/tiktok'
import type { PlatformAdapter } from './adapters/types'
import { vimeoAdapter } from './adapters/vimeo'
import { youtubeAdapter } from './adapters/youtube'
import { buildCacheKey, getCachedVideoRead, getInflight, setCachedVideoRead, setInflight } from './cache'
import { desktopExtract, mergeDesktopSubtitles } from './desktop/extractor'
import { guardVideoUrl } from './guards'
import { getConfiguredTranscriptProvider } from './providers/registry'
import { isSttConfigured, sttRequiresMedia, transcribeAudioUrl } from './stt/fallback'
import { clampMaxChars, truncateTranscript } from './truncate'
import type { NormalizedVideoRead, ReadVideoUrlOptions, VideoUrlSettings } from './types'
import { DEFAULT_MAX_TRANSCRIPT_CHARS, DEFAULT_READ_TIMEOUT_MS } from './types'

function combineAbortSignals(...signals: Array<AbortSignal | undefined>): AbortSignal | undefined {
  const active = signals.filter((s): s is AbortSignal => Boolean(s))
  if (active.length === 0) return undefined
  if (active.length === 1) return active[0]
  const controller = new AbortController()
  const onAbort = () => controller.abort()
  for (const signal of active) {
    if (signal.aborted) {
      controller.abort()
      return controller.signal
    }
    signal.addEventListener('abort', onAbort, { once: true })
  }
  return controller.signal
}

const adapters: Record<string, PlatformAdapter> = {
  youtube: youtubeAdapter,
  vimeo: vimeoAdapter,
  tiktok: tiktokAdapter,
  facebook: facebookAdapter,
}

function loadVideoUrlSettings(): VideoUrlSettings {
  const extension = getExtensionSettings() as { videoUrl?: Partial<VideoUrlSettings> }
  const v = extension.videoUrl
  return {
    enabled: v?.enabled !== false,
    provider: v?.provider ?? 'none',
    apiKey: v?.apiKey,
    customEndpoint: v?.customEndpoint,
    sttProvider: v?.sttProvider ?? 'none',
    sttApiKey: v?.sttApiKey,
    preferCaptions: v?.preferCaptions !== false,
    maxTranscriptChars: v?.maxTranscriptChars ?? DEFAULT_MAX_TRANSCRIPT_CHARS,
    maxSttDurationSec: v?.maxSttDurationSec ?? 1800,
    desktopExtractorEnabled: Boolean(v?.desktopExtractorEnabled),
    desktopExtractorPath: v?.desktopExtractorPath,
  }
}

function mergeMeta(target: NormalizedVideoRead, source: NormalizedVideoRead): NormalizedVideoRead {
  return {
    ...target,
    title: target.title || source.title,
    author: target.author || source.author,
    durationSec: target.durationSec ?? source.durationSec,
    description: target.description || source.description,
    thumbnailUrl: target.thumbnailUrl || source.thumbnailUrl,
    warnings: [...new Set([...(target.warnings || []), ...(source.warnings || [])])],
  }
}

function hasUsableTranscript(result: NormalizedVideoRead): boolean {
  return Boolean(result.transcript?.text?.trim())
}

function applyTruncation(result: NormalizedVideoRead, options: ReadVideoUrlOptions): NormalizedVideoRead {
  if (!result.transcript?.text) return result
  const maxChars = clampMaxChars(options.maxChars ?? loadVideoUrlSettings().maxTranscriptChars)
  const { transcript, truncated, originalLength } = truncateTranscript(result.transcript, {
    maxChars,
    startSec: options.startSec,
    endSec: options.endSec,
    includeTimestamps: options.includeTimestamps,
  })
  return {
    ...result,
    transcript,
    truncated,
    originalTranscriptLength: originalLength,
    partial: result.partial || truncated,
  }
}

function finalizeError(
  result: NormalizedVideoRead,
  settings: VideoUrlSettings,
  needsProPath: boolean
): NormalizedVideoRead {
  if (hasUsableTranscript(result)) {
    return {
      ...result,
      errorCode: undefined,
      errorMessage: undefined,
      partial: result.partial || Boolean(result.truncated),
    }
  }

  // Actionable CTA for platforms that need BYOK
  if (
    needsProPath &&
    (result.errorCode === 'NO_CAPTIONS' ||
      result.errorCode === 'PROVIDER_REQUIRED' ||
      result.errorCode === 'PROVIDER_FAILED' ||
      result.errorCode === 'STT_FAILED')
  ) {
    const providerOk = getConfiguredTranscriptProvider(settings)
    const sttOk = isSttConfigured(settings)
    if (!providerOk && !sttOk) {
      return {
        ...result,
        errorCode: 'PROVIDER_REQUIRED',
        errorMessage:
          result.errorMessage ||
          'Transcript unavailable. Configure a multi-platform provider or STT under Settings → Video URL.',
        partial: true,
      }
    }
  }

  return result
}

/**
 * Waterfall:
 * 1. Native platform adapter (captions/meta)
 * 2. BYOK multi-platform provider
 * 3. Desktop extractor subtitles / media
 * 4. STT if media URL available
 */
export async function readVideoUrl(options: ReadVideoUrlOptions): Promise<NormalizedVideoRead> {
  const guard = guardVideoUrl(options.url)
  if (!guard.ok) {
    return {
      platform: 'unknown',
      url: options.url,
      warnings: [],
      partial: true,
      transcript: null,
      errorCode: guard.errorCode,
      errorMessage: guard.errorMessage,
    }
  }

  const { parsed } = guard
  const settings = loadVideoUrlSettings()
  const mode = options.mode || 'auto'
  const cacheKey = buildCacheKey(parsed, { ...options, mode })

  const cached = getCachedVideoRead(cacheKey)
  if (cached) return cached

  const existing = getInflight(cacheKey)
  if (existing) return existing

  const work = (async (): Promise<NormalizedVideoRead> => {
    const deadlineController = new AbortController()
    const deadlineTimer = setTimeout(() => deadlineController.abort(), DEFAULT_READ_TIMEOUT_MS)
    const abortSignal = combineAbortSignals(options.abortSignal, deadlineController.signal)

    const adapter = adapters[parsed.platform]
    let result: NormalizedVideoRead = {
      platform: parsed.platform,
      url: parsed.canonicalUrl,
      videoId: parsed.videoId,
      warnings: [],
      partial: true,
      transcript: null,
    }

    const adapterOpts = {
      language: options.language,
      mode: mode === 'frames' ? ('auto' as const) : mode,
      abortSignal,
      startSec: options.startSec,
      endSec: options.endSec,
    }

    try {
    // 1. Native adapter
    if (adapter) {
      try {
        const native = await adapter.fetch(parsed, adapterOpts)
        result = mergeMeta(native, result)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        result.warnings.push(`Native adapter error: ${message}`)
        if (deadlineController.signal.aborted || /abort|timeout/i.test(message)) {
          result.errorCode = 'TIMEOUT'
          result.errorMessage =
            'Video URL read timed out. Try again, or configure a BYOK provider under Settings → Video URL.'
        }
      }
    }

    const wantsTranscript = mode === 'auto' || mode === 'transcript'
    const wantsMetaOnly = mode === 'metadata'
    const needsProPath = parsed.platform === 'tiktok' || parsed.platform === 'facebook'

    if (wantsMetaOnly) {
      const out = applyTruncation(result, options)
      setCachedVideoRead(cacheKey, out)
      return out
    }

    // Prefer captions success
    if (settings.preferCaptions && hasUsableTranscript(result) && wantsTranscript) {
      const out = applyTruncation(finalizeError(result, settings, needsProPath), options)
      setCachedVideoRead(cacheKey, out)
      return out
    }

    // 2. BYOK provider
    if (wantsTranscript && !hasUsableTranscript(result) && !deadlineController.signal.aborted) {
      const provider = getConfiguredTranscriptProvider(settings)
      if (provider) {
        try {
          const providerResult = await provider.fetch({
            parsed,
            options: adapterOpts,
            settings,
          })
          result = mergeMeta(result, providerResult)
          if (hasUsableTranscript(providerResult)) {
            result = {
              ...result,
              transcript: providerResult.transcript,
              partial: false,
              errorCode: undefined,
              errorMessage: undefined,
            }
          } else if (providerResult.errorCode) {
            result = {
              ...result,
              errorCode: providerResult.errorCode,
              errorMessage: providerResult.errorMessage,
              warnings: [...result.warnings, ...(providerResult.warnings || [])],
            }
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          result.warnings.push(`Provider error: ${message}`)
          if (deadlineController.signal.aborted || /abort|timeout/i.test(message)) {
            result.errorCode = 'TIMEOUT'
            result.errorMessage =
              'Video URL read timed out. Try again, or configure a BYOK provider under Settings → Video URL.'
          } else {
            result.errorCode = 'PROVIDER_FAILED'
            result.errorMessage = message
          }
        }
      }
    }

    // Skip slower waterfall steps if overall deadline already elapsed.
    if (!deadlineController.signal.aborted) {
      // 3. Desktop extractor
      let desktopMediaUrl: string | undefined
      if (wantsTranscript && !hasUsableTranscript(result) && settings.desktopExtractorEnabled) {
        const extract = await desktopExtract({
          parsed,
          settings,
          abortSignal,
        })
        if (extract) {
          if (extract.subtitleText) {
            result = mergeDesktopSubtitles(result, extract)
          }
          if (extract.mediaUrl) desktopMediaUrl = extract.mediaUrl
          if (extract.error) result.warnings.push(extract.error)
          if (extract.title && !result.title) result.title = extract.title
          if (extract.durationSec != null && result.durationSec == null) {
            result.durationSec = extract.durationSec
          }
        }
      }

      // 4. STT if media available
      if (wantsTranscript && !hasUsableTranscript(result) && desktopMediaUrl && isSttConfigured(settings)) {
        if (result.durationSec && result.durationSec > settings.maxSttDurationSec) {
          result.warnings.push(
            `Video duration (${Math.round(result.durationSec)}s) exceeds max STT duration (${settings.maxSttDurationSec}s).`
          )
          result.errorCode = 'BUDGET_EXCEEDED'
          result.errorMessage = 'Video too long for STT with current settings.'
        } else {
          const sttResult = await transcribeAudioUrl({
            audioUrl: desktopMediaUrl,
            language: options.language,
            settings,
            parsed,
            abortSignal,
          })
          result = mergeMeta(result, sttResult)
          if (hasUsableTranscript(sttResult)) {
            result.transcript = sttResult.transcript
            result.partial = false
            result.errorCode = undefined
            result.errorMessage = undefined
            result.warnings = [...result.warnings, ...(sttResult.warnings || [])]
          } else {
            result.errorCode = sttResult.errorCode || result.errorCode
            result.errorMessage = sttResult.errorMessage || result.errorMessage
          }
        }
      } else if (
        wantsTranscript &&
        !hasUsableTranscript(result) &&
        isSttConfigured(settings) &&
        !desktopMediaUrl &&
        (result.errorCode === 'NO_CAPTIONS' || result.errorCode === 'PROVIDER_REQUIRED')
      ) {
        // STT configured but no media — explain
        const hint = sttRequiresMedia(parsed)
        result.warnings = [...result.warnings, ...hint.warnings]
        if (!getConfiguredTranscriptProvider(settings)) {
          result.errorCode = hint.errorCode
          result.errorMessage = hint.errorMessage
        }
      }
    }

    // Frames mode: optional thumbnail note (full remote frame extract needs media)
    if (mode === 'frames' || (mode === 'auto' && options.maxFrames && options.maxFrames > 0)) {
      if (!result.frames?.length) {
        if (result.thumbnailUrl) {
          result.warnings.push(
            'Remote frame sampling is limited; thumbnail URL available. Upload the file or use desktop extractor for multi-frame vision.'
          )
        } else {
          result.warnings.push(
            'Frame extraction from remote URLs requires desktop media extract or local upload (read_video).'
          )
        }
      }
    }

    // If the overall deadline fired mid-waterfall, surface TIMEOUT when still empty.
    if (deadlineController.signal.aborted && !hasUsableTranscript(result) && !result.errorCode) {
      result = {
        ...result,
        errorCode: 'TIMEOUT',
        errorMessage:
          'Video URL read timed out. Try again, or configure a BYOK provider under Settings → Video URL.',
        partial: true,
      }
    }

    const out = applyTruncation(finalizeError(result, settings, needsProPath), options)
    setCachedVideoRead(cacheKey, out)
    return out
    } finally {
      clearTimeout(deadlineTimer)
    }
  })()

  setInflight(cacheKey, work)
  return work
}

export function buildCapabilitySummary(settings?: VideoUrlSettings): string {
  const s = settings || loadVideoUrlSettings()
  const provider = getConfiguredTranscriptProvider(s)
  const stt = isSttConfigured(s)
  return [
    'Platform capability (current config):',
    `- YouTube: metadata + free captions${provider ? ' + provider' : ''}${stt ? ' + STT' : ''}`,
    `- Vimeo: metadata + public tracks if any${provider ? ' + provider' : ''}`,
    `- TikTok: metadata${provider || stt ? ' + transcript via provider/STT' : ' (provider/STT required for transcript)'}`,
    `- Facebook: metadata${provider || stt ? ' + transcript via provider/STT' : ' (provider/STT required for transcript)'}`,
    s.desktopExtractorEnabled ? '- Desktop extractor: enabled' : '- Desktop extractor: off',
    '- Note: browser builds may block free caption scrapes (CORS); desktop/app or BYOK provider is more reliable.',
  ].join('\n')
}

export { loadVideoUrlSettings }
