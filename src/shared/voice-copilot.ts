/**
 * Shared STT/TTS client for Voice Copilot v1.
 * Uses the user's OpenAI / Groq keys or a local Whisper-compatible endpoint.
 * No wake-word. No product cloud.
 */

export const VOICE_STT_PROVIDERS = ['local-whisper', 'openai', 'groq'] as const
export const VOICE_TTS_PROVIDERS = ['off', 'openai', 'groq'] as const

export type VoiceSttProvider = (typeof VOICE_STT_PROVIDERS)[number]
export type VoiceTtsProvider = (typeof VOICE_TTS_PROVIDERS)[number]

export type VoiceCopilotConfig = {
  enabled: boolean
  sttProvider: VoiceSttProvider
  ttsProvider: VoiceTtsProvider
  localWhisperUrl: string
  sttModel: string
  ttsModel: string
  ttsVoice: string
}

export const DEFAULT_LOCAL_WHISPER_URL = 'http://127.0.0.1:8080/v1/audio/transcriptions'
export const DEFAULT_OPENAI_AUDIO_HOST = 'https://api.openai.com'
export const DEFAULT_GROQ_AUDIO_HOST = 'https://api.groq.com/openai'
export const GROQ_DEFAULT_STT_MODEL = 'whisper-large-v3'

export const DEFAULT_VOICE_COPILOT: VoiceCopilotConfig = {
  enabled: false,
  sttProvider: 'openai',
  ttsProvider: 'off',
  localWhisperUrl: DEFAULT_LOCAL_WHISPER_URL,
  sttModel: 'whisper-1',
  ttsModel: 'tts-1',
  ttsVoice: 'alloy',
}

export type VoiceAuth = {
  openaiApiKey?: string
  openaiApiHost?: string
  groqApiKey?: string
  groqApiHost?: string
}

export type VoiceFetch = (input: string, init?: RequestInit) => Promise<Response>

function isSttProvider(value: unknown): value is VoiceSttProvider {
  return typeof value === 'string' && (VOICE_STT_PROVIDERS as readonly string[]).includes(value)
}

function isTtsProvider(value: unknown): value is VoiceTtsProvider {
  return typeof value === 'string' && (VOICE_TTS_PROVIDERS as readonly string[]).includes(value)
}

/** Trim, add https if missing, strip trailing slashes and a final /v1. */
export function normalizeApiHost(host?: string | null): string {
  if (!host) return ''
  let value = host.trim()
  if (!value) return ''
  if (!/^https?:\/\//i.test(value)) {
    value = `https://${value}`
  }
  value = value.replace(/\/+$/, '')
  value = value.replace(/\/v1$/i, '')
  return value
}

function hostForProvider(provider: 'openai' | 'groq', auth?: VoiceAuth | null): string {
  if (provider === 'groq') {
    return normalizeApiHost(auth?.groqApiHost) || DEFAULT_GROQ_AUDIO_HOST
  }
  return normalizeApiHost(auth?.openaiApiHost) || DEFAULT_OPENAI_AUDIO_HOST
}

export function resolveSttEndpoint(
  config: Pick<VoiceCopilotConfig, 'sttProvider' | 'localWhisperUrl'>,
  auth?: VoiceAuth | null
): string {
  if (config.sttProvider === 'local-whisper') {
    const url = (config.localWhisperUrl || DEFAULT_LOCAL_WHISPER_URL).trim()
    return url.replace(/\/+$/, '') || DEFAULT_LOCAL_WHISPER_URL
  }
  const host = hostForProvider(config.sttProvider === 'groq' ? 'groq' : 'openai', auth)
  return `${host}/v1/audio/transcriptions`
}

export function resolveTtsEndpoint(
  config: Pick<VoiceCopilotConfig, 'ttsProvider'>,
  auth?: VoiceAuth | null
): string {
  if (config.ttsProvider === 'off') {
    return ''
  }
  const host = hostForProvider(config.ttsProvider === 'groq' ? 'groq' : 'openai', auth)
  return `${host}/v1/audio/speech`
}

export function sttModelFor(config: Pick<VoiceCopilotConfig, 'sttProvider' | 'sttModel'>): string {
  const model = config.sttModel?.trim()
  if (config.sttProvider === 'groq') {
    if (!model || model === DEFAULT_VOICE_COPILOT.sttModel) {
      return GROQ_DEFAULT_STT_MODEL
    }
    return model
  }
  return model || DEFAULT_VOICE_COPILOT.sttModel
}

export function parseTranscript(payload: unknown): string {
  if (typeof payload === 'string') {
    return payload.trim()
  }
  if (!payload || typeof payload !== 'object') {
    return ''
  }
  const record = payload as Record<string, unknown>
  if (typeof record.text === 'string') {
    return record.text.trim()
  }
  if (typeof record.transcript === 'string') {
    return record.transcript.trim()
  }
  return ''
}

export function parseProviderError(payload: unknown, status?: number): string {
  if (typeof payload === 'string' && payload.trim()) {
    return payload.trim()
  }
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>
    const error = record.error
    if (typeof error === 'string' && error.trim()) {
      return error.trim()
    }
    if (error && typeof error === 'object') {
      const message = (error as Record<string, unknown>).message
      if (typeof message === 'string' && message.trim()) {
        return message.trim()
      }
    }
    if (typeof record.message === 'string' && record.message.trim()) {
      return record.message.trim()
    }
  }
  return status ? `Voice request failed (${status})` : 'Voice request failed'
}

export function mergeVoiceConfig(partial?: Partial<VoiceCopilotConfig> | null): VoiceCopilotConfig {
  const next: VoiceCopilotConfig = {
    ...DEFAULT_VOICE_COPILOT,
    ...(partial || {}),
  }
  if (!isSttProvider(next.sttProvider)) {
    next.sttProvider = DEFAULT_VOICE_COPILOT.sttProvider
  }
  if (!isTtsProvider(next.ttsProvider)) {
    next.ttsProvider = DEFAULT_VOICE_COPILOT.ttsProvider
  }
  if (typeof next.enabled !== 'boolean') {
    next.enabled = DEFAULT_VOICE_COPILOT.enabled
  }
  if (typeof next.localWhisperUrl !== 'string' || !next.localWhisperUrl.trim()) {
    next.localWhisperUrl = DEFAULT_VOICE_COPILOT.localWhisperUrl
  }
  if (typeof next.sttModel !== 'string' || !next.sttModel.trim()) {
    next.sttModel = DEFAULT_VOICE_COPILOT.sttModel
  }
  if (typeof next.ttsModel !== 'string' || !next.ttsModel.trim()) {
    next.ttsModel = DEFAULT_VOICE_COPILOT.ttsModel
  }
  if (typeof next.ttsVoice !== 'string' || !next.ttsVoice.trim()) {
    next.ttsVoice = DEFAULT_VOICE_COPILOT.ttsVoice
  }
  return next
}

function keyForProvider(provider: 'openai' | 'groq', auth?: VoiceAuth | null): string {
  const key = provider === 'groq' ? auth?.groqApiKey : auth?.openaiApiKey
  return typeof key === 'string' ? key.trim() : ''
}

async function readErrorPayload(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export async function transcribeAudio(input: {
  bytes: ArrayBuffer | Uint8Array
  fileName?: string
  mimeType?: string
  config?: Partial<VoiceCopilotConfig> | null
  auth?: VoiceAuth | null
  fetch?: VoiceFetch
}): Promise<string> {
  const bytes = input.bytes instanceof Uint8Array ? input.bytes : new Uint8Array(input.bytes)
  if (!bytes.byteLength) {
    throw new Error('Empty audio')
  }

  const config = mergeVoiceConfig(input.config)
  const endpoint = resolveSttEndpoint(config, input.auth)
  const model = sttModelFor(config)
  const mimeType = input.mimeType?.trim() || 'audio/webm'
  const fileName = input.fileName?.trim() || (mimeType.includes('mp4') ? 'audio.m4a' : 'audio.webm')

  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  const form = new FormData()
  form.append('file', new Blob([copy.buffer], { type: mimeType }), fileName)
  form.append('model', model)

  const headers: Record<string, string> = {}
  if (config.sttProvider !== 'local-whisper') {
    const provider = config.sttProvider === 'groq' ? 'groq' : 'openai'
    const apiKey = keyForProvider(provider, input.auth)
    if (!apiKey) {
      throw new Error(`Missing ${provider === 'groq' ? 'Groq' : 'OpenAI'} API key`)
    }
    headers.Authorization = `Bearer ${apiKey}`
  }

  const fetchFn = input.fetch || globalThis.fetch
  if (!fetchFn) {
    throw new Error('fetch is not available')
  }

  const response = await fetchFn(endpoint, {
    method: 'POST',
    headers,
    body: form,
  })

  if (!response.ok) {
    const payload = await readErrorPayload(response)
    throw new Error(parseProviderError(payload, response.status))
  }

  const payload = await response.json()
  const text = parseTranscript(payload)
  if (!text) {
    throw new Error('Empty transcript')
  }
  return text
}

export async function synthesizeSpeech(input: {
  text: string
  config?: Partial<VoiceCopilotConfig> | null
  auth?: VoiceAuth | null
  fetch?: VoiceFetch
}): Promise<Uint8Array> {
  const config = mergeVoiceConfig(input.config)
  if (config.ttsProvider === 'off') {
    throw new Error('TTS is off')
  }

  const text = input.text?.trim()
  if (!text) {
    throw new Error('Empty text')
  }

  const endpoint = resolveTtsEndpoint(config, input.auth)
  const provider = config.ttsProvider === 'groq' ? 'groq' : 'openai'
  const apiKey = keyForProvider(provider, input.auth)
  if (!apiKey) {
    throw new Error(`Missing ${provider === 'groq' ? 'Groq' : 'OpenAI'} API key`)
  }

  const fetchFn = input.fetch || globalThis.fetch
  if (!fetchFn) {
    throw new Error('fetch is not available')
  }

  const response = await fetchFn(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.ttsModel,
      voice: config.ttsVoice,
      input: text,
    }),
  })

  if (!response.ok) {
    const payload = await readErrorPayload(response)
    throw new Error(parseProviderError(payload, response.status))
  }

  const buffer = await response.arrayBuffer()
  return new Uint8Array(buffer)
}
