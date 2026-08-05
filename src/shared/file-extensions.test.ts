import { describe, expect, it } from 'vitest'
import {
  getFileAcceptConfig,
  getFileAcceptString,
  getUnsupportedFileI18nKey,
  isAiReadableImageFile,
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

  it('classifies documents as supported, video as unsupported toast key', () => {
    expect(isSupportedFile('notes.md')).toBe(true)
    expect(isSupportedFile('report.pdf')).toBe(true)
    expect(isSupportedFile('clip.mp4')).toBe(false)
    expect(getUnsupportedFileI18nKey('clip.mp4')).toBe('Video files are not supported')
    expect(getUnsupportedFileI18nKey('song.mp3')).toBe('Audio files are not supported')
    expect(getUnsupportedFileI18nKey('bundle.zip')).toContain('Archive files')
  })

  it('includes images in accept string and dropzone config', () => {
    const accept = getFileAcceptString()
    expect(accept).toContain('.png')
    expect(accept).toContain('.webp')
    expect(accept).toContain('.pdf')

    const config = getFileAcceptConfig()
    expect(config['image/png']).toContain('.png')
    expect(config['image/webp']).toContain('.webp')
    expect(config['application/pdf']).toContain('.pdf')
    expect(config['video/mp4']).toBeUndefined()
  })
})
