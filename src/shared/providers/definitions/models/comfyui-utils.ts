import type { ComfyUIGenerationParams, ComfyUILoraConfig } from './comfyui-types'

const COMFYUI_FILE_EXTENSIONS = /\.(safetensors|ckpt)$/i
export const DEFAULT_COMFYUI_LORA_STRENGTH = 1

function normalizeOptionValue(value: string): string {
  return value.trim().toLowerCase()
}

function stripComfyUIFileExtension(value: string): string {
  return value.replace(COMFYUI_FILE_EXTENSIONS, '')
}

export function resolveComfyUIOption(value: string | undefined, options: string[]): string | undefined {
  if (!value) return value

  const trimmedValue = value.trim()
  if (!trimmedValue) return value

  const exactMatch = options.find((option) => option === trimmedValue)
  if (exactMatch) return exactMatch

  const normalizedValue = normalizeOptionValue(trimmedValue)
  const caseInsensitiveMatch = options.find((option) => normalizeOptionValue(option) === normalizedValue)
  if (caseInsensitiveMatch) return caseInsensitiveMatch

  const strippedValue = stripComfyUIFileExtension(normalizedValue)
  const basenameMatches = options.filter(
    (option) => stripComfyUIFileExtension(normalizeOptionValue(option)) === strippedValue
  )

  if (basenameMatches.length === 1) {
    return basenameMatches[0]
  }

  return value
}

export function normalizeComfyUILoras(
  params: Pick<ComfyUIGenerationParams, 'loras' | 'lora' | 'loraStrength'>
): ComfyUILoraConfig[] {
  const configuredLoras =
    params.loras && params.loras.length > 0
      ? params.loras
      : params.lora && params.lora !== 'none'
        ? [
            {
              name: params.lora,
              strengthModel: params.loraStrength,
              strengthClip: params.loraStrength,
            },
          ]
        : []

  return configuredLoras
    .map((lora) => ({
      name: lora.name.trim(),
      strengthModel: lora.strengthModel ?? DEFAULT_COMFYUI_LORA_STRENGTH,
      strengthClip: lora.strengthClip ?? lora.strengthModel ?? DEFAULT_COMFYUI_LORA_STRENGTH,
    }))
    .filter((lora) => lora.name && lora.name !== 'none')
}
