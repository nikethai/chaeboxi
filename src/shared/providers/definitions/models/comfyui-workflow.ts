import type { ComfyUIGenerationParams, ComfyUIWorkflow } from './comfyui-types'

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

  // Negative prompt (connected to checkpoint CLIP directly)
  '7': {
    inputs: {
      text: DEFAULT_NEGATIVE_PROMPT,
      clip: ['4', 1],
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
 */
export function buildComfyUIWorkflow(
  params: ComfyUIGenerationParams & { prompt: string },
): ComfyUIWorkflow {
  const workflow = structuredClone(WORKFLOW_TEMPLATE)

  // Checkpoint
  if (params.checkpoint) {
    workflow['4'].inputs.ckpt_name = params.checkpoint
  }

  // LoRA
  if (params.lora && params.lora !== 'none') {
    workflow['58'].inputs.lora_name = params.lora
    workflow['58'].inputs.strength_model = params.loraStrength ?? 1
    workflow['58'].inputs.strength_clip = params.loraStrength ?? 1
  } else if (params.lora === 'none') {
    // Bypass LoRA: connect checkpoint directly to ImpactWildcardEncode
    workflow['22'].inputs.model = ['4', 0]
    workflow['22'].inputs.clip = ['4', 1]
    // Remove LoRA node to avoid errors
    delete workflow['58']
  }

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

  // Orientation: switch which EmptyLatentImage is connected to KSampler
  if (params.orientation === 'horizontal') {
    workflow['3'].inputs.latent_image = ['13', 0]
  } else {
    workflow['3'].inputs.latent_image = ['5', 0]
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

  // Remove unused latent node to keep workflow clean
  if (params.orientation === 'horizontal') {
    delete workflow['5']
  } else {
    delete workflow['13']
  }

  return workflow
}
