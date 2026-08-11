import { describe, expect, it } from 'vitest'
import { assertBrowserUrl, workspaceBrowserDownloadsDir } from './url-policy'

describe('assertBrowserUrl', () => {
  it('allows http and https', () => {
    expect(assertBrowserUrl('https://example.com/path').ok).toBe(true)
    expect(assertBrowserUrl('http://example.com').ok).toBe(true)
  })

  it('blocks file and other schemes', () => {
    const r = assertBrowserUrl('file:///etc/passwd')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('SECURITY_BLOCKED')
  })

  it('enforces allowlist when non-empty', () => {
    const ok = assertBrowserUrl('https://docs.example.com/x', ['example.com'])
    expect(ok.ok).toBe(true)
    const bad = assertBrowserUrl('https://evil.com', ['example.com'])
    expect(bad.ok).toBe(false)
  })

  it('empty allowlist means no host filter', () => {
    expect(assertBrowserUrl('https://anywhere.test', []).ok).toBe(true)
  })
})

describe('workspaceBrowserDownloadsDir', () => {
  it('returns null without workspace', () => {
    expect(workspaceBrowserDownloadsDir(undefined)).toBeNull()
    expect(workspaceBrowserDownloadsDir('')).toBeNull()
  })

  it('joins under workspace', () => {
    expect(workspaceBrowserDownloadsDir('/Users/me/proj')).toBe(
      '/Users/me/proj/.chaeboxi-browser-downloads'
    )
  })
})
