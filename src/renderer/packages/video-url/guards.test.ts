import { describe, expect, it } from 'vitest'
import { assertSafeHttpUrl, guardVideoUrl } from './guards'

describe('guardVideoUrl', () => {
  it('allows public YouTube https', () => {
    const r = guardVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.parsed.platform).toBe('youtube')
  })

  it('blocks localhost', () => {
    const r = guardVideoUrl('http://localhost:8080/video')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errorCode).toBe('SSRF_BLOCKED')
  })

  it('blocks private IPv4', () => {
    expect(guardVideoUrl('http://192.168.1.1/v').ok).toBe(false)
    expect(guardVideoUrl('http://10.0.0.5/v').ok).toBe(false)
    expect(guardVideoUrl('http://127.0.0.1/v').ok).toBe(false)
  })

  it('rejects unsupported platforms', () => {
    const r = guardVideoUrl('https://example.com/watch')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errorCode).toBe('UNSUPPORTED_URL')
  })

  it('rejects empty', () => {
    const r = guardVideoUrl('  ')
    expect(r.ok).toBe(false)
  })

  it('assertSafeHttpUrl blocks private endpoints for secondary fetches', () => {
    expect(assertSafeHttpUrl('http://127.0.0.1:9/captions').ok).toBe(false)
    expect(assertSafeHttpUrl('https://www.youtube.com/api/timedtext?v=1').ok).toBe(true)
  })
})
