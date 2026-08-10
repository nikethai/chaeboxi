import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearVideoUrlCache } from './cache'

vi.mock('@/stores/settingActions', () => ({
  getExtensionSettings: () => ({
    videoUrl: {
      enabled: true,
      provider: 'none',
      preferCaptions: true,
      maxTranscriptChars: 12_000,
      maxSttDurationSec: 1800,
      sttProvider: 'none',
      desktopExtractorEnabled: false,
    },
  }),
}))

vi.mock('./adapters/youtube', () => ({
  youtubeAdapter: {
    platform: 'youtube',
    fetch: vi.fn(async () => ({
      platform: 'youtube' as const,
      url: 'https://www.youtube.com/watch?v=abc',
      videoId: 'abc',
      title: 'Test Video',
      author: 'Author',
      warnings: [],
      partial: false,
      transcript: {
        source: 'captions' as const,
        language: 'en',
        text: 'Hello from captions',
        segments: [{ startSec: 0, text: 'Hello from captions' }],
      },
    })),
  },
}))

vi.mock('./adapters/tiktok', () => ({
  tiktokAdapter: {
    platform: 'tiktok',
    fetch: vi.fn(async () => ({
      platform: 'tiktok' as const,
      url: 'https://www.tiktok.com/@u/video/1',
      videoId: '1',
      title: 'tt',
      warnings: [],
      partial: true,
      transcript: null,
      errorCode: 'PROVIDER_REQUIRED' as const,
      errorMessage: 'need provider',
    })),
  },
}))

vi.mock('./adapters/vimeo', () => ({
  vimeoAdapter: {
    platform: 'vimeo',
    fetch: vi.fn(async () => ({
      platform: 'vimeo' as const,
      url: 'https://vimeo.com/1',
      videoId: '1',
      title: 'Vimeo',
      warnings: [],
      partial: true,
      transcript: null,
      errorCode: 'NO_CAPTIONS' as const,
    })),
  },
}))

vi.mock('./adapters/facebook', () => ({
  facebookAdapter: {
    platform: 'facebook',
    fetch: vi.fn(async () => ({
      platform: 'facebook' as const,
      url: 'https://facebook.com/watch/?v=1',
      warnings: [],
      partial: true,
      transcript: null,
      errorCode: 'PROVIDER_REQUIRED' as const,
    })),
  },
}))

import { readVideoUrl } from './orchestrator'

describe('readVideoUrl orchestrator', () => {
  beforeEach(() => {
    clearVideoUrlCache()
  })

  it('returns SSRF blocked for localhost', async () => {
    const r = await readVideoUrl({ url: 'http://127.0.0.1/x' })
    expect(r.errorCode).toBe('SSRF_BLOCKED')
  })

  it('returns unsupported for random hosts', async () => {
    const r = await readVideoUrl({ url: 'https://example.com/v' })
    expect(r.errorCode).toBe('UNSUPPORTED_URL')
  })

  it('returns YouTube captions via native adapter', async () => {
    const r = await readVideoUrl({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })
    expect(r.platform).toBe('youtube')
    expect(r.transcript?.text).toContain('Hello from captions')
    expect(r.errorCode).toBeUndefined()
  })

  it('surfaces PROVIDER_REQUIRED for TikTok without BYOK', async () => {
    const r = await readVideoUrl({
      url: 'https://www.tiktok.com/@user/video/7123456789012345678',
    })
    expect(r.platform).toBe('tiktok')
    expect(r.errorCode).toBe('PROVIDER_REQUIRED')
  })

  it('metadata mode skips requiring transcript', async () => {
    const r = await readVideoUrl({
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      mode: 'metadata',
    })
    expect(r.title).toBe('Test Video')
  })
})
