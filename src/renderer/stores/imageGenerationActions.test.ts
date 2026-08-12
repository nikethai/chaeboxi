import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  createRecordMock,
  updateRecordMock,
  addGeneratedImageMock,
  getImageGenerationRecordMock,
  deleteRecordMock,
  queryClientSetQueryDataMock,
  queryClientInvalidateQueriesMock,
  setBlobMock,
  getModelMock,
  createModelDependenciesMock,
  trackEventMock,
  interruptMock,
} = vi.hoisted(() => ({
  createRecordMock: vi.fn(),
  updateRecordMock: vi.fn(),
  addGeneratedImageMock: vi.fn(),
  getImageGenerationRecordMock: vi.fn(),
  deleteRecordMock: vi.fn(),
  queryClientSetQueryDataMock: vi.fn(),
  queryClientInvalidateQueriesMock: vi.fn(),
  setBlobMock: vi.fn(),
  getModelMock: vi.fn(),
  createModelDependenciesMock: vi.fn(),
  trackEventMock: vi.fn(),
  interruptMock: vi.fn(),
}))

const generationState = vi.hoisted(() => ({
  activeGenerationId: null as string | null,
  queuedGenerationIds: [] as string[],
  currentRecordId: null as string | null,
}))

const recordMap = vi.hoisted(() => new Map<string, any>())

vi.mock('@shared/models', () => ({
  getModel: getModelMock,
}))

vi.mock('@shared/providers/definitions/models/comfyui-client', () => ({
  ComfyUIClient: vi.fn().mockImplementation(() => ({
    interrupt: interruptMock,
  })),
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
    appLog: vi.fn().mockResolvedValue(undefined),
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
      activeGenerationId: generationState.activeGenerationId,
      queuedGenerationIds: generationState.queuedGenerationIds,
      currentRecordId: generationState.currentRecordId,
      setActiveGenerationId: (id: string | null) => {
        generationState.activeGenerationId = id
      },
      setQueuedGenerationIds: (ids: string[]) => {
        generationState.queuedGenerationIds = [...ids]
      },
      enqueueGenerationId: (id: string) => {
        if (!generationState.queuedGenerationIds.includes(id)) {
          generationState.queuedGenerationIds = [...generationState.queuedGenerationIds, id]
        }
      },
      removeQueuedGenerationId: (id: string) => {
        generationState.queuedGenerationIds = generationState.queuedGenerationIds.filter((queuedId) => queuedId !== id)
      },
      shiftQueuedGenerationId: () => {
        const [nextId, ...remaining] = generationState.queuedGenerationIds
        generationState.queuedGenerationIds = remaining
        return nextId ?? null
      },
      setCurrentRecordId: (id: string | null) => {
        generationState.currentRecordId = id
      },
      setInitialized: vi.fn(),
      initialized: true,
    }),
  },
  createRecord: createRecordMock,
  updateRecord: updateRecordMock,
  addGeneratedImage: addGeneratedImageMock,
  getImageGenerationRecord: getImageGenerationRecordMock,
  deleteRecord: deleteRecordMock,
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
        comfyui: {
          apiHost: 'http://127.0.0.1:8188',
          imagePromptCharacterPrepend: '1girl, blue eyes',
          imagePromptPositiveTagsPrepend: 'masterpiece, best quality',
        },
      },
      getSettings: () => ({
        providers: {
          openai: {
            imagePromptCharacterPrepend: '1girl, blue eyes',
            imagePromptPositiveTagsPrepend: 'masterpiece, best quality',
          },
          comfyui: {
            apiHost: 'http://127.0.0.1:8188',
            imagePromptCharacterPrepend: '1girl, blue eyes',
            imagePromptPositiveTagsPrepend: 'masterpiece, best quality',
          },
        },
      }),
    }),
  },
}))

vi.mock('@/utils/track', () => ({
  trackEvent: trackEventMock,
}))

vi.mock('@/utils/xai-auth-refresh', () => ({
  refreshXaiAuthIfNeeded: vi.fn(async (settings: unknown) => settings),
}))

vi.mock('@/utils/openai-codex-auth-refresh', () => ({
  refreshOpenAICodexAuthIfNeeded: vi.fn(async (settings: unknown) => settings),
}))

vi.mock('@/utils/gemini-antigravity-auth-refresh', () => ({
  refreshGeminiAntigravityAuthIfNeeded: vi.fn(async (settings: unknown) => settings),
}))

vi.mock('@/stores/chatStore', () => ({
  getSession: vi.fn(async () => null),
}))

vi.mock('@/stores/session/messages', () => ({
  modifyMessage: vi.fn(async () => {}),
}))

function seedRecord(record: any) {
  recordMap.set(record.id, structuredClone(record))
}

describe('imageGenerationActions', () => {
  beforeEach(() => {
    vi.resetModules()

    generationState.activeGenerationId = null
    generationState.queuedGenerationIds = []
    generationState.currentRecordId = null

    recordMap.clear()

    createRecordMock.mockReset()
    updateRecordMock.mockReset()
    addGeneratedImageMock.mockReset()
    getImageGenerationRecordMock.mockReset()
    deleteRecordMock.mockReset()
    queryClientSetQueryDataMock.mockReset()
    queryClientInvalidateQueriesMock.mockReset()
    setBlobMock.mockReset()
    getModelMock.mockReset()
    createModelDependenciesMock.mockReset()
    trackEventMock.mockReset()
    interruptMock.mockReset()

    updateRecordMock.mockImplementation(async (id: string, updates: Record<string, unknown>) => {
      const existing = recordMap.get(id)
      if (!existing) return null
      const updated = { ...existing, ...updates }
      recordMap.set(id, updated)
      return updated
    })

    addGeneratedImageMock.mockImplementation(async (id: string, storageKey: string) => {
      const existing = recordMap.get(id)
      if (!existing) return null
      const updated = {
        ...existing,
        generatedImages: [...existing.generatedImages, storageKey],
      }
      recordMap.set(id, updated)
      return updated
    })

    getImageGenerationRecordMock.mockImplementation(async (id: string) => recordMap.get(id) ?? null)
    deleteRecordMock.mockImplementation(async (id: string) => {
      recordMap.delete(id)
    })

    createModelDependenciesMock.mockResolvedValue({
      storage: {
        getImage: vi.fn(),
      },
    })
  })

  it('starts the first queued job immediately', async () => {
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
      status: 'queued' as const,
    }
    seedRecord(record)

    const paintMock = vi.fn(
      async (_params: unknown, _signal: AbortSignal | undefined, callback?: (dataUrl: string) => Promise<void>) => {
        await callback?.('data:image/png;base64,abc')
        return ['data:image/png;base64,abc']
      }
    )

    createRecordMock.mockResolvedValue(record)
    getModelMock.mockReturnValue({ paint: paintMock })

    const { createAndGenerate } = await import('./imageGenerationActions.js')

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
    expect(generationState.currentRecordId).toBe('record-1')

    await vi.waitFor(() => {
      expect(paintMock).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: '1girl, blue eyes, masterpiece, best quality, standing in the rain',
        }),
        expect.any(AbortSignal),
        expect.any(Function),
        expect.any(Function)
      )
    })

    await vi.waitFor(() => {
      expect(recordMap.get('record-1').status).toBe('done')
      expect(generationState.activeGenerationId).toBeNull()
    })
  })

  it('keeps later jobs queued until the active job finishes', async () => {
    const record1 = {
      id: 'record-1',
      prompt: 'first prompt',
      referenceImages: [],
      generatedImages: [],
      createdAt: Date.now(),
      model: { provider: 'openai', modelId: 'gpt-image-1' },
      status: 'queued' as const,
    }
    const record2 = {
      id: 'record-2',
      prompt: 'second prompt',
      referenceImages: [],
      generatedImages: [],
      createdAt: Date.now() + 1,
      model: { provider: 'openai', modelId: 'gpt-image-1' },
      status: 'queued' as const,
    }
    seedRecord(record1)
    seedRecord(record2)

    let resolveFirstRun: (() => unknown) | undefined
    const paintMock = vi
      .fn()
      .mockImplementationOnce(
        async (_params: unknown, _signal: AbortSignal | undefined, callback?: (dataUrl: string) => Promise<void>) => {
          await new Promise<void>((resolve) => {
            resolveFirstRun = () => resolve()
          })
          await callback?.('data:image/png;base64,first')
          return ['data:image/png;base64,first']
        }
      )
      .mockImplementationOnce(
        async (_params: unknown, _signal: AbortSignal | undefined, callback?: (dataUrl: string) => Promise<void>) => {
          await callback?.('data:image/png;base64,second')
          return ['data:image/png;base64,second']
        }
      )

    createRecordMock.mockResolvedValueOnce(record1).mockResolvedValueOnce(record2)
    getModelMock.mockReturnValue({ paint: paintMock })

    const { createAndGenerate } = await import('./imageGenerationActions.js')

    await createAndGenerate({
      prompt: record1.prompt,
      referenceImages: [],
      model: record1.model,
      imageGenerateNum: 1,
      aspectRatio: 'auto',
    })

    await createAndGenerate({
      prompt: record2.prompt,
      referenceImages: [],
      model: record2.model,
      imageGenerateNum: 1,
      aspectRatio: 'auto',
    })

    await vi.waitFor(() => {
      expect(paintMock).toHaveBeenCalledTimes(1)
      expect(generationState.activeGenerationId).toBe('record-1')
      expect(generationState.queuedGenerationIds).toEqual(['record-2'])
    })

    resolveFirstRun?.()

    await vi.waitFor(() => {
      expect(paintMock).toHaveBeenCalledTimes(2)
      expect(recordMap.get('record-2').status).toBe('done')
      expect(generationState.queuedGenerationIds).toEqual([])
      expect(generationState.activeGenerationId).toBeNull()
    })
  })

  it('removes queued jobs without affecting the active job', async () => {
    const record1 = {
      id: 'record-1',
      prompt: 'first prompt',
      referenceImages: [],
      generatedImages: [],
      createdAt: Date.now(),
      model: { provider: 'openai', modelId: 'gpt-image-1' },
      status: 'queued' as const,
    }
    const record2 = {
      id: 'record-2',
      prompt: 'second prompt',
      referenceImages: [],
      generatedImages: [],
      createdAt: Date.now() + 1,
      model: { provider: 'openai', modelId: 'gpt-image-1' },
      status: 'queued' as const,
    }
    seedRecord(record1)
    seedRecord(record2)

    const paintMock = vi.fn(
      () =>
        new Promise<string[]>((_resolve) => {
          // Intentionally unresolved for the duration of the assertion.
        })
    )

    createRecordMock.mockResolvedValueOnce(record1).mockResolvedValueOnce(record2)
    getModelMock.mockReturnValue({ paint: paintMock })

    const { createAndGenerate, removeQueuedGeneration } = await import('./imageGenerationActions.js')

    await createAndGenerate({
      prompt: record1.prompt,
      referenceImages: [],
      model: record1.model,
      imageGenerateNum: 1,
      aspectRatio: 'auto',
    })
    await createAndGenerate({
      prompt: record2.prompt,
      referenceImages: [],
      model: record2.model,
      imageGenerateNum: 1,
      aspectRatio: 'auto',
    })

    await removeQueuedGeneration('record-2')

    expect(generationState.activeGenerationId).toBe('record-1')
    expect(generationState.queuedGenerationIds).toEqual([])
    expect(recordMap.has('record-2')).toBe(false)
  })

  it('cancels the active ComfyUI job', async () => {
    const record = {
      id: 'record-1',
      prompt: 'neon alley',
      referenceImages: [],
      generatedImages: [],
      createdAt: Date.now(),
      model: { provider: 'comfyui', modelId: 'comfyui-txt2img' },
      status: 'queued' as const,
    }
    seedRecord(record)

    let paintSettled = false
    const paintMock = vi.fn(
      (_params: unknown, signal?: AbortSignal) =>
        new Promise<string[]>((_resolve, reject) => {
          const abort = () => {
            paintSettled = true
            reject(new DOMException('Generation was cancelled', 'AbortError'))
          }
          if (signal?.aborted) {
            abort()
            return
          }
          signal?.addEventListener('abort', abort, { once: true })
        })
    )

    createRecordMock.mockResolvedValue(record)
    getModelMock.mockReturnValue({ paint: paintMock })
    interruptMock.mockResolvedValue(undefined)

    const { cancelGeneration, createAndGenerate } = await import('./imageGenerationActions.js')

    await createAndGenerate({
      prompt: record.prompt,
      referenceImages: [],
      model: record.model,
      imageGenerateNum: 1,
      aspectRatio: 'vertical',
    })

    await vi.waitFor(() => {
      expect(generationState.activeGenerationId).toBe('record-1')
      expect(paintMock).toHaveBeenCalledTimes(1)
    })

    await cancelGeneration('record-1')

    await vi.waitFor(() => {
      expect(recordMap.get('record-1').status).toBe('cancelled')
    })
    await vi.waitFor(() => {
      expect(paintSettled).toBe(true)
    })
  })

  it('persists ComfyUI provider job metadata from the paint callback', async () => {
    // Use a unique id so earlier cancel tests cannot leak controller/queue state onto this record.
    const record = {
      id: 'record-meta-1',
      prompt: 'neon alley at night',
      referenceImages: [],
      generatedImages: [],
      createdAt: Date.now(),
      model: {
        provider: 'comfyui',
        modelId: 'comfyui-txt2img',
      },
      status: 'queued' as const,
    }
    seedRecord(record)

    const paintMock = vi.fn(
      async (
        _params: unknown,
        _signal: AbortSignal | undefined,
        callback?: (dataUrl: string) => Promise<void>,
        onProviderJobUpdate?: (data: { providerJobId?: string; queueNumber?: number }) => Promise<void>
      ) => {
        await onProviderJobUpdate?.({ providerJobId: 'prompt-123', queueNumber: 7 })
        await callback?.('data:image/png;base64,abc')
        return ['data:image/png;base64,abc']
      }
    )

    createRecordMock.mockResolvedValue(record)
    getModelMock.mockReturnValue({ paint: paintMock })

    const { createAndGenerate } = await import('./imageGenerationActions.js')

    await createAndGenerate({
      prompt: record.prompt,
      referenceImages: [],
      model: record.model,
      imageGenerateNum: 1,
      aspectRatio: 'vertical',
    })

    await vi.waitFor(() => {
      expect(recordMap.get('record-meta-1').providerJobId).toBe('prompt-123')
      expect(recordMap.get('record-meta-1').queueNumber).toBe(7)
      expect(recordMap.get('record-meta-1').status).toBe('done')
    })
  })

  it('marks empty paint results as error', async () => {
    const record = {
      id: 'record-empty',
      prompt: 'empty',
      referenceImages: [],
      generatedImages: [],
      createdAt: Date.now(),
      model: { provider: 'openai', modelId: 'gpt-image-1' },
      status: 'queued' as const,
    }
    seedRecord(record)
    createRecordMock.mockResolvedValue(record)
    getModelMock.mockReturnValue({
      paint: vi.fn(async () => []),
    })

    const { createAndGenerate } = await import('./imageGenerationActions.js')
    await createAndGenerate({
      prompt: record.prompt,
      referenceImages: [],
      model: record.model,
      imageGenerateNum: 1,
    })

    await vi.waitFor(() => {
      expect(recordMap.get('record-empty').status).toBe('error')
      expect(recordMap.get('record-empty').error).toMatch(/no images/i)
    })
  })

  it('marks empty paint results as error', async () => {
    const record = {
      id: 'record-empty',
      prompt: 'empty',
      referenceImages: [],
      generatedImages: [],
      createdAt: Date.now(),
      model: { provider: 'openai', modelId: 'gpt-image-1' },
      status: 'queued' as const,
    }
    seedRecord(record)
    createRecordMock.mockResolvedValue(record)
    getModelMock.mockReturnValue({
      paint: vi.fn(async () => []),
    })

    const { createAndGenerate } = await import('./imageGenerationActions.js')
    await createAndGenerate({
      prompt: record.prompt,
      referenceImages: [],
      model: record.model,
      imageGenerateNum: 1,
    })

    await vi.waitFor(() => {
      expect(recordMap.get('record-empty').status).toBe('error')
      expect(recordMap.get('record-empty').error).toMatch(/no images/i)
    })
  })

  it('requeues cancelled records on retry', async () => {
    const record = {
      id: 'record-1',
      prompt: 'portrait by the window',
      referenceImages: [],
      generatedImages: ['old-image'],
      createdAt: Date.now(),
      model: {
        provider: 'openai',
        modelId: 'gpt-image-1',
      },
      status: 'cancelled' as const,
      error: 'Generation cancelled',
    }
    seedRecord(record)

    const paintMock = vi.fn(
      async (_params: unknown, _signal: AbortSignal | undefined, callback?: (dataUrl: string) => Promise<void>) => {
        await callback?.('data:image/png;base64,retry')
        return ['data:image/png;base64,retry']
      }
    )
    getModelMock.mockReturnValue({ paint: paintMock })

    const { retryGeneration } = await import('./imageGenerationActions.js')

    await retryGeneration(record.id)

    expect(generationState.currentRecordId).toBe('record-1')
    await vi.waitFor(() => {
      expect(recordMap.get('record-1').generatedImages.length).toBeGreaterThan(0)
      expect(recordMap.get('record-1').status).toBe('done')
    })
  })
})
