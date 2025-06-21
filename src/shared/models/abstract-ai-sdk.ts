import {
  APICallError,
  CoreMessage,
  CoreSystemMessage,
  EmbeddingModel,
  experimental_generateImage as generateImage,
  ImageModel,
  LanguageModelV1,
  Provider,
  streamText,
  ToolSet,
} from 'ai'
import {
  MessageContentParts,
  MessageTextPart,
  MessageToolCallPart,
  ProviderModelInfo,
  StreamTextResult,
} from '../types'
import { ModelDependencies } from '../types/adapters'
import { ApiError, ChatboxAIAPIError } from './errors'
import { CallChatCompletionOptions, ModelInterface } from './types'

// ai sdk CallSettings类型的子集
export interface CallSettings {
  temperature?: number
  topP?: number
  providerOptions?: CoreSystemMessage['providerOptions']
}

export default abstract class AbstractAISDKModel implements ModelInterface {
  public name = 'AI SDK Model'
  public injectDefaultMetadata = true
  public modelId = ''

  public isSupportToolUse() {
    return this.options.model.capabilities?.includes('tool_use') || false
  }
  public isSupportVision() {
    return this.options.model.capabilities?.includes('vision') || false
  }
  public isSupportReasoning() {
    return this.options.model.capabilities?.includes('reasoning') || false
  }

  static isSupportTextEmbedding() {
    return false
  }

  public constructor(public options: { model: ProviderModelInfo }, protected dependencies: ModelDependencies) {
    this.modelId = options.model.modelId
  }

  protected abstract getProvider(
    options: CallChatCompletionOptions
  ): Pick<Provider, 'languageModel'> & Partial<Pick<Provider, 'textEmbeddingModel' | 'imageModel'>>

  protected abstract getChatModel(options: CallChatCompletionOptions): LanguageModelV1

  protected getImageModel(): ImageModel | null {
    return null
  }

  protected getTextEmbeddingModel(options: CallChatCompletionOptions): EmbeddingModel<string> | null {
    const provider = this.getProvider(options)
    if (provider.textEmbeddingModel) {
      return provider.textEmbeddingModel(this.options.model.modelId)
    }
    return null
  }

  public isSupportSystemMessage() {
    return true
  }

  protected getCallSettings(options: CallChatCompletionOptions): CallSettings {
    return {}
  }

  public async chat(messages: CoreMessage[], options: CallChatCompletionOptions): Promise<StreamTextResult> {
    try {
      return await this._callChatCompletion(messages, options)
    } catch (e) {
      if (e instanceof ChatboxAIAPIError) {
        throw e
      }
      // 如果当前模型不支持图片输入，抛出对应的错误
      if (
        e instanceof ApiError &&
        e.message.includes('Invalid content type. image_url is only supported by certain models.')
      ) {
        // 根据当前 IP，判断是否在错误中推荐 Chatbox AI 4
        const remoteConfig = this.dependencies.getRemoteConfig()
        if (remoteConfig.setting_chatboxai_first) {
          throw ChatboxAIAPIError.fromCodeName('model_not_support_image', 'model_not_support_image')
        } else {
          throw ChatboxAIAPIError.fromCodeName('model_not_support_image', 'model_not_support_image_2')
        }
      }

      // 添加请求信息到 Sentry
      this.dependencies.sentry.withScope((scope) => {
        scope.setTag('provider_name', this.name)
        scope.setExtra('messages', JSON.stringify(messages))
        scope.setExtra('options', JSON.stringify(options))
        this.dependencies.sentry.captureException(e)
      })
      throw e
    }
  }

  public async paint(
    prompt: string,
    num: number,
    callback?: (picBase64: string) => any,
    signal?: AbortSignal
  ): Promise<string[]> {
    const imageModel = this.getImageModel()
    if (!imageModel) {
      throw new ApiError('Provider doesnt support image generation')
    }
    const result = await generateImage({
      model: imageModel,
      prompt,
      n: num,
      abortSignal: signal,
    })
    const dataUrls = result.images.map((image) => `data:${image.mimeType};base64,${image.base64}`)
    for (const dataUrl of dataUrls) {
      callback?.(dataUrl)
    }
    return dataUrls
  }

  private async _callChatCompletion<T extends ToolSet>(
    coreMessages: CoreMessage[],
    options: CallChatCompletionOptions<T>
  ): Promise<StreamTextResult> {
    const model = this.getChatModel(options)

    const callSettings = this.getCallSettings(options)

    const result = streamText({
      model,
      messages: coreMessages,
      maxSteps: Number.MAX_SAFE_INTEGER,
      tools: options.tools,
      abortSignal: options.signal,
      ...callSettings,
    })

    let contentParts: MessageContentParts = []
    let currentTextPart: MessageTextPart | undefined = undefined
    let reasoningContent = ''

    for await (const chunk of result.fullStream) {
      console.debug('stream chunk', chunk)
      if (chunk.type === 'text-delta') {
        if (!currentTextPart) {
          currentTextPart = { type: 'text', text: '' }
          contentParts.push(currentTextPart)
        }
        currentTextPart.text += chunk.textDelta
      } else if (chunk.type === 'reasoning') {
        reasoningContent += chunk.textDelta
      } else if (chunk.type === 'tool-call') {
        currentTextPart = undefined
        contentParts.push({
          type: 'tool-call',
          state: 'call',
          toolCallId: chunk.toolCallId,
          toolName: chunk.toolName,
          args: chunk.args,
        })
      } else if (chunk.type === 'tool-result') {
        const part = contentParts.find((p) => p.type === 'tool-call' && p.toolCallId === chunk.toolCallId) as
          | MessageToolCallPart
          | undefined
        if (part) {
          if ((chunk.result as unknown) instanceof Error) {
            console.debug('mcp tool execute error', chunk.result)
            part.state = 'error'
            part.result = JSON.parse(JSON.stringify(chunk.result))
          } else {
            part.state = 'result'
            part.result = chunk.result
          }
        }
      } else if (chunk.type === 'file' && chunk.mimeType.startsWith('image/')) {
        currentTextPart = undefined
        const storageKey = await this.dependencies.storage.saveImage(
          'response',
          `data:${chunk.mimeType};base64,${chunk.base64}`
        )
        contentParts.push({ type: 'image', storageKey })
      } else if (chunk.type === 'error') {
        const error = chunk.error
        if (APICallError.isInstance(error)) {
          throw new ApiError(`Error from ${this.name}`, error.responseBody)
        }
        if (error instanceof ChatboxAIAPIError) {
          throw error
        }
        throw new ApiError(`Error from ${this.name}: ${chunk.error}`)
      } else {
        continue
      }
      options.onResultChange?.({ reasoningContent, contentParts })
    }

    const usage = await result.usage
    options.onResultChange?.({
      contentParts,
      reasoningContent,
      tokenCount: usage?.completionTokens,
      tokensUsed: usage?.totalTokens,
    })

    return { contentParts, reasoningContent, usage }
  }
}
