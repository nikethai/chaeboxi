import type { ComfyUIGenerationParams, ComfyUIWorkflow } from './comfyui-types'
import { DEFAULT_COMFYUI_LORA_STRENGTH, normalizeComfyUILoras } from './comfyui-utils'

/**
 * Default negative prompt from the mah-v2 workflow.
 */
export const DEFAULT_NEGATIVE_PROMPT =
  'embedding:lazyneg, worst_quality, bad_quality, watermark, username, signature, twitter_username, patreon_username, pixiv_username, artist_name, artist_logo, artist_socials, logo, speech_bubble, text, glossy skin'

export const COMFYUI_WILDCARD_PLACEHOLDER = 'Select the Wildcard to add to the text'

/**
 * mah-v2 workflow pre-converted to ComfyUI API format.
 *
 * Key nodes:
 * - 4:  CheckpointLoaderSimple (checkpoint selection)
 * - 58: LoraLoader (LoRA selection + strength)
 * - 22: ImpactWildcardEncode (positive prompt / tags)
 * - 7:  CLIPTextEncode (negative prompt)
 * - 3:  KSampler (sampling params)
 * - 5:  EmptyLatentImage (vertical: 1248×1824)
 * - 13: EmptyLatentImage (horizontal: 1824×1248)
 * - 8:  VAEDecode
 * - 12: ImageUpscaleWithModel (R-ESRGAN 4x+ Anime6B)
 * - 10: UpscaleModelLoader
 * - 9:  SaveImage (output)
 */
const WORKFLOW_TEMPLATE: ComfyUIWorkflow = {
  // Checkpoint loader
  '4': {
    inputs: {
      ckpt_name: '',
    },
    class_type: 'CheckpointLoaderSimple',
  },

  // LoRA loader (connected to checkpoint outputs)
  '58': {
    inputs: {
      lora_name: 'none',
      strength_model: 1,
      strength_clip: 1,
      model: ['4', 0],
      clip: ['4', 1],
    },
    class_type: 'LoraLoader',
  },

  // Positive prompt via ImpactWildcardEncode (with LoRA model/clip)
  '22': {
    inputs: {
      wildcard_text: '',
      populated_text: '',
      mode: true,
      'Select to add LoRA': 'Select the LoRA to add to the text',
      'Select to add Wildcard': COMFYUI_WILDCARD_PLACEHOLDER,
      seed: 0,
      model: ['58', 0],
      clip: ['58', 1],
    },
    class_type: 'ImpactWildcardEncode',
  },

  // Negative prompt (connected to the final CLIP source)
  '7': {
    inputs: {
      text: DEFAULT_NEGATIVE_PROMPT,
      clip: ['58', 1],
    },
    class_type: 'CLIPTextEncode',
  },

  // Empty latent image — vertical (1248×1824)
  '5': {
    inputs: {
      width: 1248,
      height: 1824,
      batch_size: 1,
    },
    class_type: 'EmptyLatentImage',
  },

  // Empty latent image — horizontal (1824×1248)
  '13': {
    inputs: {
      width: 1824,
      height: 1248,
      batch_size: 1,
    },
    class_type: 'EmptyLatentImage',
  },

  // KSampler (connected to ImpactWildcardEncode model/conditioning + negative + latent)
  '3': {
    inputs: {
      seed: 0,
      steps: 29,
      cfg: 4.9,
      sampler_name: 'euler_ancestral',
      scheduler: 'simple',
      denoise: 1,
      model: ['22', 0],
      positive: ['22', 2],
      negative: ['7', 0],
      latent_image: ['5', 0], // vertical by default
    },
    class_type: 'KSampler',
  },

  // VAE decode (latent → image)
  '8': {
    inputs: {
      samples: ['3', 0],
      vae: ['4', 2],
    },
    class_type: 'VAEDecode',
  },

  // Upscale model loader
  '10': {
    inputs: {
      model_name: 'R-ESRGAN 4x+ Anime6B.pth',
    },
    class_type: 'UpscaleModelLoader',
  },

  // Image upscale with model (connected to VAEDecode output + upscale model)
  '12': {
    inputs: {
      upscale_model: ['10', 0],
      image: ['8', 0],
    },
    class_type: 'ImageUpscaleWithModel',
  },

  // Save image (output node)
  '9': {
    inputs: {
      filename_prefix: 'Chaeboxi',
      images: ['8', 0], // Default: no upscale, directly from VAEDecode
    },
    class_type: 'SaveImage',
  },
}

/**
 * Build a ComfyUI API-format workflow by patching the template with generation parameters.
 * When `referenceImageName` is set, uses LoadImage + VAEEncode img2img instead of EmptyLatentImage.
 */
export function buildComfyUIWorkflow(
  params: ComfyUIGenerationParams & { prompt: string; referenceImageName?: string; denoise?: number }
): ComfyUIWorkflow {
  const workflow = structuredClone(WORKFLOW_TEMPLATE)
  const loras = normalizeComfyUILoras(params)

  // Checkpoint
  if (params.checkpoint) {
    workflow['4'].inputs.ckpt_name = params.checkpoint
  }

  let modelSource: [string, number] = ['4', 0]
  let clipSource: [string, number] = ['4', 1]

  // LoRAs
  if (loras.length > 0) {
    loras.forEach((lora, index) => {
      const nodeId = String(58 + index)

      workflow[nodeId] = {
        inputs: {
          lora_name: lora.name,
          strength_model: lora.strengthModel ?? DEFAULT_COMFYUI_LORA_STRENGTH,
          strength_clip: lora.strengthClip ?? DEFAULT_COMFYUI_LORA_STRENGTH,
          model: modelSource,
          clip: clipSource,
        },
        class_type: 'LoraLoader',
      }

      modelSource = [nodeId, 0]
      clipSource = [nodeId, 1]
    })
  } else {
    delete workflow['58']
  }

  workflow['22'].inputs.model = modelSource
  workflow['22'].inputs.clip = clipSource
  workflow['7'].inputs.clip = clipSource

  // Positive prompt (user's tags)
  workflow['22'].inputs.wildcard_text = params.prompt
  workflow['22'].inputs.populated_text = params.prompt

  // Negative prompt
  if (params.negativePrompt !== undefined) {
    workflow['7'].inputs.text = params.negativePrompt
  }

  // KSampler params
  workflow['3'].inputs.seed = params.seed ?? Math.floor(Math.random() * 2 ** 32)
  if (params.steps !== undefined) workflow['3'].inputs.steps = params.steps
  if (params.cfg !== undefined) workflow['3'].inputs.cfg = params.cfg
  if (params.samplerName) workflow['3'].inputs.sampler_name = params.samplerName
  if (params.scheduler) workflow['3'].inputs.scheduler = params.scheduler

  if (params.referenceImageName) {
    // img2img: LoadImage → VAEEncode → KSampler
    workflow['100'] = {
      inputs: {
        image: params.referenceImageName,
      },
      class_type: 'LoadImage',
    }
    workflow['101'] = {
      inputs: {
        pixels: ['100', 0],
        vae: ['4', 2],
      },
      class_type: 'VAEEncode',
    }
    workflow['3'].inputs.latent_image = ['101', 0]
    workflow['3'].inputs.denoise = params.denoise ?? 0.65
    delete workflow['5']
    delete workflow['13']
  } else if (params.orientation === 'horizontal') {
    // Orientation: switch which EmptyLatentImage is connected to KSampler
    workflow['3'].inputs.latent_image = ['13', 0]
    delete workflow['5']
  } else {
    workflow['3'].inputs.latent_image = ['5', 0]
    delete workflow['13']
  }

  // Upscale toggle
  if (params.upscale) {
    // Wire upscaler output to SaveImage
    workflow['9'].inputs.images = ['12', 0]
  } else {
    // Wire VAEDecode directly to SaveImage (skip upscaler)
    workflow['9'].inputs.images = ['8', 0]
    // Remove upscale nodes to keep workflow clean
    delete workflow['10']
    delete workflow['12']
  }

  return workflow
}
