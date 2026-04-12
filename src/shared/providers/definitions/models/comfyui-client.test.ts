import { describe, expect, it } from 'vitest'
import { normalizeComfyUIBaseUrl } from './comfyui-client'

describe('normalizeComfyUIBaseUrl', () => {
  it('adds http when the protocol is missing', () => {
    expect(normalizeComfyUIBaseUrl('127.0.0.1:8188')).toBe('http://127.0.0.1:8188')
  })

  it('strips surrounding quotes and endpoint suffixes users often paste', () => {
    expect(normalizeComfyUIBaseUrl('`http://127.0.0.1:8188/api/prompt`')).toBe('http://127.0.0.1:8188')
  })

  it('preserves reverse-proxy path prefixes', () => {
    expect(normalizeComfyUIBaseUrl('https://example.com/comfy')).toBe('https://example.com/comfy')
  })

  it('throws a clear error for invalid URLs', () => {
    expect(() => normalizeComfyUIBaseUrl('http://127.0.0.1:8188 bad')).toThrow(
      'Invalid ComfyUI server URL',
    )
  })
})
