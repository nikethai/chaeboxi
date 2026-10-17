const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

/** True when the event target is a field with its own undo: input, textarea, select or contenteditable. */
export function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as Element | null
  if (!el || typeof el.closest !== 'function') {
    return false
  }
  if (EDITABLE_TAGS.has(el.tagName)) {
    return true
  }
  return el.closest('[contenteditable]:not([contenteditable="false"])') !== null
}
