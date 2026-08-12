import { tool, type ToolSet } from 'ai'
import z from 'zod'
import { ModelProviderEnum, type Message, type ProviderInfo } from '@shared/types'
import { isImageEditModel, isImageGenerationModel } from '@shared/utils/image-model-capabilities'
import { createAndGenerate, createAndGenerateAndWait } from '@/stores/imageGenerationActions'
import { lastUsedModelStore } from '@/stores/lastUsedModelStore'
import { settingsStore } from '@/stores/settingsStore'
import { listAvailableImageModels } from '@/utils/available-image-models'

const COMFYUI_AGENT_MODEL_ID = 'comfyui-txt2img'

const toolSetDescription = `
## generate_image
Generate a new image or edit an existing one using the configured image model.
- Use operation "generate" for text-to-image with no source image.
- Use operation "edit" when the user attached an image or asked to update a previous image.
- Prefer referenceHandle "latest" or "current-attachment-1" when editing.
- Do not invent storage keys. Use only handles listed in the image catalog.
- Wait for the tool result; images will appear inline in chat and in Image Creator history.
`

const generateImageInputSchema = z.object({
  prompt: z.string().min(1).describe('Natural language image prompt or edit instruction.'),
  operation: z
    .enum(['generate', 'edit'])
    .optional()
    .describe('generate = text-to-image; edit = transform a reference image. Defaults to edit when a reference is available.'),
  referenceHandle: z
    .string()
    .optional()
    .describe('Image handle from the catalog: latest, current-attachment-1, message:<id>:image:1, etc.'),
  aspectRatio: z.string().optional().describe('Optional aspect ratio such as 1:1, 16:9, vertical, horizontal, or auto.'),
  note: z.string().optional().describe('Optional short note for the user about the generation choice.'),
})

export type ChatImageHandle = {
  handle: string
  storageKey: string
  label: string
  source: 'current-attachment' | 'assistant' | 'user-history'
  messageId?: string
}

export type GenerateImageToolContext = {
  sessionId?: string
  /** Assistant message that will receive generated images. */
  messageId?: string
  /** Catalog of images available for editing in this turn. */
  imageCatalog?: ChatImageHandle[]
  /** Wait for completion and return storage keys (default true for chat). */
  waitForCompletion?: boolean
  /** When true, keep ComfyUI-only Danbooru agent behavior for specialized agent flow. */
  comfyuiAgentMode?: boolean
}

function resolveDefaultImageModel(providers: ProviderInfo[]): { provider: string; modelId: string } | null {
  const available = listAvailableImageModels(providers)
  if (available.length === 0) return null

  const lastUsed = lastUsedModelStore.getState().picture
  if (lastUsed) {
    const match = available.find((m) => m.providerId === lastUsed.provider && m.modelId === lastUsed.modelId)
    if (match) {
      return { provider: match.providerId, modelId: match.modelId }
    }
  }

  // Prefer models that support both generate + edit when possible
  for (const candidate of available) {
    const provider = providers.find((p) => p.id === candidate.providerId)
    const modelInfo = (provider?.models || provider?.defaultSettings?.models || []).find(
      (m) => m.modelId === candidate.modelId
    )
    if (isImageEditModel(modelInfo || { modelId: candidate.modelId })) {
      return { provider: candidate.providerId, modelId: candidate.modelId }
    }
  }

  return { provider: available[0].providerId, modelId: available[0].modelId }
}

function resolveReferenceStorageKey(
  catalog: ChatImageHandle[],
  handle: string | undefined,
  operation: 'generate' | 'edit'
): string | undefined {
  if (!catalog.length) return undefined
  if (handle) {
    const exact = catalog.find((item) => item.handle === handle)
    if (exact) return exact.storageKey
    // tolerate "latest" aliases
    if (handle === 'latest' || handle === 'previous' || handle === 'previous-image') {
      return catalog[0]?.storageKey
    }
  }
  if (operation === 'edit') {
    return catalog[0]?.storageKey
  }
  return undefined
}

/**
 * Build a bounded catalog from conversation messages for image editing.
 * Priority: current user attachments first, then newest assistant images, then older user images.
 */
export function buildChatImageCatalog(messages: Message[], options?: { limit?: number }): ChatImageHandle[] {
  const limit = options?.limit ?? 12
  const catalog: ChatImageHandle[] = []
  const seen = new Set<string>()

  const push = (item: ChatImageHandle) => {
    if (!item.storageKey || seen.has(item.storageKey)) return
    seen.add(item.storageKey)
    catalog.push(item)
  }

  // Current turn attachments (last user message)
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg.role !== 'user') continue
    let index = 0
    for (const part of msg.contentParts || []) {
      if (part.type !== 'image' || !part.storageKey) continue
      index += 1
      push({
        handle: `current-attachment-${index}`,
        storageKey: part.storageKey,
        label: `Current attachment ${index}`,
        source: 'current-attachment',
        messageId: msg.id,
      })
    }
    break
  }

  // Newest-first history for assistant then user images
  for (let i = messages.length - 1; i >= 0 && catalog.length < limit; i--) {
    const msg = messages[i]
    if (msg.role !== 'assistant' && msg.role !== 'user') continue
    let index = 0
    for (const part of msg.contentParts || []) {
      if (part.type !== 'image' || !part.storageKey) continue
      index += 1
      push({
        handle: `message:${msg.id}:image:${index}`,
        storageKey: part.storageKey,
        label: msg.role === 'assistant' ? `Assistant image ${index}` : `User image ${index}`,
        source: msg.role === 'assistant' ? 'assistant' : 'user-history',
        messageId: msg.id,
      })
      if (catalog.length >= limit) break
    }
  }

  // Alias for latest image
  if (catalog.length > 0) {
    const latest = catalog[0]
    if (!catalog.some((c) => c.handle === 'latest')) {
      catalog.unshift({
        ...latest,
        handle: 'latest',
        label: `Latest image (${latest.label})`,
      })
    }
  }

  return catalog.slice(0, limit)
}

export function formatImageCatalogInstructions(catalog: ChatImageHandle[]): string {
  if (catalog.length === 0) {
    return 'No reference images are available in this turn. Use operation "generate" for text-to-image.'
  }
  const lines = catalog.map((item) => `- ${item.handle}: ${item.label}`)
  return [
    'Available image handles for editing (prefer these exact handles):',
    ...lines,
    'Default for edit without a handle: latest.',
  ].join('\n')
}

/** Legacy ComfyUI agent-flow helper used by generation.ts fallback. */
export async function startComfyUIAgentGeneration(input: {
  prompt: string
  aspectRatio?: 'vertical' | 'horizontal'
  note?: string
  citations?: string[]
}) {
  const comfyuiSettings = settingsStore.getState().providers?.[ModelProviderEnum.ComfyUI]

  if (!comfyuiSettings?.comfyuiCheckpoint?.trim()) {
    throw new Error('ComfyUI checkpoint is not configured. Go to Settings -> Providers -> ComfyUI and select one.')
  }

  const recordId = await createAndGenerate({
    prompt: input.prompt.trim(),
    referenceImages: [],
    model: {
      provider: ModelProviderEnum.ComfyUI,
      modelId: COMFYUI_AGENT_MODEL_ID,
    },
    imageGenerateNum: 1,
    aspectRatio: input.aspectRatio || 'vertical',
  })

  return {
    recordId,
    status: 'started',
    provider: ModelProviderEnum.ComfyUI,
    modelId: COMFYUI_AGENT_MODEL_ID,
    note: input.note,
    citations: input.citations,
  }
}

export function createGenerateImageTool(context: GenerateImageToolContext = {}) {
  return tool({
    description:
      'Generate a new image or edit an existing image. Use for create/draw/paint requests and for edit/update/restyle of attached or previous images.',
    inputSchema: generateImageInputSchema,
    execute: async (input: {
      prompt: string
      operation?: 'generate' | 'edit'
      referenceHandle?: string
      aspectRatio?: string
      note?: string
    }) => {
      const settings = settingsStore.getState()
      const providers = (settings.providers
        ? Object.entries(settings.providers).map(([id, providerSettings]) => ({
            id,
            name: id,
            models: providerSettings?.models,
            defaultSettings: undefined,
            isCustom: false,
            type: undefined,
          }))
        : []) as unknown as ProviderInfo[]

      // Prefer full provider list from settings when available via SystemProviders merge in listAvailableImageModels
      const { SystemProviders } = await import('@shared/defaults')
      const baseProviders = SystemProviders() as ProviderInfo[]
      const mergedProviders: ProviderInfo[] = baseProviders.map((base) => ({
        ...base,
        models: settings.providers?.[base.id]?.models || base.defaultSettings?.models,
      }))
      for (const custom of settings.customProviders || []) {
        mergedProviders.push({
          ...custom,
          models: settings.providers?.[custom.id]?.models || custom.defaultSettings?.models,
        } as ProviderInfo)
      }

      if (context.comfyuiAgentMode) {
        return await startComfyUIAgentGeneration({
          prompt: input.prompt,
          aspectRatio: input.aspectRatio === 'horizontal' || input.aspectRatio === 'vertical' ? input.aspectRatio : 'vertical',
          note: input.note,
        })
      }

      const model = resolveDefaultImageModel(mergedProviders.length ? mergedProviders : providers)
      if (!model) {
        throw new Error(
          'No image-generation model is configured. Open Settings → Providers and add an image model (OpenAI gpt-image-*, Gemini image, xAI grok-imagine-image, or ComfyUI).'
        )
      }

      const catalog = context.imageCatalog || []
      const hasCurrentAttachment = catalog.some((c) => c.source === 'current-attachment')
      const effectiveOperation: 'generate' | 'edit' =
        input.operation ||
        (input.referenceHandle || hasCurrentAttachment ? 'edit' : 'generate')

      const referenceKey = resolveReferenceStorageKey(catalog, input.referenceHandle, effectiveOperation)
      if (effectiveOperation === 'edit' && !referenceKey) {
        throw new Error(
          'Edit requires a reference image. Attach an image or pass referenceHandle (e.g. "latest" or "current-attachment-1").'
        )
      }

      // Capability gate for edit
      if (effectiveOperation === 'edit') {
        const provider = mergedProviders.find((p) => p.id === model.provider)
        const modelInfo = (provider?.models || provider?.defaultSettings?.models || []).find(
          (m) => m.modelId === model.modelId
        )
        if (modelInfo && !isImageEditModel(modelInfo) && !isImageGenerationModel(modelInfo)) {
          throw new Error(`Selected image model "${model.modelId}" does not support image editing.`)
        }
      }

      const wait = context.waitForCompletion !== false
      const origin =
        context.sessionId && context.messageId
          ? { sessionId: context.sessionId, messageId: context.messageId }
          : undefined

      if (!wait) {
        const recordId = await createAndGenerate({
          prompt: input.prompt.trim(),
          referenceImages: referenceKey ? [referenceKey] : [],
          model,
          imageGenerateNum: 1,
          aspectRatio: input.aspectRatio || 'auto',
          origin,
        })
        return {
          recordId,
          status: 'started',
          operation: effectiveOperation,
          provider: model.provider,
          modelId: model.modelId,
          note: input.note,
        }
      }

      const record = await createAndGenerateAndWait({
        prompt: input.prompt.trim(),
        referenceImages: referenceKey ? [referenceKey] : [],
        model,
        imageGenerateNum: 1,
        aspectRatio: input.aspectRatio || 'auto',
        origin,
      })

      if (record.status === 'error') {
        throw new Error(record.error || 'Image generation failed')
      }
      if (record.status === 'cancelled') {
        throw new Error('Image generation was cancelled')
      }

      return {
        recordId: record.id,
        status: record.status,
        operation: effectiveOperation,
        provider: model.provider,
        modelId: model.modelId,
        generatedImages: record.generatedImages,
        note: input.note,
      }
    },
  })
}

/** Static tool kept for approval wrappers / legacy imports; prefers generic factory at call sites. */
export const generateImageTool = createGenerateImageTool({ waitForCompletion: true })

export function createGenerateImageToolSet(context: GenerateImageToolContext = {}): {
  description: string
  tools: ToolSet
} {
  return {
    description: toolSetDescription,
    tools: {
      generate_image: createGenerateImageTool(context),
    },
  }
}

export default {
  description: toolSetDescription,
  tools: {
    generate_image: generateImageTool,
  },
}
