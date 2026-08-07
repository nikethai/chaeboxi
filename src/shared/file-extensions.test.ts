import { describe, expect, it } from 'vitest'
import {
  getFileAcceptConfig,
  getFileAcceptString,
  getUnsupportedFileI18nKey,
  isAiReadableImageFile,
  isAiReadableVideoFile,
  isSupportedFile,
} from './file-extensions'

describe('file-extensions AI-readable policy', () => {
  it('accepts common vision images', () => {
    expect(isAiReadableImageFile({ name: 'a.png', type: 'image/png' })).toBe(true)
    expect(isAiReadableImageFile({ name: 'b.webp', type: 'image/webp' })).toBe(true)
    expect(isAiReadableImageFile({ name: 'c.gif', type: 'image/gif' })).toBe(true)
    expect(isAiReadableImageFile({ name: 'd.jpg', type: 'image/jpeg' })).toBe(true)
  })

  it('rejects advanced image formats', () => {
    expect(isAiReadableImageFile({ name: 'x.heic', type: 'image/heic' })).toBe(false)
    expect(isAiReadableImageFile({ name: 'y.psd', type: 'image/vnd.adobe.photoshop' })).toBe(false)
  })

  it('accepts mp4/webm videos and rejects other containers', () => {
    expect(isAiReadableVideoFile({ name: 'clip.mp4', type: 'video/mp4' })).toBe(true)
    expect(isAiReadableVideoFile({ name: 'clip.webm', type: 'video/webm' })).toBe(true)
    expect(isAiReadableVideoFile({ name: 'clip.mkv', type: 'video/x-matroska' })).toBe(false)
    expect(isAiReadableVideoFile({ name: 'clip.avi', type: 'video/x-msvideo' })).toBe(false)
  })

  it('classifies documents as supported; unsupported video still has toast key', () => {
    expect(isSupportedFile('notes.md')).toBe(true)
    expect(isSupportedFile('report.pdf')).toBe(true)
    // Document lane still false for video; video uses dedicated lane
    expect(isSupportedFile('clip.mp4')).toBe(false)
    expect(getUnsupportedFileI18nKey('clip.mkv')).toContain('MP4 or WebM')
    expect(getUnsupportedFileI18nKey('song.mp3')).toBe('Audio files are not supported')
    expect(getUnsupportedFileI18nKey('bundle.zip')).toContain('Archive files')
  })

  it('includes images and videos in accept string and dropzone config', () => {
    const accept = getFileAcceptString()
    expect(accept).toContain('.png')
    expect(accept).toContain('.webp')
    expect(accept).toContain('.pdf')
    expect(accept).toContain('.mp4')
    expect(accept).toContain('.webm')

    const config = getFileAcceptConfig()
    expect(config['image/png']).toContain('.png')
    expect(config['image/webp']).toContain('.webp')
    expect(config['application/pdf']).toContain('.pdf')
    expect(config['video/mp4']).toContain('.mp4')
    expect(config['video/webm']).toContain('.webm')
  })
})
