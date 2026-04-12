import { getModel } from '@shared/models'
import { AIProviderNoImplementedPaintError, ChatboxAIAPIError } from '@shared/models/errors'
import { ComfyUIClient } from '@shared/providers/definitions/models/comfyui-client'
import type { ComfyUIGenerationParams } from '@shared/providers/definitions/models/comfyui-types'
import { ModelProviderEnum, type ImageGeneration, type ImageGenerationModel } from '@shared/types'
import { createModelDependencies } from '@/adapters'
import { getLogger } from '@/lib/utils'
import storage from '@/storage'
import { StorageKeyGenerator } from '@/storage/StoreStorage'
import { composeImageGenerationPrompt } from '@/utils/imagePrompt'
import { trackEvent } from '@/utils/track'
import {
  addGeneratedImage,
  createRecord,
  deleteRecord,
  getImageGenerationRecord,
  IMAGE_GEN_LIST_QUERY_KEY,
  IMAGE_GEN_QUERY_KEY,
  imageGenerationStore,
  updateRecord,
} from './imageGenerationStore'
import { lastUsedModelStore } from './lastUsedModelStore'
import { queryClient } from './queryClient'
import { settingsStore } from './settingsStore'

const log = getLogger('image-generation-actions')
const CANCELLED_ERROR_MESSAGE = 'Generation cancelled'

let isProcessingQueue = false
const activeControllers = new Map<string, AbortController>()

function getGenerationPrompt(rawPrompt: string, model: ImageGenerationModel) {
  const providerSettings = settingsStore.getState().providers?.[model.provider]
  return composeImageGenerationPrompt(providerSettings, rawPrompt)
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function setRecordQueryData(record: ImageGeneration | null): void {
  if (record) {
    queryClient.setQueryData([IMAGE_GEN_QUERY_KEY, record.id], record)
  }
}

function invalidateHistoryQuery(): void {
  queryClient.invalidateQueries({ queryKey: [IMAGE_GEN_LIST_QUERY_KEY] })
}

async function markQueuedRecordCancelled(recordId: string, message: string): Promise<void> {
  const updatedRecord = await updateRecord(recordId, {
    status: 'cancelled',
    error: message,
    finishedAt: Date.now(),
  })
  setRecordQueryData(updatedRecord)
  invalidateHistoryQuery()
}

async function interruptComfyUI(record: ImageGeneration | null): Promise<void> {
  if (!record || record.model.provider !== ModelProviderEnum.ComfyUI) {
    return
  }

  const apiHost = settingsStore.getState().providers?.[ModelProviderEnum.ComfyUI]?.apiHost
  if (!apiHost) {
    return
  }

  try {
    await new ComfyUIClient(apiHost).interrupt()
  } catch (error) {
    log.error('Failed to interrupt ComfyUI job:', error)
  }
}

async function processNextGeneration(): Promise<void> {
  const store = imageGenerationStore.getState()
  if (isProcessingQueue || store.activeGenerationId !== null) {
    return
  }

  const nextRecordId = store.shiftQueuedGenerationId()
  if (!nextRecordId) {
    return
  }

  isProcessingQueue = true
  store.setActiveGenerationId(nextRecordId)

  try {
    await runGeneration(nextRecordId)
  } finally {
    activeControllers.delete(nextRecordId)
    imageGenerationStore.getState().setActiveGenerationId(null)
    isProcessingQueue = false
    invalidateHistoryQuery()
    void processNextGeneration()
  }
}

async function runGeneration(recordId: string): Promise<void> {
  const record = await getImageGenerationRecord(recordId)
  if (!record) {
    log.info('Image generation record not found:', recordId)
    return
  }

  if (record.status !== 'queued') {
    return
  }

  const controller = new AbortController()
  activeControllers.set(recordId, controller)

  try {
    let currentRecord = await updateRecord(recordId, {
      status: 'generating',
      generatedImages: [],
      startedAt: Date.now(),
      finishedAt: undefined,
      error: undefined,
      errorCode: undefined,
      providerJobId: undefined,
      queueNumber: undefined,
    })
    setRecordQueryData(currentRecord)

    const globalSettings = settingsStore.getState()
    const dependencies = await createModelDependencies()
    const sessionSettings = {
      provider: record.model.provider,
      modelId: record.model.modelId,
      dalleStyle: record.dalleStyle,
      imageGenerateNum: record.imageGenerateNum,
    }

    const model = getModel(sessionSettings, globalSettings, { uuid: '' }, dependencies)
    if (!model || !model.paint) {
      throw new AIProviderNoImplementedPaintError(record.model.provider)
    }

    lastUsedModelStore.getState().setPictureModel(record.model.provider, record.model.modelId)

    const referenceImageUrls = await Promise.all(
      record.referenceImages.map(async (storageKey) => ({
        imageUrl: await dependencies.storage.getImage(storageKey),
      }))
    )

    trackEvent('generate_image', {
      provider: record.model.provider,
      model: record.model.modelId,
      num_images: record.imageGenerateNum || 1,
      has_reference: record.referenceImages.length > 0,
    })

    const prompt = getGenerationPrompt(record.prompt, record.model)

    await model.paint(
      {
        prompt,
        images: referenceImageUrls.length > 0 ? referenceImageUrls : undefined,
        num: record.imageGenerateNum || 1,
        aspectRatio: record.aspectRatio,
        comfyuiParams: record.comfyuiParams,
      },
      controller.signal,
      async (picBase64: string) => {
        if (controller.signal.aborted) {
          return
        }

        const storageKey = StorageKeyGenerator.picture(`image-gen:${recordId}`)
        await storage.setBlob(storageKey, picBase64)

        if (controller.signal.aborted) {
          return
        }

        currentRecord = await addGeneratedImage(recordId, storageKey)
        setRecordQueryData(currentRecord)
        invalidateHistoryQuery()
      },
      async ({ providerJobId, queueNumber }) => {
        currentRecord = await updateRecord(recordId, {
          providerJobId: providerJobId ?? currentRecord?.providerJobId,
          queueNumber: queueNumber ?? currentRecord?.queueNumber,
        })
        setRecordQueryData(currentRecord)
      }
    )

    currentRecord = await updateRecord(recordId, {
      status: 'done',
      finishedAt: Date.now(),
    })
    setRecordQueryData(currentRecord)

    log.debug('Image generation completed:', recordId)
  } catch (err: unknown) {
    const error = !(err instanceof Error) ? new Error(`${err}`) : err

    if (isAbortError(err)) {
      const cancelledRecord = await updateRecord(recordId, {
        status: 'cancelled',
        error: CANCELLED_ERROR_MESSAGE,
        finishedAt: Date.now(),
      })
      setRecordQueryData(cancelledRecord)
      log.debug('Image generation cancelled:', recordId)
      return
    }

    log.error('Image generation failed:', error)

    const errorCode = err instanceof ChatboxAIAPIError ? err.code : undefined
    const updatedRecord = await updateRecord(recordId, {
      status: 'error',
      error: error.message,
      errorCode,
      finishedAt: Date.now(),
    })
    setRecordQueryData(updatedRecord)
  }
}

export interface GenerateImageParams {
  prompt: string
  referenceImages: string[]
  model: ImageGenerationModel
  dalleStyle?: 'vivid' | 'natural'
  imageGenerateNum?: number
  aspectRatio?: string
  parentIds?: string[]
  comfyuiParams?: ComfyUIGenerationParams
}

export function isGenerating(): boolean {
  return imageGenerationStore.getState().activeGenerationId !== null
}

export async function createAndGenerate(params: GenerateImageParams): Promise<string> {
  const record = await createRecord({
    prompt: params.prompt,
    referenceImages: params.referenceImages,
    model: params.model,
    dalleStyle: params.dalleStyle,
    imageGenerateNum: params.imageGenerateNum,
    parentIds: params.parentIds,
    aspectRatio: params.aspectRatio,
    comfyuiParams: params.comfyuiParams,
  })

  const store = imageGenerationStore.getState()
  store.enqueueGenerationId(record.id)
  store.setCurrentRecordId(record.id)

  setRecordQueryData(record)
  invalidateHistoryQuery()
  void processNextGeneration()

  return record.id
}

export function resumeQueuedGenerations(): void {
  void processNextGeneration()
}

export async function cancelGeneration(recordId?: string): Promise<void> {
  const store = imageGenerationStore.getState()
  const targetRecordId = recordId ?? store.activeGenerationId

  if (!targetRecordId) {
    return
  }

  if (store.activeGenerationId === targetRecordId) {
    const record = await getImageGenerationRecord(targetRecordId)
    const controller = activeControllers.get(targetRecordId)
    controller?.abort()
    await interruptComfyUI(record)
    return
  }

  if (store.queuedGenerationIds.includes(targetRecordId)) {
    store.removeQueuedGenerationId(targetRecordId)
    await markQueuedRecordCancelled(targetRecordId, 'Generation cancelled before it started')
  }
}

export async function removeQueuedGeneration(recordId: string): Promise<void> {
  const store = imageGenerationStore.getState()

  if (store.activeGenerationId === recordId) {
    throw new Error('Active generations must be cancelled before deletion.')
  }

  store.removeQueuedGenerationId(recordId)
  await deleteRecord(recordId)
  invalidateHistoryQuery()
}

export async function loadRecord(recordId: string): Promise<ImageGeneration | null> {
  const record = await getImageGenerationRecord(recordId)
  if (record) {
    imageGenerationStore.getState().setCurrentRecordId(record.id)
  }
  return record
}

export function clearCurrentRecord(): void {
  imageGenerationStore.getState().setCurrentRecordId(null)
}

export async function retryGeneration(recordId: string): Promise<void> {
  const record = await getImageGenerationRecord(recordId)
  if (!record) {
    throw new Error('Record not found')
  }

  const store = imageGenerationStore.getState()
  if (store.activeGenerationId === recordId || store.queuedGenerationIds.includes(recordId)) {
    return
  }

  const updatedRecord = await updateRecord(recordId, {
    status: 'queued',
    generatedImages: [],
    error: undefined,
    errorCode: undefined,
    providerJobId: undefined,
    queueNumber: undefined,
    startedAt: undefined,
    finishedAt: undefined,
  })
  setRecordQueryData(updatedRecord)

  store.enqueueGenerationId(recordId)
  store.setCurrentRecordId(recordId)
  invalidateHistoryQuery()
  void processNextGeneration()
}
