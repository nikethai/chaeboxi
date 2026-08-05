import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMessage, ModelProviderEnum, type Message, type StreamTextResult } from '@shared/types'
import type { ModelInterface } from '@shared/models/types'

const {
  createAndGenerateMock,
  navigateMock,
  webSearchExecutorMock,
  parseUserLinkFreeMock,
  modalShowMock,
  convertToModelMessagesMock,
  injectModelSystemPromptMock,
} = vi.hoisted(() => ({
  createAndGenerateMock: vi.fn(),
  navigateMock: vi.fn(),
  webSearchExecutorMock: vi.fn(),
  parseUserLinkFreeMock: vi.fn(),
  modalShowMock: vi.fn(),
  convertToModelMessagesMock: vi.fn(async (messages: Message[]) =>
    messages.map((message) => ({
      role: message.role,
      content: message.contentParts.map((part) => ('text' in part ? part.text : '')).join('\n'),
    }))
  ),
  injectModelSystemPromptMock: vi.fn((_: string, messages: Message[], instructions: string, role: 'system' | 'user') => {
    if (!instructions) {
      return messages
    }
    return [createMessage(role, instructions), ...messages]
  }),
}))

const settingsState = vi.hoisted(() => ({
  extension: {
    webSearch: {
      provider: 'bing',
    },
  },
  providers: {
    comfyui: {
      comfyuiCheckpoint: 'anime-model.safetensors',
    },
  } as Record<string, Record<string, unknown>>,
}))

vi.mock('@ebay/nice-modal-react', () => ({
  default: {
    show: modalShowMock,
  },
}))

vi.mock('@/router', () => ({
  router: {
    navigate: navigateMock,
  },
}))

vi.mock('@/stores/imageGenerationActions', () => ({
  createAndGenerate: createAndGenerateMock,
}))

vi.mock('@/adapters', () => ({
  createModelDependencies: vi.fn(),
}))

vi.mock('@/stores/settingsStore', () => ({
  settingsStore: {
    getState: () => ({
      ...settingsState,
      getSettings: () => settingsState,
    }),
  },
}))

vi.mock('@/stores/toolApprovalStore', () => ({
  getToolApproval: vi.fn(() => undefined),
  toolApprovalStore: {
    getState: () => ({
      addAuditEntry: vi.fn(),
      addApproval: vi.fn(),
      removeApproval: vi.fn(),
    }),
  },
}))

vi.mock('@/packages/web-search', () => ({
  webSearchExecutor: webSearchExecutorMock,
}))

vi.mock('@/packages/remote', () => ({
  parseUserLinkFree: parseUserLinkFreeMock,
}))

vi.mock('../mcp/controller', () => ({
  mcpController: {
    getAvailableTools: () => ({}),
  },
}))

vi.mock('./message-utils', () => ({
  convertToModelMessages: convertToModelMessagesMock,
  injectModelSystemPrompt: injectModelSystemPromptMock,
}))

vi.mock('./toolsets/knowledge-base', () => ({
  getToolSet: vi.fn(async () => null),
}))

vi.mock('./toolsets/file', () => ({
  default: {
    description: '',
    tools: {},
  },
}))

vi.mock('./toolsets/task-tracking', () => ({
  default: {
    description: '',
    tools: {},
  },
}))

vi.mock('./tools', () => ({
  combinedSearchByPromptEngineering: vi.fn(),
  constructMessagesWithKnowledgeBaseResults: vi.fn(),
  constructMessagesWithSearchResults: vi.fn(),
  knowledgeBaseSearchByPromptEngineering: vi.fn(),
  searchByPromptEngineering: vi.fn(),
}))

function createTestModel(chatImpl: NonNullable<ModelInterface['chat']>, supportToolUse = true): ModelInterface {
  return {
    name: 'Test Model',
    modelId: 'test-model',
    isSupportVision: () => true,
    isSupportToolUse: () => supportToolUse,
    isSupportSystemMessage: () => true,
    chat: chatImpl,
    paint: vi.fn(async () => []),
  }
}

describe('streamText agent image flow', () => {
  beforeEach(() => {
    createAndGenerateMock.mockReset()
    navigateMock.mockReset()
    webSearchExecutorMock.mockReset()
    parseUserLinkFreeMock.mockReset()
    modalShowMock.mockReset()
    convertToModelMessagesMock.mockClear()
    injectModelSystemPromptMock.mockClear()

    createAndGenerateMock.mockResolvedValue('record-1')
    navigateMock.mockResolvedValue(undefined)
    modalShowMock.mockResolvedValue('once')
    webSearchExecutorMock.mockResolvedValue({
      query: 'anime trend',
      searchResults: [
        {
          title: 'Result',
          link: 'https://www.pixiv.net/en/artworks/1',
          snippet: 'snippet',
        },
      ],
    })
    parseUserLinkFreeMock.mockResolvedValue({
      title: 'Pixiv page',
      text: 'Detailed content',
    })
    settingsState.providers[ModelProviderEnum.ComfyUI] = {
      comfyuiCheckpoint: 'anime-model.safetensors',
    }
  })

  it('does not expose generate_image when the feature is disabled', async () => {
    const chat = vi.fn(async (_messages, options) => {
      expect(options.tools?.generate_image).toBeUndefined()
      return { contentParts: [], text: 'done' } as StreamTextResult
    })

    const { streamText } = await import('./stream-text')

    await streamText(createTestModel(chat), {
      messages: [createMessage('user', 'hello')],
      onResultChangeWithCancel: vi.fn(),
      webBrowsing: true,
    })

    expect(chat).toHaveBeenCalled()
    expect(createAndGenerateMock).not.toHaveBeenCalled()
  })

  it('researches, parses, and auto-generates when the feature is enabled', async () => {
    const chat = vi.fn(async (messages, options) => {
      expect(messages[0].content).toContain('COMFYUI AGENT IMAGE FLOW')
      expect(options.tools?.generate_image).toBeDefined()

      const searchResult = await options.tools?.web_search?.execute?.({
        query: 'trending anime art',
        includeDomains: ['danbooru.donmai.us', 'pixiv.net'],
        maxResults: 2,
      })
      expect(searchResult).toMatchObject({
        query: 'anime trend',
      })

      const parsed = await options.tools?.parse_link?.execute?.({
        url: 'https://www.pixiv.net/en/artworks/1',
      })
      expect(parsed).toMatchObject({
        title: 'Pixiv page',
        content: 'Detailed content',
      })

      const generated = await options.tools?.generate_image?.execute?.({
        prompt: 'masterpiece, city lights, cinematic lighting',
        aspectRatio: 'horizontal',
        citations: ['https://www.pixiv.net/en/artworks/1'],
      })
      expect(generated).toMatchObject({
        recordId: 'record-1',
        provider: ModelProviderEnum.ComfyUI,
        modelId: 'comfyui-txt2img',
        status: 'started',
      })

      return { contentParts: [], text: 'done' } as StreamTextResult
    })

    const { streamText } = await import('./stream-text')

    await streamText(createTestModel(chat), {
      sessionId: 'session-1',
      messages: [createMessage('user', 'what is the best trending anime art')],
      onResultChangeWithCancel: vi.fn(),
      webBrowsing: true,
      agentImageFlowInstructions: 'COMFYUI AGENT IMAGE FLOW',
    })

    expect(webSearchExecutorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        includeDomains: ['danbooru.donmai.us', 'pixiv.net'],
        maxResults: 2,
      }),
      expect.anything()
    )
    expect(createAndGenerateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'masterpiece, city lights, cinematic lighting',
        model: {
          provider: ModelProviderEnum.ComfyUI,
          modelId: 'comfyui-txt2img',
        },
        aspectRatio: 'horizontal',
      })
    )
    expect(navigateMock).toHaveBeenCalledWith({ to: '/image-creator' })
  })

  it('does not generate when search returns no results', async () => {
    webSearchExecutorMock.mockResolvedValueOnce({
      query: 'anime trend',
      searchResults: [],
    })

    const chat = vi.fn(async (_messages, options) => {
      const searchResult = await options.tools?.web_search?.execute?.({
        query: 'trending anime art',
        includeDomains: ['danbooru.donmai.us', 'pixiv.net'],
      })
      expect(searchResult).toMatchObject({
        searchResults: [],
      })

      return { contentParts: [], text: 'no results' } as StreamTextResult
    })

    const { streamText } = await import('./stream-text')

    await streamText(createTestModel(chat), {
      messages: [createMessage('user', 'what is trending now')],
      onResultChangeWithCancel: vi.fn(),
      webBrowsing: true,
      agentImageFlowInstructions: 'COMFYUI AGENT IMAGE FLOW',
    })

    expect(createAndGenerateMock).not.toHaveBeenCalled()
  })

  it('falls back when parse_link fails and still generates', async () => {
    parseUserLinkFreeMock.mockRejectedValueOnce(new Error('parse failed'))

    const chat = vi.fn(async (_messages, options) => {
      await options.tools?.web_search?.execute?.({
        query: 'trending anime art',
        includeDomains: ['danbooru.donmai.us', 'pixiv.net'],
      })

      await expect(
        options.tools?.parse_link?.execute?.({
          url: 'https://www.pixiv.net/en/artworks/1',
        })
      ).rejects.toThrow('parse failed')

      await options.tools?.generate_image?.execute?.({
        prompt: 'masterpiece, dramatic perspective',
      })

      return { contentParts: [], text: 'done' } as StreamTextResult
    })

    const { streamText } = await import('./stream-text')

    await streamText(createTestModel(chat), {
      sessionId: 'session-1',
      messages: [createMessage('user', 'find me a trend')],
      onResultChangeWithCancel: vi.fn(),
      webBrowsing: true,
      agentImageFlowInstructions: 'COMFYUI AGENT IMAGE FLOW',
    })

    expect(createAndGenerateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'masterpiece, dramatic perspective',
      })
    )
  })

  it('fails early when ComfyUI checkpoint is missing', async () => {
    settingsState.providers[ModelProviderEnum.ComfyUI] = {}

    const chat = vi.fn(async (_messages, options) => {
      await expect(
        options.tools?.generate_image?.execute?.({
          prompt: 'masterpiece, city lights',
        })
      ).rejects.toThrow('ComfyUI checkpoint is not configured')

      return { contentParts: [], text: 'done' } as StreamTextResult
    })

    const { streamText } = await import('./stream-text')

    await streamText(createTestModel(chat), {
      sessionId: 'session-1',
      messages: [createMessage('user', 'generate')],
      onResultChangeWithCancel: vi.fn(),
      webBrowsing: true,
      agentImageFlowInstructions: 'COMFYUI AGENT IMAGE FLOW',
    })

    expect(createAndGenerateMock).not.toHaveBeenCalled()
  })
})

describe('streamText reasoning replay', () => {
  beforeEach(() => {
    convertToModelMessagesMock.mockClear()
  })

  it('passes assistant reasoning replay when the session toggle is enabled on a supported provider', async () => {
    const chat = vi.fn(async () => ({ contentParts: [], text: 'done' }) as StreamTextResult)
    const { streamText } = await import('./stream-text')

    await streamText(createTestModel(chat), {
      messages: [
        {
          id: 'assistant-1',
          role: 'assistant',
          contentParts: [
            { type: 'reasoning', text: 'hidden chain' },
            { type: 'text', text: 'final answer' },
          ],
        },
        createMessage('user', 'follow up'),
      ],
      sessionSettings: {
        provider: ModelProviderEnum.Qwen,
        modelId: 'qwen3.7-plus',
        preserveReasoningInContext: true,
      },
      onResultChangeWithCancel: vi.fn(),
    })

    expect(convertToModelMessagesMock).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        includeAssistantReasoning: true,
      })
    )
  })

  it('keeps assistant reasoning replay disabled when the session toggle is off', async () => {
    const chat = vi.fn(async () => ({ contentParts: [], text: 'done' }) as StreamTextResult)
    const { streamText } = await import('./stream-text')

    await streamText(createTestModel(chat), {
      messages: [
        {
          id: 'assistant-1',
          role: 'assistant',
          contentParts: [
            { type: 'reasoning', text: 'hidden chain' },
            { type: 'text', text: 'final answer' },
          ],
        },
        createMessage('user', 'follow up'),
      ],
      sessionSettings: {
        provider: ModelProviderEnum.Qwen,
        modelId: 'qwen3.7-plus',
        preserveReasoningInContext: false,
      },
      onResultChangeWithCancel: vi.fn(),
    })

    expect(convertToModelMessagesMock).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        includeAssistantReasoning: false,
      })
    )
  })
})
