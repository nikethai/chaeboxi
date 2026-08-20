/**
 * Gemini via Antigravity / Cloud Code Assist (subscription / Google OAuth quota).
 *
 * Rewrites @ai-sdk/google Generative Language URLs into cloudcode-pa envelope
 * requests, with endpoint fallbacks (daily → prod) matching OpenCode/CLIProxy.
 */

import { createGoogleGenerativeAI, type GoogleGenerativeAIProviderOptions } from '@ai-sdk/google'
import type { LanguageModelV3 } from '@ai-sdk/provider'
import { generateText } from 'ai'
import AbstractAISDKModel, { type CallSettings } from '../../../models/abstract-ai-sdk'
import { ApiError } from '../../../models/errors'
import type { CallChatCompletionOptions } from '../../../models/types'
import { createFetchWithProxy } from '../../../models/utils/fetch-proxy'
import type { ProviderModelInfo } from '../../../types'
import type { ModelDependencies } from '../../../types/adapters'
import {
  fetchGeminiAntigravityModels,
  GEMINI_ANTIGRAVITY_DEFAULT_MODELS,
  resolveAntigravityChatModelId,
  resolveAntigravityThinkingLevel,
  resolveSessionAntigravityThinkingLevel,
} from '../../oauth/gemini-antigravity-models'
import {
  buildAntigravityRequestHeaders,
  GEMINI_ANTIGRAVITY_API_BASE,
  GEMINI_ANTIGRAVITY_DEFAULT_PROJECT_ID,
  GEMINI_ANTIGRAVITY_ENDPOINT_FALLBACKS,
} from '../../oauth/gemini-antigravity-oauth'

interface Options {
  apiKey: string
  projectId?: string
  model: ProviderModelInfo
  temperature?: number
  topP?: number
  maxOutputTokens?: number
  stream?: boolean
  useProxy?: boolean
}

type FetchFunction = typeof globalThis.fetch

type GeminiAspectRatio = NonNullable<NonNullable<GoogleGenerativeAIProviderOptions['imageConfig']>['aspectRatio']>

/** Studio + Antigravity image-capable model ids / patterns. */
function isGeminiImageModel(modelId: string): boolean {
  const id = modelId.toLowerCase()
  if (
    id.includes('flash-image') ||
    id.includes('pro-image') ||
    id.includes('imagen') ||
    (id.includes('gemini') && id.includes('image'))
  ) {
    return true
  }
  return [
    'gemini-2.5-flash-image',
    'gemini-2.5-flash-image-preview',
    'gemini-3-pro-image-preview',
    'gemini-3-pro-image',
    'gemini-3.1-flash-image-preview',
    'gemini-3.1-flash-image',
  ].includes(modelId)
}

function headersToRecord(headers?: HeadersInit): Record<string, string> {
  const out: Record<string, string> = {}
  if (!headers) return out
  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      out[key] = value
    })
    return out
  }
  if (Array.isArray(headers)) {
    for (const [k, v] of headers) out[k] = v
    return out
  }
  return { ...headers }
}

/**
 * Shape AI SDK body into Antigravity inner `request` object.
 * - Inject Gemini 3 thinkingLevel
 * - Keep contents / tools / systemInstruction
 */
function prepareAntigravityInnerRequest(
  body: Record<string, unknown>,
  chatModelId: string,
  sourceModelId: string,
  sessionThinkingLevel?: ReturnType<typeof resolveSessionAntigravityThinkingLevel>
): Record<string, unknown> {
  const request = { ...body }
  delete request.model

  // Ensure generationConfig exists for thinkingLevel
  const gen =
    request.generationConfig && typeof request.generationConfig === 'object'
      ? { ...(request.generationConfig as Record<string, unknown>) }
      : {}

  // Image generation: do not inject thinkingConfig — breaks responseModalities IMAGE
  const responseModalities = gen.responseModalities
  const isImageGen =
    Array.isArray(responseModalities) && responseModalities.some((m) => String(m).toUpperCase() === 'IMAGE')
  const existingTc =
    gen.thinkingConfig && typeof gen.thinkingConfig === 'object'
      ? { ...(gen.thinkingConfig as Record<string, unknown>) }
      : {}
  const thinkingLevel =
    sessionThinkingLevel ||
    resolveSessionAntigravityThinkingLevel(sourceModelId, {
      google: { thinkingConfig: { thinkingLevel: existingTc.thinkingLevel as string | undefined } },
    }) ||
    resolveAntigravityThinkingLevel(chatModelId)
  if (
    !isImageGen &&
    thinkingLevel &&
    chatModelId.toLowerCase().includes('gemini-3') &&
    !/image|imagen/i.test(chatModelId) &&
    !/image|imagen/i.test(sourceModelId)
  ) {
    // Gemini 3: thinkingLevel preferred over thinkingBudget (OpenCode)
    delete existingTc.thinkingBudget
    gen.thinkingConfig = {
      ...existingTc,
      thinkingLevel,
      includeThoughts: existingTc.includeThoughts !== false,
    }
  }

  if (Object.keys(gen).length > 0) {
    request.generationConfig = gen
  }

  // sessionId helps multi-turn on some gateways
  if (typeof request.sessionId !== 'string') {
    request.sessionId = `chaeboxi-${Date.now()}`
  }

  return request
}

/**
 * Rewrite AI SDK Google Generative Language calls to Cloud Code Assist.
 * Tries daily sandbox first, then autopush, then prod (OpenCode/CLIProxy order).
 */
export function createAntigravityFetch(options: {
  accessToken: string
  projectId: string
  apiBase?: string
  /** Prefer these bases in order; default GEMINI_ANTIGRAVITY_ENDPOINT_FALLBACKS */
  endpointFallbacks?: readonly string[]
  innerFetch?: FetchFunction
  /** Composer/session thinking chip — Google SDK may drop thinkingLevel from the body. */
  thinkingLevel?: ReturnType<typeof resolveSessionAntigravityThinkingLevel>
}): FetchFunction {
  const projectId = options.projectId || GEMINI_ANTIGRAVITY_DEFAULT_PROJECT_ID
  const inner = options.innerFetch || globalThis.fetch.bind(globalThis)
  const bases = (options.endpointFallbacks || GEMINI_ANTIGRAVITY_ENDPOINT_FALLBACKS).map((b) => b.replace(/\/+$/, ''))
  // If caller forced a single apiBase, try it first then fallbacks
  const orderedBases = options.apiBase
    ? [options.apiBase.replace(/\/+$/, ''), ...bases.filter((b) => b !== options.apiBase?.replace(/\/+$/, ''))]
    : bases

  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    const method = (init?.method || 'GET').toUpperCase()

    const isGenerate =
      /:(stream)?[Gg]enerateContent/.test(url) ||
      url.includes('generateContent') ||
      url.includes('streamGenerateContent')

    if (!isGenerate || method === 'GET') {
      return inner(input, init)
    }

    const modelMatch = url.match(/models\/([^/:?]+)/)?.[1] || url.match(/model=([^&]+)/)?.[1] || undefined
    const sourceModelId = modelMatch ? decodeURIComponent(modelMatch) : 'gemini-2.5-flash'
    const chatModelId = resolveAntigravityChatModelId(sourceModelId)
    const wantsStream = /streamGenerateContent|alt=sse|:streamGenerateContent/i.test(url)

    let rawBody: Record<string, unknown> = {}
    if (init?.body) {
      const raw =
        typeof init.body === 'string'
          ? init.body
          : init.body instanceof URLSearchParams
            ? init.body.toString()
            : await new Response(init.body).text()
      try {
        rawBody = JSON.parse(raw) as Record<string, unknown>
      } catch {
        rawBody = {}
      }
    }

    // Already-wrapped envelope from a retry path
    if (typeof rawBody.project === 'string' && rawBody.request && typeof rawBody.request === 'object') {
      rawBody = rawBody.request as Record<string, unknown>
    }

    const innerRequest = prepareAntigravityInnerRequest(
      rawBody,
      chatModelId,
      sourceModelId,
      options.thinkingLevel
    )

    const envelope = {
      project: projectId,
      model: chatModelId,
      request: innerRequest,
      requestType: 'agent',
      userAgent: 'antigravity',
      requestId: `chaeboxi-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    }

    const headerRecord: Record<string, string> = {
      ...headersToRecord(init?.headers),
      ...buildAntigravityRequestHeaders(),
      Authorization: `Bearer ${options.accessToken}`,
      'Content-Type': 'application/json',
      Accept: wantsStream ? 'text/event-stream' : 'application/json',
    }
    // Strip Studio / AI SDK auth headers that confuse Cloud Code Assist
    delete headerRecord['x-goog-api-key']
    delete headerRecord['X-Goog-Api-Key']
    delete headerRecord['x-api-key']
    delete headerRecord['x-goog-user-project']
    delete headerRecord['X-Goog-User-Project']

    let lastRes: Response | undefined
    let lastText = ''

    for (const apiBase of orderedBases) {
      const target = wantsStream
        ? `${apiBase}/v1internal:streamGenerateContent?alt=sse`
        : `${apiBase}/v1internal:generateContent`

      const res = await inner(target, {
        method: 'POST',
        headers: headerRecord,
        body: JSON.stringify(envelope),
        signal: init?.signal,
      })

      lastRes = res

      // Success or non-retryable (auth, rate limit) — stop
      if (res.ok) {
        return await finalizeAntigravityResponse(res, wantsStream)
      }

      // 404 / 403 on this host → try next endpoint (model/host routing differs)
      const text = await res.text().catch(() => '')
      lastText = text
      const retryable = res.status === 404 || res.status === 403 || res.status === 502 || res.status === 503
      if (!retryable) {
        return new Response(text || res.statusText, {
          status: res.status,
          statusText: res.statusText,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      // continue fallbacks
    }

    // Enrich final 404 with model/project so UI is debuggable
    const enriched =
      lastText && lastText.includes('NOT_FOUND')
        ? JSON.stringify({
            error: {
              code: 404,
              status: 'NOT_FOUND',
              message: `Requested entity was not found (model=${chatModelId}, project=${projectId}). Try gemini-3-flash or gemini-2.5-flash, or re-login to refresh project.`,
              details: lastText,
            },
          })
        : lastText || 'Antigravity request failed on all endpoints'

    return new Response(enriched, {
      status: lastRes?.status || 404,
      statusText: lastRes?.statusText || 'Not Found',
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

function emitUnwrappedSseLine(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  line: string
) {
  if (!line.startsWith('data:')) {
    controller.enqueue(encoder.encode(`${line}\n`))
    return
  }
  const payload = line.slice(5).trim()
  if (!payload || payload === '[DONE]') {
    controller.enqueue(encoder.encode(`${line}\n`))
    return
  }
  try {
    const parsed = JSON.parse(payload) as { response?: unknown }
    if (parsed && typeof parsed === 'object' && 'response' in parsed && parsed.response !== undefined) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(parsed.response)}\n`))
      return
    }
  } catch {
    // keep original line when payload is not JSON
  }
  controller.enqueue(encoder.encode(`${line}\n`))
}

async function finalizeAntigravityResponse(res: Response, wantsStream: boolean): Promise<Response> {
  if (!wantsStream) {
    const text = await res.text()
    try {
      const json = JSON.parse(text) as { response?: unknown }
      const unwrapped = json.response !== undefined ? json.response : json
      return new Response(JSON.stringify(unwrapped), {
        status: res.status,
        statusText: res.statusText,
        headers: { 'Content-Type': 'application/json' },
      })
    } catch {
      return new Response(text, { status: res.status, statusText: res.statusText, headers: res.headers })
    }
  }

  if (!res.body) return res

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  let buffer = ''

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read()
      if (done) {
        // Cloud Code SSE often omits a trailing newline on the last event.
        if (buffer.trim()) {
          emitUnwrappedSseLine(controller, encoder, buffer)
        }
        controller.close()
        return
      }

      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split('\n')
      buffer = parts.pop() || ''

      for (const line of parts) {
        emitUnwrappedSseLine(controller, encoder, line)
      }
    },
    cancel(reason) {
      return reader.cancel(reason)
    },
  })

  return new Response(stream, {
    status: res.status,
    statusText: res.statusText,
    headers: {
      'Content-Type': res.headers.get('Content-Type') || 'text/event-stream',
    },
  })
}

export default class GeminiAntigravity extends AbstractAISDKModel {
  public name = 'Google Gemini (Antigravity)'
  public options: Options

  constructor(options: Options, dependencies: ModelDependencies) {
    super(options, dependencies)
    this.options = options
    this.injectDefaultMetadata = false
  }

  isSupportSystemMessage() {
    return true
  }

  private chatModelId(): string {
    return resolveAntigravityChatModelId(this.options.model.modelId)
  }

  private resolveFetch(options: CallChatCompletionOptions): FetchFunction {
    const proxyFetch = createFetchWithProxy(this.options.useProxy, this.dependencies)
    return createAntigravityFetch({
      accessToken: this.options.apiKey,
      projectId: this.options.projectId || GEMINI_ANTIGRAVITY_DEFAULT_PROJECT_ID,
      // Prefer daily sandbox first (OpenCode default), then prod
      endpointFallbacks: GEMINI_ANTIGRAVITY_ENDPOINT_FALLBACKS,
      apiBase: undefined,
      innerFetch: proxyFetch,
      thinkingLevel: resolveSessionAntigravityThinkingLevel(
        this.options.model.modelId,
        options.providerOptions
      ),
    })
  }

  protected getProvider(options: CallChatCompletionOptions) {
    // Dummy Studio baseURL — generateContent traffic is rewritten by createAntigravityFetch
    // Use a placeholder apiKey shape; real auth is Bearer on cloudcode-pa
    return createGoogleGenerativeAI({
      apiKey: this.options.apiKey || 'antigravity-oauth',
      baseURL: 'https://generativelanguage.googleapis.com/v1beta',
      fetch: this.resolveFetch(options),
    })
  }

  protected getChatModel(options: CallChatCompletionOptions): LanguageModelV3 {
    const provider = this.getProvider(options)
    // Ensure AI SDK path embeds the *resolved* chat model id
    return provider.chat(this.chatModelId())
  }

  protected getCallSettings(options: CallChatCompletionOptions): CallSettings {
    const chatId = this.chatModelId()
    const isGemini3 = chatId.toLowerCase().includes('gemini-3')
    const thinkingLevel =
      resolveSessionAntigravityThinkingLevel(this.options.model.modelId, options.providerOptions) || 'low'

    let providerParams: GoogleGenerativeAIProviderOptions = {
      safetySettings: [
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      ],
      ...(options.providerOptions?.google || {}),
    }

    if (isGemini3 || this.isSupportReasoning()) {
      providerParams = {
        ...providerParams,
        thinkingConfig: {
          ...(options.providerOptions?.google?.thinkingConfig || {}),
          // AI SDK may only type thinkingBudget; Antigravity rewrite injects thinkingLevel too
          includeThoughts: true,
          ...(isGemini3 ? { thinkingLevel } : {}),
        } as GoogleGenerativeAIProviderOptions['thinkingConfig'],
      }
    }

    return {
      temperature: this.options.temperature,
      topP: this.options.topP,
      maxOutputTokens: this.options.maxOutputTokens,
      providerOptions: {
        google: {
          ...providerParams,
        } satisfies GoogleGenerativeAIProviderOptions,
      },
    }
  }

  public listModels() {
    return fetchGeminiAntigravityModels(
      this.options.apiKey,
      this.options.projectId || GEMINI_ANTIGRAVITY_DEFAULT_PROJECT_ID
    ).catch((error) => {
      console.warn('[GeminiAntigravity] Failed to fetch models, using fallback.', error)
      return GEMINI_ANTIGRAVITY_DEFAULT_MODELS
    })
  }

  /**
   * Image generation via generateText + responseModalities (same path as Studio Gemini paint).
   * Uses Antigravity fetch rewrite so subscription OAuth works.
   */
  public async paint(
    params: {
      prompt: string
      images?: { imageUrl: string }[]
      num: number
      aspectRatio?: string
    },
    signal?: AbortSignal,
    callback?: (picBase64: string) => void | Promise<void>,
    _onProviderJobUpdate?: (data: { providerJobId?: string; queueNumber?: number }) => void
  ): Promise<string[]> {
    const rawId = this.options.model.modelId
    const chatId = this.chatModelId()
    if (!isGeminiImageModel(rawId) && !isGeminiImageModel(chatId)) {
      throw new ApiError('This Gemini Antigravity model does not support image generation')
    }

    // Empty options — paint does not need chat tools/provider option overrides
    const provider = this.getProvider({} as CallChatCompletionOptions)
    const model = provider.chat(chatId)
    const content: Array<{ type: 'text'; text: string } | { type: 'image'; image: string }> = [
      { type: 'text', text: params.prompt },
      ...(params.images || [])
        .map((image) => image.imageUrl)
        .filter((url): url is string => Boolean(url))
        .map((imageUrl) => ({ type: 'image' as const, image: imageUrl })),
    ]

    const results: string[] = []
    for (let i = 0; i < Math.max(1, params.num || 1); i++) {
      const providerOptions: GoogleGenerativeAIProviderOptions = {
        responseModalities: ['TEXT', 'IMAGE'],
      }
      if (params.aspectRatio && params.aspectRatio !== 'auto') {
        providerOptions.imageConfig = { aspectRatio: params.aspectRatio as GeminiAspectRatio }
      }

      const result = await generateText({
        model,
        messages: [{ role: 'user', content }],
        abortSignal: signal,
        providerOptions: {
          google: providerOptions,
        },
      })

      for (const file of result.files || []) {
        const b64 = typeof file.base64 === 'string' ? file.base64 : null
        const mediaType = file.mediaType || 'image/png'
        if (b64 && mediaType.startsWith('image/')) {
          const dataUrl = b64.startsWith('data:') ? b64 : `data:${mediaType};base64,${b64}`
          results.push(dataUrl)
          await callback?.(dataUrl)
        }
      }
    }

    if (results.length === 0) {
      throw new ApiError(
        `Antigravity image generation returned no image files for model "${chatId}". Try gemini-3-pro-image-preview with an API key, or use xAI grok-imagine-image.`
      )
    }
    return results
  }

  protected getImageModel() {
    // Image gen uses generateText path in paint(); not the AI SDK imageModel API
    return null
  }
}
