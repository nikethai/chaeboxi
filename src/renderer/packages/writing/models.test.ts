import { getSystemProviders } from '@shared/providers'
import { ModelProviderEnum, ModelProviderType, type ProviderInfo, type ProviderModelInfo } from '@shared/types'
import { describe, expect, it } from 'vitest'
import { getWritingModelOptions, getWritingModels, isWritingModelAvailable } from './models'

const textModel = { modelId: 'configured-text-model', type: 'chat' as const }
const blockedBuiltins = new Set([ModelProviderEnum.OpenClaw, ModelProviderEnum.ComfyUI])
const customTypes = [
  ModelProviderType.OpenAI,
  ModelProviderType.OpenAIResponses,
  ModelProviderType.Claude,
  ModelProviderType.Gemini,
]

describe('writing model eligibility', () => {
  it.each(getSystemProviders())('$id: considers text models across the entire provider registry', (base) => {
    const provider: ProviderInfo = { ...base, models: [textModel] }
    const expected = !blockedBuiltins.has(base.id)
    expect(isWritingModelAvailable(provider, { provider: base.id, modelId: textModel.modelId })).toBe(expected)
    expect(getWritingModelOptions([provider])).toHaveLength(expected ? 1 : 0)
  })

  it.each(customTypes)('supports configured custom %s models without a model-name allowlist', (type) => {
    const provider: ProviderInfo = { id: `custom-${type}`, name: 'Custom', type, isCustom: true, models: [textModel] }
    expect(getWritingModels(provider)).toEqual([textModel])
    expect(getWritingModelOptions([provider])[0].items[0].value).toBe(
      JSON.stringify({ provider: provider.id, modelId: textModel.modelId })
    )
  })

  it('keeps text, reasoning, and vision-input models but excludes non-text output models', () => {
    const included: ProviderModelInfo[] = [
      { modelId: 'local-writer' },
      { modelId: 'reasoner', capabilities: ['reasoning', 'tool_use'] },
      { modelId: 'vision-reader', capabilities: ['vision'] },
    ]
    const excluded: ProviderModelInfo[] = [
      { modelId: 'vectors', type: 'embedding' },
      { modelId: 'ranking', type: 'rerank' },
      { modelId: 'pixels', capabilities: ['image_generation'] },
      { modelId: 'retouch', capabilities: ['image_edit'] },
      { modelId: 'gemini-3-pro-image-preview', type: 'chat' },
      { modelId: 'gpt-image-1' },
      { modelId: 'whisper-1' },
    ]
    const provider: ProviderInfo = {
      id: ModelProviderEnum.Ollama,
      name: 'Local',
      type: ModelProviderType.OpenAI,
      models: [...included, ...excluded],
    }
    expect(getWritingModels(provider)).toEqual(included)
    for (const model of excluded) {
      expect(isWritingModelAvailable(provider, { provider: provider.id, modelId: model.modelId })).toBe(false)
    }
  })

  it('uses defaults only when there is no configured model list', () => {
    const provider: ProviderInfo = {
      id: ModelProviderEnum.Perplexity,
      name: 'Perplexity',
      type: ModelProviderType.OpenAI,
      defaultSettings: { models: [textModel] },
    }
    expect(getWritingModels(provider)).toEqual([textModel])
    expect(getWritingModels({ ...provider, models: [] })).toEqual([])
    expect(getWritingModels({ ...provider, models: [{ modelId: 'custom-sonar' }] })).toEqual([
      { modelId: 'custom-sonar' },
    ])
    expect(isWritingModelAvailable(provider, { provider: 'other-provider', modelId: textModel.modelId })).toBe(false)
  })
})
