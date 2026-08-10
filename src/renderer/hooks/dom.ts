// (legacy comment)

// (legacy comment removed)

export const InputBoxID = 'input-box-2024-02-22'

export function getInputBoxHeight(): number {
  const element = document.getElementById(InputBoxID)
  if (!element) {
    return 0
  }
  return element.clientHeight
}

// (legacy comment)

export const messageInputID = 'message-input'

export const focusMessageInput = () => {
  document.getElementById(messageInputID)?.focus()
}

// (legacy comment removed)
export function setMessageInputCursorToEnd() {
  const el = document.getElementById(messageInputID)
  if (!el) return

  // Contenteditable rich composer
  if (el.isContentEditable || el.getAttribute('contenteditable') === 'true') {
    const range = document.createRange()
    range.selectNodeContents(el)
    range.collapse(false)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
    setTimeout(() => {
      el.scrollTop = el.scrollHeight
    }, 20)
    return
  }

  const textarea = el as HTMLTextAreaElement
  if (typeof textarea.selectionStart === 'number') {
    textarea.selectionStart = textarea.selectionEnd = textarea.value.length
    setTimeout(() => {
      textarea.scrollTop = textarea.scrollHeight
    }, 20) // React
  }
}
