import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  createRecordMock,
  updateRecordMock,
  addGeneratedImageMock,
  getRecordByIdMock,
  queryClientSetQueryDataMock,
  queryClientInvalidateQueriesMock,
  setBlobMock,
  getModelMock,
  createModelDependenciesMock,
  trackEventMock,
} = vi.hoisted(() => ({
  createRecordMock: vi.fn(),
  updateRecordMock: vi.fn(),
  addGeneratedImageMock: vi.fn(),
  getRecordByIdMock: vi.fn(),
  queryClientSetQueryDataMock: vi.fn(),
  queryClientInvalidateQueriesMock: vi.fn(),
  setBlobMock: vi.fn(),
  getModelMock: vi.fn(),
  createModelDependenciesMock: vi.fn(),
  trackEventMock: vi.fn(),
}))

const generationState = vi.hoisted(() => ({
  currentGeneratingId: null as string | null,
  currentRecordId: null as string | null,
}))

vi.mock('@shared/models', () => ({
  getModel: getModelMock,
}))

vi.mock('@/adapters', () => ({
  createModelDependencies: createModelDependenciesMock,
}))

vi.mock('@/storage', () => ({
  default: {
    setBlob: setBlobMock,
  },
}))

vi.mock('@/platform', () => ({
  default: {
    getImageGenerationStorage: () => ({
      getById: getRecordByIdMock,
    }),
  },
}))

vi.mock('@/stores/queryClient', () => ({
  queryClient: {
    setQueryData: queryClientSetQueryDataMock,
    invalidateQueries: queryClientInvalidateQueriesMock,
  },
}))

vi.mock('@/stores/imageGenerationStore', () => ({
  IMAGE_GEN_LIST_QUERY_KEY: 'image-generation-list',
  IMAGE_GEN_QUERY_KEY: 'image-generation',
  imageGenerationStore: {
    getState: () => ({
      currentGeneratingId: generationState.currentGeneratingId,
      currentRecordId: generationState.currentRecordId,
      setCurrentGeneratingId: (id: string | null) => {
        generationState.currentGeneratingId = id
      },
      setCurrentRecordId: (id: string | null) => {
        generationState.currentRecordId = id
      },
    }),
  },
  createRecord: createRecordMock,
  updateRecord: updateRecordMock,
  addGeneratedImage: addGeneratedImageMock,
}))

vi.mock('@/stores/lastUsedModelStore', () => ({
  lastUsedModelStore: {
    getState: () => ({
      setPictureModel: vi.fn(),
    }),
  },
}))

vi.mock('@/stores/settingsStore', () => ({
  settingsStore: {
    getState: () => ({
      providers: {
        openai: {
          imagePromptCharacterPrepend: '1girl, blue eyes',
          imagePromptPositiveTagsPrepend: 'masterpiece, best quality',
        },
      },
    }),
  },
}))

vi.mock('@/utils/track', () => ({
  trackEvent: trackEventMock,
}))

describe('imageGenerationActions', () => {
  beforeEach(() => {
    generationState.currentGeneratingId = null
    generationState.currentRecordId = null

    createRecordMock.mockReset()
    updateRecordMock.mockReset()
    addGeneratedImageMock.mockReset()
    getRecordByIdMock.mockReset()
    queryClientSetQueryDataMock.mockReset()
    queryClientInvalidateQueriesMock.mockReset()
    setBlobMock.mockReset()
    getModelMock.mockReset()
    createModelDependenciesMock.mockReset()
    trackEventMock.mockReset()
  })

  it('stores the raw prompt but sends the composed prompt for OpenAI image generation', async () => {
    const rawPrompt = 'standing in the rain'
    const record = {
      id: 'record-1',
      prompt: rawPrompt,
      referenceImages: [],
      generatedImages: [],
      createdAt: Date.now(),
      model: {
        provider: 'openai',
        modelId: 'gpt-image-1',
      },
      status: 'pending' as const,
    }
    const paintMock = vi.fn(async (_params: unknown, _signal: unknown, callback?: (dataUrl: string) => Promise<void>) => {
      await callback?.('data:image/png;base64,abc')
      return ['data:image/png;base64,abc']
    })

    createRecordMock.mockResolvedValue(record)
    updateRecordMock.mockResolvedValue(record)
    addGeneratedImageMock.mockResolvedValue({
      ...record,
      generatedImages: ['stored-image'],
    })
    createModelDependenciesMock.mockResolvedValue({
      storage: {
        getImage: vi.fn(),
      },
    })
    getModelMock.mockReturnValue({
      paint: paintMock,
    })

    const { createAndGenerate } = await import('./imageGenerationActions')

    const createdId = await createAndGenerate({
      prompt: rawPrompt,
      referenceImages: [],
      model: {
        provider: 'openai',
        modelId: 'gpt-image-1',
      },
      imageGenerateNum: 1,
      aspectRatio: 'auto',
    })

    expect(createdId).toBe('record-1')
    expect(createRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: rawPrompt,
      }),
    )

    await vi.waitFor(() => {
      expect(paintMock).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: '1girl, blue eyes, masterpiece, best quality, standing in the rain',
        }),
        undefined,
        expect.any(Function),
      )
    })
    await vi.waitFor(() => {
      expect(queryClientInvalidateQueriesMock).toHaveBeenCalled()
    })
  })

  it('recomputes the composed prompt from current settings on retry', async () => {
    const record = {
      id: 'record-2',
      prompt: 'portrait by the window',
      referenceImages: [],
      generatedImages: [],
      createdAt: Date.now(),
      model: {
        provider: 'openai',
        modelId: 'gpt-image-1',
      },
      status: 'error' as const,
    }
    const paintMock = vi.fn(async () => [])

    getRecordByIdMock.mockResolvedValue(record)
    updateRecordMock.mockResolvedValue(record)
    createModelDependenciesMock.mockResolvedValue({
      storage: {
        getImage: vi.fn(),
      },
    })
    getModelMock.mockReturnValue({
      paint: paintMock,
    })

    const { retryGeneration } = await import('./imageGenerationActions')

    await retryGeneration(record.id)

    await vi.waitFor(() => {
      expect(paintMock).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: '1girl, blue eyes, masterpiece, best quality, portrait by the window',
        }),
        undefined,
        expect.any(Function),
      )
    })
    await vi.waitFor(() => {
      expect(queryClientInvalidateQueriesMock).toHaveBeenCalled()
    })
  })
})
