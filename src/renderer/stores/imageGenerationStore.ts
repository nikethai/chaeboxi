import type { ImageGeneration } from '@shared/types'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { v4 as uuidv4 } from 'uuid'
import { createStore, useStore } from 'zustand'
import { getLogger } from '@/lib/utils'
import platform from '@/platform'
import type { ImageGenerationStorage } from '@/storage/ImageGenerationStorage'

const log = getLogger('image-generation-store')
const LEGACY_PENDING_STATUS = 'pending'

interface ImageGenerationUIState {
  activeGenerationId: string | null
  queuedGenerationIds: string[]
  currentRecordId: string | null
  initialized: boolean
}

interface ImageGenerationUIActions {
  setActiveGenerationId: (id: string | null) => void
  setQueuedGenerationIds: (ids: string[]) => void
  enqueueGenerationId: (id: string) => void
  removeQueuedGenerationId: (id: string) => void
  shiftQueuedGenerationId: () => string | null
  setCurrentRecordId: (id: string | null) => void
  setInitialized: (initialized: boolean) => void
}

export const imageGenerationStore = createStore<ImageGenerationUIState & ImageGenerationUIActions>((set) => ({
  activeGenerationId: null,
  queuedGenerationIds: [],
  currentRecordId: null,
  initialized: false,

  setActiveGenerationId: (id) => set({ activeGenerationId: id }),
  setQueuedGenerationIds: (ids) => set({ queuedGenerationIds: ids }),
  enqueueGenerationId: (id) =>
    set((state) => ({
      queuedGenerationIds: state.queuedGenerationIds.includes(id)
        ? state.queuedGenerationIds
        : [...state.queuedGenerationIds, id],
    })),
  removeQueuedGenerationId: (id) =>
    set((state) => ({
      queuedGenerationIds: state.queuedGenerationIds.filter((queuedId) => queuedId !== id),
    })),
  shiftQueuedGenerationId: () => {
    let nextId: string | null = null
    set((state) => {
      nextId = state.queuedGenerationIds[0] ?? null
      return {
        queuedGenerationIds: state.queuedGenerationIds.slice(1),
      }
    })
    return nextId
  },
  setCurrentRecordId: (id) => set({ currentRecordId: id }),
  setInitialized: (initialized) => set({ initialized }),
}))

let storage: ImageGenerationStorage | null = null
let initializePromise: Promise<void> | null = null

function getStorage(): ImageGenerationStorage {
  if (!storage) {
    storage = platform.getImageGenerationStorage()
  }
  return storage
}

async function initializeStore(): Promise<void> {
  const store = imageGenerationStore.getState()
  if (store.initialized) return
  if (initializePromise) {
    await initializePromise
    return
  }

  initializePromise = (async () => {
    try {
      await getStorage().initialize()
      await recoverQueueState()
      imageGenerationStore.getState().setInitialized(true)
      log.debug('Image generation storage initialized')
    } catch (error) {
      log.error('Failed to initialize image generation storage:', error)
      throw error
    }
  })()

  try {
    await initializePromise
  } finally {
    initializePromise = null
  }
}

async function recoverQueueState(): Promise<void> {
  const records = await getStorage().getAll()
  const now = Date.now()

  await Promise.all(
    records
      .filter((record) => record.status === 'generating')
      .map((record) =>
        getStorage().update(record.id, {
          status: 'error',
          error: 'Generation stopped because the app was closed before completion. Retry to run it again.',
          finishedAt: now,
        })
      )
  )

  await Promise.all(
    records
      .filter((record) => record.status === LEGACY_PENDING_STATUS)
      .map((record) =>
        getStorage().update(record.id, {
          status: 'queued',
        })
      )
  )

  const queuedGenerationIds = records
    .filter((record) => record.status === 'queued' || record.status === LEGACY_PENDING_STATUS)
    .sort((left, right) => left.createdAt - right.createdAt)
    .map((record) => record.id)

  const store = imageGenerationStore.getState()
  store.setActiveGenerationId(null)
  store.setQueuedGenerationIds(queuedGenerationIds)
}

export const IMAGE_GEN_QUERY_KEY = 'image-generation'
export const IMAGE_GEN_LIST_QUERY_KEY = 'image-generation-list'

export function useImageGenerationHistory(pageSize: number = 20) {
  return useInfiniteQuery({
    queryKey: [IMAGE_GEN_LIST_QUERY_KEY],
    queryFn: async ({ pageParam = 0 }) => {
      const store = imageGenerationStore.getState()
      if (!store.initialized) {
        await initializeStore()
      }
      return getStorage().getPage(pageParam, pageSize)
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: 0,
    staleTime: 1000 * 60 * 5,
  })
}

export function useImageGenerationRecord(id: string | null) {
  return useQuery({
    queryKey: [IMAGE_GEN_QUERY_KEY, id],
    queryFn: () => {
      if (!id) return null
      return getStorage().getById(id)
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  })
}

export async function createRecord(
  params: Omit<
    ImageGeneration,
    'id' | 'createdAt' | 'generatedImages' | 'status' | 'startedAt' | 'finishedAt' | 'providerJobId' | 'queueNumber'
  >
): Promise<ImageGeneration> {
  const store = imageGenerationStore.getState()
  if (!store.initialized) {
    await initializeStore()
  }

  const record: ImageGeneration = {
    id: uuidv4(),
    createdAt: Date.now(),
    status: 'queued',
    generatedImages: [],
    ...params,
  }
  await getStorage().create(record)
  log.debug('Created image generation record:', record.id)
  return record
}

export async function updateRecord(id: string, updates: Partial<ImageGeneration>): Promise<ImageGeneration | null> {
  const updated = await getStorage().update(id, updates)
  if (!updated) {
    log.info('Record not found for update:', id)
  }
  return updated
}

export async function addGeneratedImage(id: string, storageKey: string): Promise<ImageGeneration | null> {
  const record = await getStorage().getById(id)
  if (!record) {
    log.info('Record not found for adding image:', id)
    return null
  }

  return getStorage().update(id, {
    generatedImages: [...record.generatedImages, storageKey],
  })
}

export async function deleteRecord(id: string): Promise<void> {
  const store = imageGenerationStore.getState()
  if (!store.initialized) {
    await initializeStore()
  }

  await getStorage().delete(id)
  log.debug('Deleted image generation record:', id)

  store.removeQueuedGenerationId(id)

  // Clear current record if it's the one being deleted
  if (store.currentRecordId === id) {
    store.setCurrentRecordId(null)
  }
}

export async function getImageGenerationRecord(id: string): Promise<ImageGeneration | null> {
  const store = imageGenerationStore.getState()
  if (!store.initialized) {
    await initializeStore()
  }

  return getStorage().getById(id)
}

export async function getAllImageGenerationRecords(): Promise<ImageGeneration[]> {
  const store = imageGenerationStore.getState()
  if (!store.initialized) {
    await initializeStore()
  }

  return getStorage().getAll()
}

export function useActiveGenerationId() {
  return useStore(imageGenerationStore, (s) => s.activeGenerationId)
}

export function useQueuedGenerationIds() {
  return useStore(imageGenerationStore, (s) => s.queuedGenerationIds)
}

export function useCurrentGeneratingId() {
  return useActiveGenerationId()
}

export function useCurrentRecordId() {
  return useStore(imageGenerationStore, (s) => s.currentRecordId)
}
