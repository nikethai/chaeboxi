import type { MemoryEntry } from '@shared/types/memory'

export function getComposerSelectionOrDraft(input: HTMLTextAreaElement | null, draft: string): string {
  const start = input?.selectionStart ?? 0
  const end = input?.selectionEnd ?? 0
  const selection = input?.value.slice(start, end).trim()
  return selection || draft.trim()
}

export function getActiveMemoryMentionQuery(text: string, caret?: number): string | null {
  const pos = caret ?? text.length
  const before = text.slice(0, pos)
  const match = before.match(/(?:^|[\s([{])@(?:mem|memory)(?:\s+([^\n@]*))?$/i)
  return match ? (match[1] || '').trim() : null
}

export function stripActiveMemoryMention(text: string, caret?: number): string {
  const pos = caret ?? text.length
  const before = text.slice(0, pos)
  const after = text.slice(pos)
  const cleaned = before.replace(/(?:^|[\s([{])@(?:mem|memory)(?:\s+[^\n@]*)?$/i, (match) => {
    return /^[\s([{]/.test(match) ? match[0] : ''
  })

  return (cleaned + after)
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim()
}

export function getMemoryTags(entries: MemoryEntry[]): string[] {
  return Array.from(
    new Set(
      entries
        .filter((entry) => entry.enabled && !entry.archived)
        .flatMap((entry) => entry.tags.map((tag) => tag.trim()))
    )
  )
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right))
}

export function filterMemoryEntriesByTag(entries: MemoryEntry[], tag: string | null): MemoryEntry[] {
  if (!tag) return entries
  return entries.filter((entry) => entry.tags.includes(tag))
}
