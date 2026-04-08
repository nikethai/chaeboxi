import { tool } from 'ai'
import z from 'zod'
import { ModelProviderEnum } from '@shared/types'
import { router } from '@/router'
import { createAndGenerate } from '@/stores/imageGenerationActions'
import { settingsStore } from '@/stores/settingsStore'

const COMFYUI_AGENT_MODEL_ID = 'comfyui-txt2img'

const toolSetDescription = `
## generate_image
Generate an image with ComfyUI using a finalized Danbooru-style tag list. Call this only after research and tag normalization are complete.
`

const generateImageInputSchema = z.object({
  prompt: z.string().min(1).describe('Final normalized comma-separated Danbooru-style tag list.'),
  aspectRatio: z.enum(['vertical', 'horizontal']).optional().describe('Optional orientation for the ComfyUI run.'),
  note: z.string().optional().describe('Optional note about the research rationale or synthesis.'),
  citations: z.array(z.string().url()).optional().describe('Optional source URLs used during research.'),
})

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

  await router.navigate({ to: '/image-creator' })

  return {
    recordId,
    status: 'started',
    provider: ModelProviderEnum.ComfyUI,
    modelId: COMFYUI_AGENT_MODEL_ID,
    note: input.note,
    citations: input.citations,
  }
}

export const generateImageTool = tool({
  description:
    'Generate an image with ComfyUI using the final normalized Danbooru-style tag list. Use this after research and normalization are complete.',
  inputSchema: generateImageInputSchema,
  execute: async (input: {
    prompt: string
    aspectRatio?: 'vertical' | 'horizontal'
    note?: string
    citations?: string[]
  }) => {
    return await startComfyUIAgentGeneration(input)
  },
})

export default {
  description: toolSetDescription,
  tools: {
    generate_image: generateImageTool,
  },
}
