const COMFYUI_FILE_EXTENSIONS = /\.(safetensors|ckpt)$/i

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
    (option) => stripComfyUIFileExtension(normalizeOptionValue(option)) === strippedValue,
  )

  if (basenameMatches.length === 1) {
    return basenameMatches[0]
  }

  return value
}
