import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchTextMock = vi.fn()
const fetchJsonMock = vi.fn()

vi.mock('../http', () => ({
  fetchText: (...args: unknown[]) => fetchTextMock(...args),
  fetchJson: (...args: unknown[]) => fetchJsonMock(...args),
}))

import { fetchYouTubeVideo } from './youtube'

describe('fetchYouTubeVideo', () => {
  beforeEach(() => {
    fetchTextMock.mockReset()
    fetchJsonMock.mockReset()
  })

  it('loads metadata + captions via Innertube ANDROID player', async () => {
    const player = {
      videoDetails: {
        title: 'Fixture Title',
        author: 'Fixture Author',
        shortDescription: 'Desc',
        lengthSeconds: '42',
        thumbnail: { thumbnails: [{ url: 'https://i.ytimg.com/vi/x/default.jpg' }] },
      },
      playabilityStatus: { status: 'OK' },
      captions: {
        playerCaptionsTracklistRenderer: {
          captionTracks: [
            {
              baseUrl: 'https://www.youtube.com/api/timedtext?v=x&lang=en&caps=asr',
              languageCode: 'en',
              kind: 'asr',
              name: { simpleText: 'English (auto-generated)' },
            },
          ],
        },
      },
    }

    fetchJsonMock.mockImplementation(async (url: string) => {
      if (String(url).includes('youtubei/v1/player')) {
        return player
      }
      // json3 captions
      return {
        events: [
          { tStartMs: 0, dDurationMs: 1000, segs: [{ utf8: 'Hello' }] },
          { tStartMs: 1000, dDurationMs: 1000, segs: [{ utf8: ' world' }] },
        ],
      }
    })

    const result = await fetchYouTubeVideo({
      platform: 'youtube',
      url: 'https://www.youtube.com/watch?v=abcdefghijk',
      canonicalUrl: 'https://www.youtube.com/watch?v=abcdefghijk',
      videoId: 'abcdefghijk',
      host: 'youtube.com',
    })

    expect(result.title).toBe('Fixture Title')
    expect(result.author).toBe('Fixture Author')
    expect(result.durationSec).toBe(42)
    expect(result.transcript?.source).toBe('captions')
    expect(result.transcript?.text).toContain('Hello')
    expect(result.transcript?.segments?.length).toBeGreaterThan(0)
    expect(result.errorCode).toBeUndefined()
    expect(result.partial).toBe(false)
  })

  it('fails without video id', async () => {
    const result = await fetchYouTubeVideo({
      platform: 'youtube',
      url: 'https://youtube.com/',
      canonicalUrl: 'https://youtube.com/',
      host: 'youtube.com',
    })
    expect(result.errorCode).toBe('UNSUPPORTED_URL')
  })

  it('returns NO_CAPTIONS when tracks empty after fetch', async () => {
    fetchJsonMock.mockImplementation(async (url: string) => {
      if (String(url).includes('youtubei/v1/player')) {
        return {
          videoDetails: { title: 'No caps', author: 'A', lengthSeconds: '10' },
          playabilityStatus: { status: 'OK' },
          captions: {
            playerCaptionsTracklistRenderer: {
              captionTracks: [
                {
                  baseUrl: 'https://www.youtube.com/api/timedtext?v=x',
                  languageCode: 'en',
                },
              ],
            },
          },
        }
      }
      return { events: [] }
    })
    fetchTextMock.mockResolvedValue('')

    const result = await fetchYouTubeVideo({
      platform: 'youtube',
      url: 'https://www.youtube.com/watch?v=abcdefghijk',
      canonicalUrl: 'https://www.youtube.com/watch?v=abcdefghijk',
      videoId: 'abcdefghijk',
      host: 'youtube.com',
    })
    expect(result.title).toBe('No caps')
    expect(result.errorCode).toBe('NO_CAPTIONS')
    expect(result.transcript).toBeNull()
  })
})
