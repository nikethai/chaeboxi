import { SystemProviders } from '../defaults'
import { type Config, type ModelProvider, ModelProviderEnum, type Settings } from '../types'
import type { ModelDependencies } from '../types/adapters'
import AzureOpenAI from './azure'
import ChatboxAI from './chatboxai'
import ChatGLM from './chatglm'
import Claude from './claude'
import CustomOpenAI from './custom-openai'
import DeepSeek from './deepseek'
import Gemini from './gemini'
import Groq from './groq'
import LMStudio from './lmstudio'
import Ollama from './ollama'
import OpenAI from './openai'
import Perplexity from './perplexity'
import SiliconFlow from './siliconflow'
import type { ModelInterface } from './types'
import XAI from './xai'

export function getProviderSettings(setting: Settings) {
  console.debug('getModel', setting.provider, setting.modelId)
  const provider = setting.provider
  if (!provider) {
    throw new Error('Model provider must not be empty.')
  }
  const providerBaseInfo = [...SystemProviders, ...(setting.customProviders || [])].find((p) => p.id === provider)
  if (!providerBaseInfo) {
    throw new Error(`Cannot find model with provider: ${setting.provider}`)
  }
  const providerSetting = setting.providers?.[setting.provider!] || {}
  const formattedApiHost = (providerSetting.apiHost || providerBaseInfo.defaultSettings?.apiHost || '').trim()
  return {
    providerSetting,
    formattedApiHost,
    providerBaseInfo,
  }
}

export function getModel(setting: Settings, config: Config, dependencies: ModelDependencies): ModelInterface {
  console.debug('getModel', setting.provider, setting.modelId)
  const provider = setting.provider
  if (!provider) {
    throw new Error('Model provider must not be empty.')
  }
  const { providerSetting, formattedApiHost, providerBaseInfo } = getProviderSettings(setting)

  let model = providerSetting.models?.find((m) => m.modelId === setting.modelId)
  if (!model) {
    model = SystemProviders.find((p) => p.id === provider)?.defaultSettings?.models?.find(
      (m) => m.modelId === setting.modelId
    )
  }
  if (!model) {
    // 如果没有找到对应的 model 配置，直接使用传入的 modelId，这种情况通常发生在用户本地列表中删除了某个 model，但是某个 session 中还在使用，或是检查连接的时候，使用了 defaults 中的 modelId，
    model = {
      modelId: setting.modelId!,
    }
  }

  switch (provider) {
    case ModelProviderEnum.ChatboxAI:
      return new ChatboxAI(
        {
          licenseKey: setting.licenseKey,
          model,
          licenseInstances: setting.licenseInstances,
          licenseDetail: setting.licenseDetail,
          language: setting.language,
          dalleStyle: setting.dalleStyle || 'vivid',
          temperature: setting.temperature!,
        },
        config,
        dependencies
      )
    case ModelProviderEnum.OpenAI:
      return new OpenAI(
        {
          apiKey: providerSetting.apiKey || '',
          apiHost: formattedApiHost,
          model: model,
          dalleStyle: setting.dalleStyle || 'vivid',
          temperature: setting.temperature!,
          topP: setting.topP,
          injectDefaultMetadata: setting.injectDefaultMetadata,
          useProxy: false, // 之前的openaiUseProxy已经没有在使用，直接写死false
        },
        dependencies
      )

    case ModelProviderEnum.Azure:
      return new AzureOpenAI(
        {
          azureEndpoint: providerSetting.endpoint || providerBaseInfo.defaultSettings?.endpoint || '',
          model,
          azureDalleDeploymentName: providerSetting.dalleDeploymentName || '',
          azureApikey: providerSetting.apiKey || '',
          azureApiVersion: providerSetting.apiVersion || providerBaseInfo.defaultSettings?.apiVersion || '',
          temperature: setting.temperature!,
          topP: setting.topP || 0,
          dalleStyle: setting.dalleStyle || 'vivid',
          imageGenerateNum: setting.imageGenerateNum || 1,
          injectDefaultMetadata: setting.injectDefaultMetadata,
        },
        dependencies
      )

    case ModelProviderEnum.ChatGLM6B:
      return new ChatGLM(
        {
          chatglmApiKey: providerSetting.apiKey || '',
          model,
        },
        dependencies
      )

    case ModelProviderEnum.Claude:
      return new Claude(
        {
          claudeApiKey: providerSetting.apiKey || '',
          claudeApiHost: formattedApiHost,
          model,
        },
        dependencies
      )

    case ModelProviderEnum.Gemini:
      return new Gemini(
        {
          geminiAPIKey: providerSetting.apiKey || '',
          geminiAPIHost: formattedApiHost,
          model,
          temperature: setting.temperature!,
        },
        dependencies
      )

    case ModelProviderEnum.Ollama:
      return new Ollama(
        {
          ollamaHost: formattedApiHost,
          model,
          temperature: setting.temperature!,
        },
        dependencies
      )

    case ModelProviderEnum.Groq:
      return new Groq(
        {
          groqAPIKey: providerSetting.apiKey || '',
          model,
          temperature: setting.temperature!,
        },
        dependencies
      )

    case ModelProviderEnum.DeepSeek:
      return new DeepSeek(
        {
          deepseekAPIKey: providerSetting.apiKey || '',
          model,
          temperature: setting.temperature,
          topP: setting.topP,
        },
        dependencies
      )

    case ModelProviderEnum.SiliconFlow:
      return new SiliconFlow(
        {
          siliconCloudKey: providerSetting.apiKey || '',
          model,
          temperature: setting.temperature,
          topP: setting.topP,
        },
        dependencies
      )

    case ModelProviderEnum.LMStudio:
      return new LMStudio(
        {
          lmStudioHost: formattedApiHost,
          model,
          temperature: setting.temperature,
          topP: setting.topP,
        },
        dependencies
      )

    case ModelProviderEnum.Perplexity:
      return new Perplexity(
        {
          perplexityApiKey: providerSetting.apiKey || '',
          model,
          temperature: setting.temperature,
          topP: setting.topP,
        },
        dependencies
      )

    case ModelProviderEnum.XAI:
      return new XAI(
        {
          xAIKey: providerSetting.apiKey || '',
          model,
          temperature: setting.temperature,
          topP: setting.topP,
        },
        dependencies
      )
    default:
      if (providerBaseInfo.isCustom) {
        return new CustomOpenAI(
          {
            apiKey: providerSetting.apiKey || '',
            apiHost: formattedApiHost,
            apiPath: providerSetting.apiPath || '',
            model,
            temperature: setting.temperature,
            topP: setting.topP,
            useProxy: providerSetting.useProxy,
          },
          dependencies
        )
      } else {
        throw new Error(`Cannot find model with provider: ${setting.provider}`)
      }
  }
}

export const aiProviderNameHash: Record<ModelProvider, string> = {
  [ModelProviderEnum.OpenAI]: 'OpenAI API',
  [ModelProviderEnum.Azure]: 'Azure OpenAI API',
  [ModelProviderEnum.ChatGLM6B]: 'ChatGLM API',
  [ModelProviderEnum.ChatboxAI]: 'Chatbox AI',
  [ModelProviderEnum.Claude]: 'Claude API',
  [ModelProviderEnum.Gemini]: 'Google Gemini API',
  [ModelProviderEnum.Ollama]: 'Ollama API',
  [ModelProviderEnum.Groq]: 'Groq API',
  [ModelProviderEnum.DeepSeek]: 'DeepSeek API',
  [ModelProviderEnum.SiliconFlow]: 'SiliconFlow API',
  [ModelProviderEnum.VolcEngine]: 'VolcEngine API',
  [ModelProviderEnum.LMStudio]: 'LM Studio API',
  [ModelProviderEnum.Perplexity]: 'Perplexity API',
  [ModelProviderEnum.XAI]: 'xAI API',
  [ModelProviderEnum.Custom]: 'Custom Provider',
}

export const AIModelProviderMenuOptionList = [
  {
    value: ModelProviderEnum.ChatboxAI,
    label: aiProviderNameHash[ModelProviderEnum.ChatboxAI],
    featured: true,
    disabled: false,
  },
  {
    value: ModelProviderEnum.OpenAI,
    label: aiProviderNameHash[ModelProviderEnum.OpenAI],
    disabled: false,
  },
  {
    value: ModelProviderEnum.Claude,
    label: aiProviderNameHash[ModelProviderEnum.Claude],
    disabled: false,
  },
  {
    value: ModelProviderEnum.Gemini,
    label: aiProviderNameHash[ModelProviderEnum.Gemini],
    disabled: false,
  },
  {
    value: ModelProviderEnum.Ollama,
    label: aiProviderNameHash[ModelProviderEnum.Ollama],
    disabled: false,
  },
  {
    value: ModelProviderEnum.LMStudio,
    label: aiProviderNameHash[ModelProviderEnum.LMStudio],
    disabled: false,
  },
  {
    value: ModelProviderEnum.DeepSeek,
    label: aiProviderNameHash[ModelProviderEnum.DeepSeek],
    disabled: false,
  },
  {
    value: ModelProviderEnum.SiliconFlow,
    label: aiProviderNameHash[ModelProviderEnum.SiliconFlow],
    disabled: false,
  },
  {
    value: ModelProviderEnum.Azure,
    label: aiProviderNameHash[ModelProviderEnum.Azure],
    disabled: false,
  },
  {
    value: ModelProviderEnum.XAI,
    label: aiProviderNameHash[ModelProviderEnum.XAI],
    disabled: false,
  },
  {
    value: ModelProviderEnum.Perplexity,
    label: aiProviderNameHash[ModelProviderEnum.Perplexity],
    disabled: false,
  },
  {
    value: ModelProviderEnum.Groq,
    label: aiProviderNameHash[ModelProviderEnum.Groq],
    disabled: false,
  },
  {
    value: ModelProviderEnum.ChatGLM6B,
    label: aiProviderNameHash[ModelProviderEnum.ChatGLM6B],
    disabled: false,
  },
  // {
  //     value: 'hunyuan',
  //     label: '腾讯混元',
  //     disabled: true,
  // },
]

function keepRange(num: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, num))
}
