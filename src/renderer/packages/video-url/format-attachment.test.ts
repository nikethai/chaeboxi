import { describe, expect, it } from 'vitest'
import { formatVideoUrlAttachmentContent, videoUrlAttachmentTitle } from './format-attachment'

describe('formatVideoUrlAttachmentContent', () => {
  it('includes transcript when present', () => {
    const text = formatVideoUrlAttachmentContent({
      platform: 'youtube',
      url: 'https://www.youtube.com/watch?v=abc',
      title: 'Hello',
      author: 'Chan',
      warnings: [],
      partial: false,
      transcript: { source: 'captions', language: 'en', text: 'hello world' },
    })
    expect(text).toContain('Platform: youtube')
    expect(text).toContain('Title: Hello')
    expect(text).toContain('hello world')
    expect(text).toContain('Transcript')
  })

  it('soft-fails without transcript (still usable attachment)', () => {
    const text = formatVideoUrlAttachmentContent({
      platform: 'tiktok',
      url: 'https://www.tiktok.com/@u/video/1',
      warnings: ['need provider'],
      partial: true,
      transcript: null,
      errorCode: 'PROVIDER_REQUIRED',
      errorMessage: 'Configure provider',
    })
    expect(text).toContain('read_video_url')
    expect(text).toContain('Configure provider')
    expect(text).not.toContain('error:')
  })
})

describe('videoUrlAttachmentTitle', () => {
  it('prefers result title', () => {
    expect(
      videoUrlAttachmentTitle(
        {
          platform: 'youtube',
          url: 'https://www.youtube.com/watch?v=x',
          title: 'My Video',
          warnings: [],
          partial: false,
        },
        'https://www.youtube.com/watch?v=x'
      )
    ).toBe('My Video')
  })
})
