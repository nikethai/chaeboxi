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
  const dom = document.getElementById(messageInputID) as HTMLTextAreaElement
  if (!dom) {
    return
  }
  dom.selectionStart = dom.selectionEnd = dom.value.length
  setTimeout(() => {
    dom.scrollTop = dom.scrollHeight
  }, 20) // React
}
