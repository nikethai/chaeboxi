import { afterEach, describe, expect, it, vi } from 'vitest'
import { ComfyUIClient, normalizeComfyUIBaseUrl } from './comfyui-client'

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
    expect(() => normalizeComfyUIBaseUrl('http://127.0.0.1:8188 bad')).toThrow('Invalid ComfyUI server URL')
  })
})

describe('ComfyUIClient desktop transport', () => {
  const originalWindow = globalThis.window

  afterEach(() => {
    vi.unstubAllGlobals()
    if (originalWindow) {
      vi.stubGlobal('window', originalWindow)
    }
  })

  it('uses desktop IPC when available so Tauri dev and build share the same transport', async () => {
    const invoke = vi.fn().mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'application/json' },
      bodyBase64: btoa(
        JSON.stringify({
          CheckpointLoaderSimple: {
            input: { required: { ckpt_name: [['model-a.safetensors']] } },
            output: [],
            output_name: [],
            name: 'CheckpointLoaderSimple',
            display_name: 'CheckpointLoaderSimple',
            category: 'loaders',
          },
        })
      ),
    })

    vi.stubGlobal('window', {
      desktopAPI: { invoke },
      location: { hostname: 'tauri.localhost' },
    })

    const client = new ComfyUIClient('http://127.0.0.1:8188')
    const objectInfo = await client.getObjectInfo()

    expect(invoke).toHaveBeenCalledWith('http:request', {
      url: 'http://127.0.0.1:8188/api/object_info',
      method: undefined,
      headers: undefined,
      bodyBase64: undefined,
    })
    expect(objectInfo.CheckpointLoaderSimple.input.required?.ckpt_name?.[0]).toEqual(['model-a.safetensors'])
  })

  it('can send an interrupt request through desktop IPC', async () => {
    const invoke = vi.fn().mockResolvedValue({
      status: 200,
      headers: {},
      bodyBase64: undefined,
    })

    vi.stubGlobal('window', {
      desktopAPI: { invoke },
      location: { hostname: 'tauri.localhost' },
    })

    const client = new ComfyUIClient('http://127.0.0.1:8188')
    await client.interrupt()

    expect(invoke).toHaveBeenCalledWith('http:request', {
      url: 'http://127.0.0.1:8188/api/interrupt',
      method: 'POST',
      headers: undefined,
      bodyBase64: undefined,
    })
  })
})
