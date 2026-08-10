/** Map internal memory tags to product-facing labels. */
const TAG_LABELS: Record<string, string> = {
  pinned: 'Pinned',
  'assistant-message': 'From chat',
  'user-message': 'Your note',
  auto: 'Auto-saved',
  conversation: 'Conversation',
  project: 'Project',
  workflow: 'Workflow',
  prefs: 'Preferences',
}

export function memoryTagLabel(tag: string): string {
  const key = tag.trim().toLowerCase()
  if (TAG_LABELS[key]) return TAG_LABELS[key]
  // kebab / snake → Title case words
  return tag
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
