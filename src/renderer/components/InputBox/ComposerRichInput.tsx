/**
 * Slack-style contenteditable composer: true inline chips for @ $ # @mem mentions.
 * Parent keeps a serialized token string (messageInput) for drafts/send/pickers.
 */

import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from 'react'
import { useTranslation } from 'react-i18next'
import {
  type ComposerChipData,
  getTextBeforeCaret,
  placeCaretAtEnd,
  renderSerializedToDom,
  replaceActiveTriggerWithChip,
  serializeComposerDom,
  TRIGGER_PATTERNS,
} from './composer-chip-dom'

export type ComposerRichInputHandle = {
  focus: () => void
  getSerializedValue: () => string
  /** Sync DOM from serialized tokens (drafts / history / clear). */
  setSerializedValue: (value: string, opts?: { cursorToEnd?: boolean }) => void
  /** Replace active @/$/#/@mem trigger at caret with a chip. */
  insertChipAtTrigger: (chip: ComposerChipData, trigger: keyof typeof TRIGGER_PATTERNS) => string
  setCursorToEnd: () => void
  getElement: () => HTMLDivElement | null
  /** Text before caret (serialized) for picker query detection when needed. */
  getTextBeforeCaret: () => string
}

export type ComposerRichInputProps = {
  id: string
  value: string
  onChange: (serialized: string) => void
  onKeyDown?: (event: React.KeyboardEvent<HTMLDivElement>) => void
  onPaste?: (event: React.ClipboardEvent<HTMLDivElement>) => void
  placeholder?: string
  disabled?: boolean
  autoFocus?: boolean
  className?: string
  minRows?: number
  maxRows?: number
  /** Optional resolve token → richer chip when hydrating drafts */
  resolveToken?: (token: string) => Partial<ComposerChipData> | null
}

/** Treat browser-only empty markers (<br>, zero-width) as empty. */
function isEditorVisuallyEmpty(el: HTMLElement): boolean {
  const html = el.innerHTML.replace(/\s/g, '').toLowerCase()
  if (!html || html === '<br>' || html === '<br/>' || html === '<div><br></div>' || html === '<p><br></p>') {
    return true
  }
  return serializeComposerDom(el).trim().length === 0 && !el.querySelector('[data-composer-chip]')
}

const ComposerRichInput = forwardRef<ComposerRichInputHandle, ComposerRichInputProps>(
  function ComposerRichInput(
    {
      id,
      value,
      onChange,
      onKeyDown,
      onPaste,
      placeholder,
      disabled = false,
      autoFocus = false,
      className,
      minRows = 2,
      maxRows = 12,
      resolveToken,
    },
    ref
  ) {
    const { t } = useTranslation()
    const editorRef = useRef<HTMLDivElement | null>(null)
    // null = never hydrated. Do not init to `value`: mount DOM is empty, so a
    // non-empty starter/draft would skip syncFromValue and leave the dock blank.
    const lastEmittedRef = useRef<string | null>(null)
    const resolveRef = useRef(resolveToken)
    resolveRef.current = resolveToken

    const emitIfChanged = useCallback(() => {
      const el = editorRef.current
      if (!el) return

      // Normalize empty browser junk so :empty / is-empty placeholder works
      if (isEditorVisuallyEmpty(el)) {
        if (el.innerHTML !== '') el.innerHTML = ''
        if (lastEmittedRef.current !== '') {
          lastEmittedRef.current = ''
          onChange('')
        }
        el.classList.add('is-empty')
        return
      }

      el.classList.remove('is-empty')
      const next = serializeComposerDom(el)
      if (next !== lastEmittedRef.current) {
        lastEmittedRef.current = next
        onChange(next)
      }
    }, [onChange])

    const syncFromValue = useCallback((next: string, cursorToEnd = false) => {
      const el = editorRef.current
      if (!el) return
      const current = serializeComposerDom(el)
      if (current === next && (next !== '' || el.innerHTML === '')) {
        el.classList.toggle('is-empty', !next)
        lastEmittedRef.current = next
        if (cursorToEnd) placeCaretAtEnd(el)
        return
      }
      if (!next) {
        el.innerHTML = ''
        el.classList.add('is-empty')
        lastEmittedRef.current = ''
        if (cursorToEnd) placeCaretAtEnd(el)
        return
      }
      renderSerializedToDom(el, next, (token) => resolveRef.current?.(token) ?? null)
      el.classList.remove('is-empty')
      lastEmittedRef.current = next
      if (cursorToEnd) placeCaretAtEnd(el)
    }, [])

    useImperativeHandle(
      ref,
      () => ({
        focus: () => editorRef.current?.focus(),
        getSerializedValue: () => {
          const el = editorRef.current
          return el ? serializeComposerDom(el) : ''
        },
        setSerializedValue: (v, opts) => {
          syncFromValue(v, opts?.cursorToEnd)
        },
        insertChipAtTrigger: (chip, trigger) => {
          const el = editorRef.current
          if (!el) return lastEmittedRef.current ?? ''
          el.focus()
          el.classList.remove('is-empty')
          replaceActiveTriggerWithChip(el, chip, TRIGGER_PATTERNS[trigger])
          const next = serializeComposerDom(el)
          lastEmittedRef.current = next
          onChange(next)
          el.classList.toggle('is-empty', !next)
          return next
        },
        setCursorToEnd: () => {
          if (editorRef.current) placeCaretAtEnd(editorRef.current)
        },
        getElement: () => editorRef.current,
        getTextBeforeCaret: () => {
          const el = editorRef.current
          return el ? getTextBeforeCaret(el) : ''
        },
      }),
      [onChange, syncFromValue]
    )

    // Hydrate / external value changes (starter click, draft restore, history, clear)
    useLayoutEffect(() => {
      if (lastEmittedRef.current !== null && value === lastEmittedRef.current) {
        const el = editorRef.current
        if (el) el.classList.toggle('is-empty', !value)
        return
      }
      syncFromValue(value)
    }, [value, syncFromValue])

    useEffect(() => {
      if (autoFocus) editorRef.current?.focus()
    }, [autoFocus])

    const handleInput = useCallback(() => {
      emitIfChanged()
    }, [emitIfChanged])

    const handleKeyDown = useCallback(
      (event: React.KeyboardEvent<HTMLDivElement>) => {
        // Let parent handle picker nav / send first
        onKeyDown?.(event)
        if (event.defaultPrevented) return

        // Shift+Enter → soft newline
        if (event.key === 'Enter' && event.shiftKey) {
          event.preventDefault()
          document.execCommand('insertLineBreak')
          emitIfChanged()
          return
        }

        // Backspace on chip: delete whole chip when caret is just after it
        if (event.key === 'Backspace') {
          const sel = window.getSelection()
          if (!sel || !sel.isCollapsed || sel.rangeCount === 0) return
          const range = sel.getRangeAt(0)
          const node = range.startContainer
          const offset = range.startOffset

          if (node.nodeType === Node.TEXT_NODE && offset === 0) {
            const prev = node.previousSibling
            if (prev && (prev as HTMLElement).hasAttribute?.('data-composer-chip')) {
              event.preventDefault()
              prev.parentNode?.removeChild(prev)
              emitIfChanged()
              return
            }
          }
          if (node.nodeType === Node.ELEMENT_NODE && offset > 0) {
            const child = (node as HTMLElement).childNodes[offset - 1]
            if (child && (child as HTMLElement).hasAttribute?.('data-composer-chip')) {
              event.preventDefault()
              child.parentNode?.removeChild(child)
              emitIfChanged()
            }
          }
        }
      },
      [emitIfChanged, onKeyDown]
    )

    const handlePaste = useCallback(
      (event: React.ClipboardEvent<HTMLDivElement>) => {
        onPaste?.(event)
        if (event.defaultPrevented) return
        const text = event.clipboardData.getData('text/plain')
        if (!text) return
        event.preventDefault()
        document.execCommand('insertText', false, text)
        emitIfChanged()
      },
      [emitIfChanged, onPaste]
    )

    // Max height from rows; min-height lives in CSS so empty state stays one line (caret)
    const maxHeightEm = Math.max(minRows, maxRows) * 1.55
    const ph = placeholder || t('Write a message…')

    return (
      <div
        id={id}
        ref={editorRef}
        className={`composer-rich-input is-empty ${className || ''}`}
        contentEditable={!disabled}
        role="textbox"
        aria-multiline="true"
        aria-placeholder={ph}
        aria-label={ph}
        data-placeholder={ph}
        suppressContentEditableWarning
        spellCheck
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onBlur={emitIfChanged}
        style={{
          maxHeight: `${maxHeightEm}em`,
          overflowY: 'auto',
        }}
      />
    )
  }
)

export default memo(ComposerRichInput)
