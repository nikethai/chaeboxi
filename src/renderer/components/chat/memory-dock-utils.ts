import type { MemoryEntry } from '@shared/types/memory'

export function getComposerSelectionOrDraft(
  input: HTMLTextAreaElement | HTMLElement | null,
  draft: string
): string {
  if (
    input &&
    typeof (input as HTMLTextAreaElement).value === 'string' &&
    typeof (input as HTMLTextAreaElement).selectionStart === 'number'
  ) {
    const textarea = input as HTMLTextAreaElement
    const start = textarea.selectionStart ?? 0
    const end = textarea.selectionEnd ?? 0
    const selection = textarea.value.slice(start, end).trim()
    return selection || draft.trim()
  }
  // Contenteditable rich composer
  if (input?.isContentEditable && typeof window !== 'undefined' && window.getSelection) {
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0 && input.contains(sel.anchorNode)) {
      const selected = sel.toString().trim()
      if (selected) return selected
    }
  }
  return draft.trim()
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

/** Short slug for inline @mem:label reference (content still attaches via memoryAttachments). */
export function slugifyMemoryLabel(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

/**
 * Replace active @mem / @memory draft with @mem:label token kept in the message.
 * Attachment payload remains separate; this is the Slack-style visible tag.
 */
export function replaceActiveMemoryMentionWithToken(text: string, label: string, caret?: number): string {
  const slug = slugifyMemoryLabel(label) || 'note'
  const pos = caret ?? text.length
  const before = text.slice(0, pos)
  const after = text.slice(pos)
  const replaced = before.replace(/(?:^|[\s([{])@(?:mem|memory)(?:\s+[^\n@]*)?$/i, (match) => {
    const boundary = /^[\s([{]/.test(match) ? match[0] : ''
    return `${boundary}@mem:${slug}`
  })
  const needsSpace = after.length === 0 || !/^\s/.test(after)
  return replaced + (needsSpace ? ' ' : '') + after
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
