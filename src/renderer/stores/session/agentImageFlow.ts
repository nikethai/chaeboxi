function stripLabelPrefix(value: string): string {
  return value
    .trim()
    .replace(/^[-*]\s+/, '')
    .replace(/^\d+\.\s+/, '')
    .replace(/^(?:final(?:\s+tags?)?|normalized|danbooru(?:-style)?|tag(?: list)?|prompt)\s*:\s*/i, '')
    .trim()
}

function isJsonLikeCandidate(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) {
    return false
  }

  if (/^[\[{]/.test(trimmed)) {
    return true
  }

  if (/\\+"/.test(trimmed)) {
    return true
  }

  if (/"\s*:\s*"/.test(trimmed) || /"\s*:\s*[\[{0-9-]/.test(trimmed)) {
    return true
  }

  if (/(?:^|\n)\s*"?(?:prompt|negative_prompt|steps|cfg|seed|width|height)"?\s*:/i.test(trimmed)) {
    return true
  }

  return false
}

function normalizeTagListCandidate(value: string): string | null {
  const cleaned = value
    .replace(/```[\w-]*\n?/g, '')
    .replace(/```/g, '')
    .trim()

  if (!cleaned || isJsonLikeCandidate(cleaned)) {
    return null
  }

  const parts = cleaned
    .split(/[\n,]+/)
    .map(stripLabelPrefix)
    .filter(Boolean)

  if (parts.length < 4) {
    return null
  }

  const normalized = parts.join(', ')
  if (/(here is|here are|based on|i found|research|analysis|json snippet|basic node setup)/i.test(normalized)) {
    return null
  }
  if (/[{}[\]"]/g.test(normalized)) {
    return null
  }
  if (/[.!?]\s+[A-Z]/.test(normalized)) {
    return null
  }
  if (/(?:^|,)\s*(?:prompt|negative_prompt|steps|cfg|seed|width|height)\s*:/i.test(normalized)) {
    return null
  }

  return normalized
}

export function extractDanbooruTagListFromText(text: string): string | null {
  const trimmed = text.trim()
  if (!trimmed) {
    return null
  }

  const fencedMatches = Array.from(trimmed.matchAll(/```(?:[\w-]+)?\n([\s\S]*?)```/g))
    .map((match) => normalizeTagListCandidate(match[1] || ''))
    .filter((candidate): candidate is string => Boolean(candidate))
  if (fencedMatches.length > 0) {
    return fencedMatches.at(-1) || null
  }

  const paragraphs = trimmed
    .split(/\n\s*\n/)
    .map((paragraph) => normalizeTagListCandidate(paragraph))
    .filter((candidate): candidate is string => Boolean(candidate))
  if (paragraphs.length > 0) {
    return paragraphs.at(-1) || null
  }

  const lines = trimmed
    .split('\n')
    .map((line) => normalizeTagListCandidate(line))
    .filter((candidate): candidate is string => Boolean(candidate))
  if (lines.length > 0) {
    return lines.at(-1) || null
  }

  return normalizeTagListCandidate(trimmed)
}
