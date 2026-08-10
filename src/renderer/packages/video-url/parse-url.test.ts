import { describe, expect, it } from 'vitest'
import { detectPlatform, isSupportedVideoUrl, parseVideoUrl } from './parse-url'

describe('parseVideoUrl', () => {
  it('parses YouTube watch URLs', () => {
    const p = parseVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    expect(p?.platform).toBe('youtube')
    expect(p?.videoId).toBe('dQw4w9WgXcQ')
    expect(p?.canonicalUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
  })

  it('parses youtu.be short links', () => {
    const p = parseVideoUrl('https://youtu.be/dQw4w9WgXcQ')
    expect(p?.platform).toBe('youtube')
    expect(p?.videoId).toBe('dQw4w9WgXcQ')
  })

  it('parses YouTube shorts', () => {
    const p = parseVideoUrl('https://www.youtube.com/shorts/abc123XYZ')
    expect(p?.videoId).toBe('abc123XYZ')
  })

  it('parses Vimeo numeric ids', () => {
    const p = parseVideoUrl('https://vimeo.com/123456789')
    expect(p?.platform).toBe('vimeo')
    expect(p?.videoId).toBe('123456789')
  })

  it('parses TikTok video paths', () => {
    const p = parseVideoUrl('https://www.tiktok.com/@user/video/7123456789012345678')
    expect(p?.platform).toBe('tiktok')
    expect(p?.videoId).toBe('7123456789012345678')
  })

  it('parses Facebook watch and fb.watch', () => {
    expect(parseVideoUrl('https://www.facebook.com/watch/?v=123456')?.platform).toBe('facebook')
    expect(parseVideoUrl('https://fb.watch/abc')?.platform).toBe('facebook')
    expect(parseVideoUrl('https://www.facebook.com/reel/987654321')?.videoId).toBe('987654321')
    expect(parseVideoUrl('https://www.facebook.com/share/r/141165470744/')?.videoId).toBe('141165470744')
  })

  it('rejects unsupported hosts', () => {
    expect(parseVideoUrl('https://example.com/video/1')).toBeNull()
    expect(isSupportedVideoUrl('https://instagram.com/p/x')).toBe(false)
  })

  it('detectPlatform covers hosts', () => {
    expect(detectPlatform('m.youtube.com')).toBe('youtube')
    expect(detectPlatform('player.vimeo.com')).toBe('vimeo')
    expect(detectPlatform('vm.tiktok.com')).toBe('tiktok')
    expect(detectPlatform('m.facebook.com')).toBe('facebook')
  })
})
