import { ModelProviderEnum, ModelProviderType } from '../../types'
import { defineProvider } from '../registry'
import { DEFAULT_NEGATIVE_PROMPT } from './models/comfyui-workflow'
import ComfyUI from './models/comfyui'

export const comfyuiProvider = defineProvider({
  id: ModelProviderEnum.ComfyUI,
  name: 'ComfyUI',
  type: ModelProviderType.ComfyUI,
  urls: {
    website: 'https://github.com/comfyanonymous/ComfyUI',
    docs: 'https://docs.comfy.org/',
  },
  defaultSettings: {
    apiHost: 'http://127.0.0.1:8188',
    models: [
      {
        modelId: 'comfyui-txt2img',
        nickname: 'txt2img',
      },
    ],
    comfyuiCheckpoint: '',
    comfyuiLora: 'none',
    comfyuiLoraStrength: 1,
    comfyuiNegativePrompt: DEFAULT_NEGATIVE_PROMPT,
    comfyuiDefaultSteps: 29,
    comfyuiDefaultCfg: 4.9,
    comfyuiDefaultSampler: 'euler_ancestral',
    comfyuiDefaultScheduler: 'simple',
  },
  createModel: (config) => {
    return new ComfyUI({
      apiHost: config.formattedApiHost || config.providerSetting.apiHost || 'http://127.0.0.1:8188',
      model: config.model,
      providerSettings: config.providerSetting,
    })
  },
  getDisplayName: (_modelId, providerSettings) => {
    const checkpoint = providerSettings?.comfyuiCheckpoint || 'ComfyUI'
    // Show a friendly shortened checkpoint name
    const shortName = checkpoint
      .replace(/\.(safetensors|ckpt)$/i, '')
      .split('/')
      .pop() || 'ComfyUI'
    return `ComfyUI (${shortName})`
  },
})
