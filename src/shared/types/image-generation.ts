import { z } from 'zod'

// Image generation record status
export const ImageGenerationStatusSchema = z.enum(['queued', 'generating', 'done', 'error', 'cancelled'])
export type ImageGenerationStatus = z.infer<typeof ImageGenerationStatusSchema>

// Model info for image generation
export const ImageGenerationModelSchema = z.object({
  provider: z.string(),
  modelId: z.string(),
})
export type ImageGenerationModel = z.infer<typeof ImageGenerationModelSchema>

// ComfyUI generation params stored for retry
export const ComfyUIStoredParamsSchema = z
  .object({
    checkpoint: z.string().optional(),
    loras: z
      .array(
        z.object({
          name: z.string(),
          strengthModel: z.number().optional(),
          strengthClip: z.number().optional(),
        })
      )
      .optional(),
    lora: z.string().optional(),
    loraStrength: z.number().optional(),
    negativePrompt: z.string().optional(),
    steps: z.number().optional(),
    cfg: z.number().optional(),
    samplerName: z.string().optional(),
    scheduler: z.string().optional(),
    orientation: z.enum(['vertical', 'horizontal']).optional(),
    upscale: z.boolean().optional(),
    seed: z.number().optional(),
  })
  .optional()
  .catch(undefined)

// Image generation record schema
export const ImageGenerationSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  referenceImages: z.array(z.string()), // storage keys
  generatedImages: z.array(z.string()), // storage keys
  createdAt: z.number(),
  startedAt: z.number().optional(),
  finishedAt: z.number().optional(),
  model: ImageGenerationModelSchema,
  dalleStyle: z.enum(['vivid', 'natural']).optional(),
  imageGenerateNum: z.number().optional(),
  aspectRatio: z.string().optional(),
  comfyuiParams: ComfyUIStoredParamsSchema,
  status: ImageGenerationStatusSchema,
  providerJobId: z.string().optional(),
  queueNumber: z.number().optional(),
  parentIds: z.array(z.string()).optional(), // for tracking iteration DAG (multiple parents possible)
  /** Optional chat origin so completed images can attach back to the assistant message. */
  origin: z
    .object({
      sessionId: z.string(),
      messageId: z.string(),
    })
    .optional()
    .catch(undefined),
  error: z.string().optional(),
  errorCode: z.number().optional(), // legacy provider API error code
})
export type ImageGeneration = z.infer<typeof ImageGenerationSchema>

// Pagination result
export interface ImageGenerationPage {
  items: ImageGeneration[]
  nextCursor: number | null
  total: number
}
