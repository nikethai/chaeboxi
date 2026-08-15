/**
 * @vitest-environment jsdom
 *
 * Starter clicks remount the composer with a non-empty `value`. The editor must
 * hydrate that text into the contenteditable DOM on first paint.
 */

import { render, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ComposerRichInput from './ComposerRichInput'

describe('ComposerRichInput hydrate', () => {
  it('renders initial non-empty value into the editor (blank-home starters)', async () => {
    const onChange = vi.fn()
    const editorId = `message-input-${Math.random().toString(36).slice(2)}`
    const { container } = render(<ComposerRichInput id={editorId} value="Help me plan " onChange={onChange} />)

    const editor = container.querySelector(`#${editorId}`) as HTMLElement
    expect(editor).toBeTruthy()

    await waitFor(() => {
      expect(editor.textContent).toContain('Help me plan')
    })
    expect(editor.classList.contains('is-empty')).toBe(false)
  })
})
