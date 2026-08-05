import { describe, expect, it, vi } from 'vitest'
import { fetchXaiModels, mergeXaiModels } from './xai-models'
import { XAI_API_BASE, XaiOAuthError } from './xai-oauth'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('fetchXaiModels', () => {
  it('maps /v1/models into ProviderModelInfo list', async () => {
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe(`${XAI_API_BASE}/models`)
      expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer tok')
      return jsonResponse({
        data: [
          { id: 'grok-4-1-fast-reasoning' },
          { id: 'grok-build-0.1' },
          { id: 'grok-imagine-image' },
          { id: '' },
          { id: 'grok-build-0.1' }, // duplicate
        ],
      })
    })

    const models = await fetchXaiModels('tok', { fetchImpl: fetchImpl as unknown as typeof fetch })
    expect(models.map((m) => m.modelId)).toEqual([
      'grok-build-0.1',
      'grok-4-1-fast-reasoning',
      'grok-imagine-image',
    ])
    expect(models.find((m) => m.modelId === 'grok-4-1-fast-reasoning')?.capabilities).toContain('reasoning')
  })

  it('throws on empty bearer', async () => {
    await expect(fetchXaiModels('')).rejects.toBeInstanceOf(XaiOAuthError)
  })
})

describe('mergeXaiModels', () => {
  it('replaceAll keeps local nicknames', () => {
    const merged = mergeXaiModels(
      [{ modelId: 'a', nickname: 'Alpha' }],
      [
        { modelId: 'a', type: 'chat' },
        { modelId: 'b', type: 'chat' },
      ],
      { replaceAll: true }
    )
    expect(merged).toEqual([
      { modelId: 'a', type: 'chat', nickname: 'Alpha' },
      { modelId: 'b', type: 'chat' },
    ])
  })

  it('non-replace keeps local-only models and adds remote', () => {
    const merged = mergeXaiModels(
      [{ modelId: 'local-only' }, { modelId: 'shared', nickname: 'S' }],
      [{ modelId: 'shared' }, { modelId: 'remote-only' }]
    )
    expect(merged.map((m) => m.modelId)).toEqual(['local-only', 'shared', 'remote-only'])
    expect(merged.find((m) => m.modelId === 'shared')?.nickname).toBe('S')
  })
})
