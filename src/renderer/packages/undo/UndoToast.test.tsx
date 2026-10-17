/**
 * @vitest-environment jsdom
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getOS = vi.fn<() => string>(() => 'Mac')
vi.mock('@/packages/navigator', () => ({ getOS: () => getOS() }))
vi.mock('@/stores/toastActions', () => ({ add: vi.fn() }))
vi.mock('i18next', () => ({ t: (key: string) => key }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

import { UndoToast } from './UndoToast'
import { pushUndo, resetUndoForTests } from './undo'
import { useUndoHotkey } from './useUndoHotkey'

const MESSAGE = 'Approved "Launch is 6 Nov" for Acme Co'

beforeEach(() => {
  getOS.mockReturnValue('Mac')
  resetUndoForTests()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  resetUndoForTests()
  document.body.innerHTML = ''
})

describe('UndoToast', () => {
  it('renders nothing without a toast', () => {
    const { container } = render(<UndoToast />)
    expect(container.querySelector('.dango-toast-host')).toBeNull()
  })

  it('shows the toast', () => {
    const { container } = render(<UndoToast />)
    act(() => {
      pushUndo({ message: MESSAGE, undo: vi.fn() })
    })
    const status = screen.getByRole('status')
    expect(status.textContent).toContain(MESSAGE)
    expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy()
    expect(container.querySelector('.dg-kbd')?.textContent).toBe('⌘Z')
  })

  it('shows Ctrl+Z on Windows and no hint on iOS', () => {
    getOS.mockReturnValue('Windows')
    const { container, unmount } = render(<UndoToast />)
    act(() => {
      pushUndo({ message: MESSAGE, undo: vi.fn() })
    })
    expect(container.querySelector('.dg-kbd')?.textContent).toBe('Ctrl+Z')
    unmount()
    resetUndoForTests()
    getOS.mockReturnValue('iOS')
    const r = render(<UndoToast />)
    act(() => {
      pushUndo({ message: MESSAGE, undo: vi.fn() })
    })
    expect(r.container.querySelector('.dg-toast')).toBeTruthy()
    expect(r.container.querySelector('.dg-kbd')).toBeNull()
  })

  it('undo button runs once and hides', async () => {
    const undo = vi.fn()
    const { container } = render(<UndoToast />)
    act(() => {
      pushUndo({ message: MESSAGE, undo })
    })
    const button = screen.getByRole('button', { name: 'Undo' })
    await act(async () => {
      fireEvent.click(button)
      fireEvent.click(button)
    })
    expect(undo).toHaveBeenCalledTimes(1)
    expect(container.querySelector('.dg-toast')).toBeNull()
  })

  it('one at a time', () => {
    const { container } = render(<UndoToast />)
    act(() => {
      pushUndo({ message: 'first', undo: vi.fn() })
      pushUndo({ message: 'second', undo: vi.fn() })
    })
    expect(container.querySelectorAll('.dg-toast')).toHaveLength(1)
    expect(screen.getByRole('status').textContent).toContain('second')
  })

  it('gone after 5 s', () => {
    vi.useFakeTimers()
    const { container } = render(<UndoToast />)
    act(() => {
      pushUndo({ message: MESSAGE, undo: vi.fn() })
    })
    expect(container.querySelector('.dg-toast')).toBeTruthy()
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(container.querySelector('.dg-toast')).toBeNull()
  })

  it('extra link', async () => {
    const undo = vi.fn()
    const onClick = vi.fn()
    const { container } = render(<UndoToast />)
    act(() => {
      pushUndo({ message: MESSAGE, undo })
    })
    expect(container.querySelector('.dg-link')).toBeNull()
    act(() => {
      pushUndo({ message: MESSAGE, undo, extra: { label: "Don't suggest this again", onClick } })
    })
    const link = container.querySelector('.dg-link') as HTMLButtonElement
    expect(link.tagName).toBe('BUTTON')
    expect(link.textContent).toBe("Don't suggest this again")
    expect(link.closest('.dg-toast')).toBeNull()
    expect(link.closest('.dango-toast-host')).toBeTruthy()
    await act(async () => {
      fireEvent.click(link)
    })
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(undo).not.toHaveBeenCalled()
  })
})

describe('useUndoHotkey', () => {
  function press(target: Element, init: KeyboardEventInit) {
    const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
    target.dispatchEvent(event)
    return event
  }

  it('Mac uses meta, not ctrl, and never Shift or Alt', () => {
    const undo = vi.fn()
    renderHook(useUndoHotkey)
    pushUndo({ message: MESSAGE, undo })
    expect(press(document.body, { key: 'z', ctrlKey: true }).defaultPrevented).toBe(false)
    expect(press(document.body, { key: 'z', metaKey: true, shiftKey: true }).defaultPrevented).toBe(false)
    expect(press(document.body, { key: 'z', metaKey: true, altKey: true }).defaultPrevented).toBe(false)
    expect(undo).not.toHaveBeenCalled()
    const ok = press(document.body, { key: 'Z', metaKey: true })
    expect(undo).toHaveBeenCalledTimes(1)
    expect(ok.defaultPrevented).toBe(true)
  })

  it('Windows uses ctrl, not meta', () => {
    getOS.mockReturnValue('Windows')
    const undo = vi.fn()
    renderHook(useUndoHotkey)
    pushUndo({ message: MESSAGE, undo })
    press(document.body, { key: 'z', metaKey: true })
    expect(undo).not.toHaveBeenCalled()
    press(document.body, { key: 'z', ctrlKey: true })
    expect(undo).toHaveBeenCalledTimes(1)
  })

  it('ignores editable targets and does not prevent default', () => {
    const undo = vi.fn()
    renderHook(useUndoHotkey)
    pushUndo({ message: MESSAGE, undo })
    document.body.innerHTML =
      '<input id="i" /><textarea id="t"></textarea><select id="s"></select><div contenteditable="true"><span id="c">x</span></div>'
    for (const id of ['i', 't', 's', 'c']) {
      const event = press(document.getElementById(id) as Element, { key: 'z', metaKey: true })
      expect(event.defaultPrevented).toBe(false)
    }
    expect(undo).not.toHaveBeenCalled()
  })

  it('does not prevent default with nothing live or when already prevented', () => {
    const undo = vi.fn()
    renderHook(useUndoHotkey)
    expect(press(document.body, { key: 'z', metaKey: true }).defaultPrevented).toBe(false)
    pushUndo({ message: MESSAGE, undo, silent: true })
    expect(press(document.body, { key: 'z', metaKey: true }).defaultPrevented).toBe(false)
    expect(undo).not.toHaveBeenCalled()
    pushUndo({ message: MESSAGE, undo })
    const pre = (e: Event) => e.preventDefault()
    document.body.addEventListener('keydown', pre)
    press(document.body, { key: 'z', metaKey: true })
    document.body.removeEventListener('keydown', pre)
    expect(undo).not.toHaveBeenCalled()
  })

  it('removes its listener on unmount', () => {
    const undo = vi.fn()
    const { unmount } = renderHook(useUndoHotkey)
    unmount()
    pushUndo({ message: MESSAGE, undo })
    press(document.body, { key: 'z', metaKey: true })
    expect(undo).not.toHaveBeenCalled()
  })
})

describe('wiring', () => {
  it('mounted once', () => {
    const root = readFileSync(resolve(__dirname, '../../routes/__root.tsx'), 'utf8')
    expect(root.match(/<UndoToast/g)).toHaveLength(1)
    expect(root.match(/useUndoHotkey\(\)/g)).toHaveLength(1)
  })

  it('css', () => {
    const css = readFileSync(resolve(__dirname, '../../static/dango-foundations.css'), 'utf8')
    const rule = css.match(/\.dango-toast-host\s*\{([^}]*)\}/)?.[1] ?? ''
    expect(rule).toMatch(/position:\s*fixed/)
    expect(rule).toMatch(/bottom:\s*var\(--dango-space-6\)/)
  })
})
