import { ModelProviderEnum, ModelProviderType } from '../../types'
import { defineProvider } from '../registry'
import ComfyUI from './models/comfyui'
import { DEFAULT_NEGATIVE_PROMPT } from './models/comfyui-workflow'

export const COMFYUI_AGENT_DEFAULT_RESEARCH_DOMAINS = ['danbooru.donmai.us', 'pixiv.net']

export const COMFYUI_AGENT_DEFAULT_NORMALIZATION_PROMPT =
  'Output only a Danbooru-style comma-separated tag list. Remove character names, franchise names, artist names, copyrighted identifiers, exact hair descriptions, and body or bust size traits. Keep only reusable visual tags such as composition, camera angle, clothing archetypes, materials, lighting, mood, setting, pose family, rendering style, and quality tags. Do not output prose, bullets, explanations, or headings.'

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
    comfyuiLoras: [],
    comfyuiLora: 'none',
    comfyuiLoraStrength: 1,
    comfyuiNegativePrompt: DEFAULT_NEGATIVE_PROMPT,
    comfyuiDefaultSteps: 29,
    comfyuiDefaultCfg: 4.9,
    comfyuiDefaultSampler: 'euler_ancestral',
    comfyuiDefaultScheduler: 'simple',
    agentImageFlowEnabled: false,
    agentImageResearchDomains: COMFYUI_AGENT_DEFAULT_RESEARCH_DOMAINS,
    agentImageNormalizationPrompt: COMFYUI_AGENT_DEFAULT_NORMALIZATION_PROMPT,
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
    const shortName =
      checkpoint
        .replace(/\.(safetensors|ckpt)$/i, '')
        .split('/')
        .pop() || 'ComfyUI'
    return `ComfyUI (${shortName})`
  },
})
