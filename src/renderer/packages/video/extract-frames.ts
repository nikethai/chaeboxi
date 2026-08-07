import { computeSampleTimestamps, type VideoSampleMode } from './sample-timestamps'
import { computeVisionResizeDimensions } from './vision-resize'

export interface ExtractedVideoFrame {
  timestampSec: number
  dataUrl: string
  width: number
  height: number
}

export interface VideoMetadata {
  durationSec: number
  width: number
  height: number
}

export interface ExtractVideoFramesOptions {
  maxFrames: number
  mode?: VideoSampleMode
  timestamps?: number[]
  intervalSec?: number
  startSec?: number
  endSec?: number
  jpegQuality?: number
  signal?: AbortSignal
}

export interface ExtractVideoFramesResult {
  metadata: VideoMetadata
  frames: ExtractedVideoFrame[]
}

export class VideoExtractError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'unsupported_environment'
      | 'decode_failed'
      | 'aborted'
      | 'invalid_video'
      | 'seek_failed'
  ) {
    super(message)
    this.name = 'VideoExtractError'
  }
}

function assertNotAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new VideoExtractError('Video frame extraction aborted', 'aborted')
  }
}

function loadVideoElement(src: string, signal?: AbortSignal): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined' || typeof HTMLVideoElement === 'undefined') {
      reject(new VideoExtractError('Video extraction requires a browser/webview environment', 'unsupported_environment'))
      return
    }

    const video = document.createElement('video')
    video.preload = 'auto'
    video.muted = true
    video.playsInline = true
    // Required for canvas draw in some browsers
    video.crossOrigin = 'anonymous'

    const cleanup = () => {
      video.removeEventListener('loadedmetadata', onLoaded)
      video.removeEventListener('error', onError)
      signal?.removeEventListener('abort', onAbort)
    }

    const onAbort = () => {
      cleanup()
      reject(new VideoExtractError('Video frame extraction aborted', 'aborted'))
    }

    const onLoaded = () => {
      cleanup()
      resolve(video)
    }

    const onError = () => {
      cleanup()
      reject(new VideoExtractError('Failed to decode video (codec or container may be unsupported)', 'decode_failed'))
    }

    signal?.addEventListener('abort', onAbort, { once: true })
    video.addEventListener('loadedmetadata', onLoaded, { once: true })
    video.addEventListener('error', onError, { once: true })
    video.src = src
  })
}

function seekVideo(video: HTMLVideoElement, timeSec: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    assertNotAborted(signal)

    const onSeeked = () => {
      cleanup()
      resolve()
    }
    const onError = () => {
      cleanup()
      reject(new VideoExtractError(`Failed to seek video to ${timeSec}s`, 'seek_failed'))
    }
    const onAbort = () => {
      cleanup()
      reject(new VideoExtractError('Video frame extraction aborted', 'aborted'))
    }
    const cleanup = () => {
      video.removeEventListener('seeked', onSeeked)
      video.removeEventListener('error', onError)
      signal?.removeEventListener('abort', onAbort)
    }

    signal?.addEventListener('abort', onAbort, { once: true })
    video.addEventListener('seeked', onSeeked, { once: true })
    video.addEventListener('error', onError, { once: true })

    // If already at time (within tolerance), resolve immediately
    if (Math.abs(video.currentTime - timeSec) < 0.01 && video.readyState >= 2) {
      cleanup()
      resolve()
      return
    }

    video.currentTime = timeSec
  })
}

function captureFrame(
  video: HTMLVideoElement,
  jpegQuality: number
): { dataUrl: string; width: number; height: number } {
  const sourceW = video.videoWidth || 1
  const sourceH = video.videoHeight || 1
  const { width, height } = computeVisionResizeDimensions(sourceW, sourceH)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new VideoExtractError('Cannot get canvas context for frame capture', 'unsupported_environment')
  }
  ctx.drawImage(video, 0, 0, width, height)
  const dataUrl = canvas.toDataURL('image/jpeg', jpegQuality)
  return { dataUrl, width, height }
}

/**
 * Extract vision-ready JPEG frames from a video Blob/File.
 * Seeks sequentially to avoid mobile memory spikes.
 */
export async function extractVideoFrames(
  source: Blob | File,
  options: ExtractVideoFramesOptions
): Promise<ExtractVideoFramesResult> {
  assertNotAborted(options.signal)

  if (!(source instanceof Blob) || source.size === 0) {
    throw new VideoExtractError('Invalid video source', 'invalid_video')
  }

  const objectUrl = URL.createObjectURL(source)
  let video: HTMLVideoElement | null = null

  try {
    video = await loadVideoElement(objectUrl, options.signal)
    const durationSec = Number.isFinite(video.duration) ? video.duration : 0
    if (durationSec <= 0) {
      throw new VideoExtractError('Video has invalid or unknown duration', 'invalid_video')
    }

    const metadata: VideoMetadata = {
      durationSec,
      width: video.videoWidth || 0,
      height: video.videoHeight || 0,
    }

    const timestamps = computeSampleTimestamps({
      durationSec,
      maxFrames: options.maxFrames,
      mode: options.mode,
      timestamps: options.timestamps,
      intervalSec: options.intervalSec,
      startSec: options.startSec,
      endSec: options.endSec,
    })

    const jpegQuality = options.jpegQuality ?? 0.85
    const frames: ExtractedVideoFrame[] = []

    for (const t of timestamps) {
      assertNotAborted(options.signal)
      await seekVideo(video, t, options.signal)
      const captured = captureFrame(video, jpegQuality)
      frames.push({
        timestampSec: t,
        dataUrl: captured.dataUrl,
        width: captured.width,
        height: captured.height,
      })
    }

    return { metadata, frames }
  } finally {
    if (video) {
      video.removeAttribute('src')
      video.load()
    }
    URL.revokeObjectURL(objectUrl)
  }
}

/** Load only metadata (duration / dimensions) without extracting frames. */
export async function loadVideoMetadata(source: Blob | File, signal?: AbortSignal): Promise<VideoMetadata> {
  assertNotAborted(signal)
  const objectUrl = URL.createObjectURL(source)
  let video: HTMLVideoElement | null = null
  try {
    video = await loadVideoElement(objectUrl, signal)
    const durationSec = Number.isFinite(video.duration) ? video.duration : 0
    if (durationSec <= 0) {
      throw new VideoExtractError('Video has invalid or unknown duration', 'invalid_video')
    }
    return {
      durationSec,
      width: video.videoWidth || 0,
      height: video.videoHeight || 0,
    }
  } finally {
    if (video) {
      video.removeAttribute('src')
      video.load()
    }
    URL.revokeObjectURL(objectUrl)
  }
}

/** Extract a single poster frame near the start (for UI chips). */
export async function extractVideoPoster(
  source: Blob | File,
  options?: { jpegQuality?: number; signal?: AbortSignal }
): Promise<{ posterDataUrl: string; metadata: VideoMetadata }> {
  const result = await extractVideoFrames(source, {
    maxFrames: 1,
    mode: 'timestamps',
    timestamps: [0.1],
    jpegQuality: options?.jpegQuality ?? 0.8,
    signal: options?.signal,
  })
  const frame = result.frames[0]
  if (!frame) {
    throw new VideoExtractError('Failed to extract poster frame', 'decode_failed')
  }
  return { posterDataUrl: frame.dataUrl, metadata: result.metadata }
}
