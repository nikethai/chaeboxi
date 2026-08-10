import type { MemoryEntry } from '@shared/types/memory'
import {
  filterMemoryEntriesByTag,
  getActiveMemoryMentionQuery,
  getComposerSelectionOrDraft,
  getMemoryTags,
  stripActiveMemoryMention,
} from './memory-dock-utils'

function memoryEntry(id: string, tags: string[], enabled = true): MemoryEntry {
  return {
    id,
    content: id,
    tags,
    scope: 'global',
    source: 'user',
    enabled,
    pinned: false,
    createdAt: 0,
    updatedAt: 0,
  }
}

describe('memory dock composer helpers', () => {
  it('prefers a composer selection and otherwise uses the full draft', () => {
    const input = {
      value: 'Save only this fact',
      selectionStart: 5,
      selectionEnd: 9,
    } as HTMLTextAreaElement

    expect(getComposerSelectionOrDraft(input, input.value)).toBe('only')
    input.selectionStart = 0
    input.selectionEnd = 0
    expect(getComposerSelectionOrDraft(input, input.value)).toBe('Save only this fact')
  })

  it('recognizes and removes the @mem memory shortcut without affecting agent mentions', () => {
    expect(getActiveMemoryMentionQuery('@mem')).toBe('')
    expect(getActiveMemoryMentionQuery('Use @memory project prefs')).toBe('project prefs')
    expect(getActiveMemoryMentionQuery('@me')).toBeNull()
    expect(stripActiveMemoryMention('Use @memory project prefs')).toBe('Use')
  })

  it('lists active tags and filters memory entries by a chosen tag', () => {
    const entries = [
      memoryEntry('one', ['project', 'python']),
      memoryEntry('two', ['prefs']),
      memoryEntry('three', ['project'], false),
    ]

    expect(getMemoryTags(entries)).toEqual(['prefs', 'project', 'python'])
    expect(filterMemoryEntriesByTag(entries, 'project').map((entry) => entry.id)).toEqual(['one', 'three'])
  })
})
