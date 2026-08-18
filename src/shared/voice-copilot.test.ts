import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_VOICE_COPILOT,
  mergeVoiceConfig,
  normalizeApiHost,
  parseProviderError,
  parseTranscript,
  resolveSttEndpoint,
  resolveTtsEndpoint,
  sttModelFor,
  synthesizeSpeech,
  transcribeAudio,
} from './voice-copilot'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('normalizeApiHost', () => {
  it('trims, adds https, and strips trailing slash and /v1', () => {
    expect(normalizeApiHost(' api.openai.com/v1/ ')).toBe('https://api.openai.com')
    expect(normalizeApiHost('https://api.groq.com/openai/v1')).toBe('https://api.groq.com/openai')
    expect(normalizeApiHost('')).toBe('')
    expect(normalizeApiHost(undefined)).toBe('')
  })
})

describe('endpoints', () => {
  it('resolves OpenAI, Groq, local Whisper, and custom hosts', () => {
    expect(resolveSttEndpoint(DEFAULT_VOICE_COPILOT, {})).toBe('https://api.openai.com/v1/audio/transcriptions')
    expect(resolveSttEndpoint({ ...DEFAULT_VOICE_COPILOT, sttProvider: 'groq' }, {})).toBe(
      'https://api.groq.com/openai/v1/audio/transcriptions'
    )
    expect(resolveSttEndpoint({ ...DEFAULT_VOICE_COPILOT, sttProvider: 'local-whisper' }, {})).toBe(
      'http://127.0.0.1:8080/v1/audio/transcriptions'
    )
    expect(
      resolveSttEndpoint(DEFAULT_VOICE_COPILOT, { openaiApiHost: 'https://proxy.example.com/v1/' })
    ).toBe('https://proxy.example.com/v1/audio/transcriptions')
    expect(resolveTtsEndpoint({ ttsProvider: 'openai' }, {})).toBe('https://api.openai.com/v1/audio/speech')
    expect(resolveTtsEndpoint({ ttsProvider: 'groq' }, { groqApiHost: 'https://api.groq.com/openai' })).toBe(
      'https://api.groq.com/openai/v1/audio/speech'
    )
    expect(resolveTtsEndpoint({ ttsProvider: 'off' }, {})).toBe('')
  })

  it('picks STT models per provider', () => {
    expect(sttModelFor(DEFAULT_VOICE_COPILOT)).toBe('whisper-1')
    expect(sttModelFor({ sttProvider: 'groq', sttModel: 'whisper-1' })).toBe('whisper-large-v3')
    expect(sttModelFor({ sttProvider: 'groq', sttModel: 'whisper-large-v3-turbo' })).toBe('whisper-large-v3-turbo')
  })
})

describe('parseTranscript', () => {
  it('reads OpenAI-style text and trims whitespace', () => {
    expect(parseTranscript({ text: '  hello world  ' })).toBe('hello world')
    expect(parseTranscript({ transcript: 'alt field' })).toBe('alt field')
    expect(parseTranscript('plain')).toBe('plain')
    expect(parseTranscript({})).toBe('')
    expect(parseTranscript(null)).toBe('')
  })
})

describe('parseProviderError', () => {
  it('reads nested provider error messages', () => {
    expect(parseProviderError({ error: { message: 'Invalid key' } })).toBe('Invalid key')
    expect(parseProviderError({ error: 'Nope' })).toBe('Nope')
    expect(parseProviderError({ message: 'Bad request' })).toBe('Bad request')
    expect(parseProviderError(null, 401)).toBe('Voice request failed (401)')
  })
})

describe('mergeVoiceConfig', () => {
  it('fills defaults and rejects unknown providers', () => {
    expect(mergeVoiceConfig(undefined)).toEqual(DEFAULT_VOICE_COPILOT)
    expect(mergeVoiceConfig({})).toEqual(DEFAULT_VOICE_COPILOT)
    expect(mergeVoiceConfig({ enabled: true, ttsProvider: 'openai' })).toEqual({
      ...DEFAULT_VOICE_COPILOT,
      enabled: true,
      ttsProvider: 'openai',
    })
    expect(mergeVoiceConfig({ sttProvider: 'nope' as never, ttsVoice: '' })).toEqual(DEFAULT_VOICE_COPILOT)
  })
})

describe('transcribeAudio', () => {
  it('posts FormData file+model and uses Bearer except for local-whisper', async () => {
    const fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.body).toBeInstanceOf(FormData)
      const form = init?.body as FormData
      expect(form.get('model')).toBe('whisper-1')
      const file = form.get('file')
      expect(file).toBeInstanceOf(Blob)
      expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer sk-test')
      return jsonResponse({ text: 'hello from mic' })
    })

    const text = await transcribeAudio({
      bytes: new Uint8Array([1, 2, 3]),
      fileName: 'clip.webm',
      mimeType: 'audio/webm',
      config: DEFAULT_VOICE_COPILOT,
      auth: { openaiApiKey: 'sk-test' },
      fetch,
    })

    expect(text).toBe('hello from mic')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch.mock.calls[0][0]).toBe('https://api.openai.com/v1/audio/transcriptions')
  })

  it('omits Authorization for local-whisper', async () => {
    const fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      expect((init?.headers as Record<string, string>).Authorization).toBeUndefined()
      return jsonResponse({ text: 'local' })
    })

    await transcribeAudio({
      bytes: new Uint8Array([9]),
      config: { sttProvider: 'local-whisper' },
      auth: { openaiApiKey: 'should-not-be-used' },
      fetch,
    })

    expect(fetch.mock.calls[0][0]).toBe('http://127.0.0.1:8080/v1/audio/transcriptions')
  })

  it('rejects empty audio without calling fetch', async () => {
    const fetch = vi.fn()
    await expect(
      transcribeAudio({
        bytes: new Uint8Array(),
        config: DEFAULT_VOICE_COPILOT,
        auth: { openaiApiKey: 'sk' },
        fetch,
      })
    ).rejects.toThrow(/empty audio/i)
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('synthesizeSpeech', () => {
  it('throws when TTS is off', async () => {
    const fetch = vi.fn()
    await expect(
      synthesizeSpeech({
        text: 'hello',
        config: DEFAULT_VOICE_COPILOT,
        auth: { openaiApiKey: 'sk' },
        fetch,
      })
    ).rejects.toThrow(/tts is off/i)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('posts JSON speech API and returns Uint8Array', async () => {
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe('https://api.openai.com/v1/audio/speech')
      expect(init?.method).toBe('POST')
      expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer sk-tts')
      expect(JSON.parse(String(init?.body))).toEqual({
        model: 'tts-1',
        voice: 'alloy',
        input: 'spoken reply',
      })
      return new Response(new Uint8Array([9, 8, 7]), { status: 200 })
    })

    const bytes = await synthesizeSpeech({
      text: 'spoken reply',
      config: { ttsProvider: 'openai' },
      auth: { openaiApiKey: 'sk-tts' },
      fetch,
    })

    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(Array.from(bytes)).toEqual([9, 8, 7])
  })
})
