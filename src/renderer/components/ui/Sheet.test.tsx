/**
 * @vitest-environment jsdom
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import postcss, { type AtRule, type Rule } from 'postcss'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Sheet, type SheetProps } from './Sheet'

const TITLE = 'Dango wants to edit 3 files'

function TestSheet(props: Partial<SheetProps> & { inputProps?: Record<string, unknown>; extra?: ReactNode }) {
  const { inputProps, extra, ...rest } = props
  return (
    <Sheet
      opened
      onClose={() => {}}
      title={TITLE}
      actions={
        <>
          <button type="button" className="dg-btn dg-btn--ghost">
            Not now
          </button>
          <button type="button" className="dg-btn">
            Always in this scope
          </button>
          <button type="button" className="dg-btn dg-btn--primary">
            Allow once
          </button>
        </>
      }
      {...rest}
    >
      <input aria-label="Note" {...inputProps} />
      {extra}
    </Sheet>
  )
}

afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
})

describe('Sheet', () => {
  it('renders a labelled modal dialog in body', () => {
    const { container } = render(<TestSheet />)
    const dialog = screen.getByRole('dialog', { name: TITLE })
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.classList.contains('dg-sheet')).toBe(true)
    expect(container.contains(dialog)).toBe(false)
    let node: HTMLElement | null = dialog
    while (node && node !== document.body) node = node.parentElement
    expect(node).toBe(document.body)
    expect(dialog.parentElement?.classList.contains('dango-sheet-layer')).toBe(true)
  })

  it('renders nothing when closed, and adds side and hint variants', () => {
    const { rerender } = render(<TestSheet opened={false} />)
    expect(screen.queryByRole('dialog')).toBeNull()
    rerender(<TestSheet side="right" hint="Esc closes" />)
    expect(screen.getByRole('dialog').classList.contains('dango-sheet--right')).toBe(true)
    expect(document.querySelector('.dg-sheet__hint')?.textContent).toBe('Esc closes')
  })

  it('first focus is the primary action', () => {
    const { unmount } = render(<TestSheet />)
    expect(document.activeElement).toBe(screen.getByText('Allow once'))
    unmount()
    render(<TestSheet inputProps={{ 'data-autofocus': true }} />)
    expect(document.activeElement).toBe(screen.getByLabelText('Note'))
  })

  it('tab stays inside', () => {
    render(<TestSheet />)
    const primary = screen.getByText('Allow once')
    const input = screen.getByLabelText('Note')
    expect(document.activeElement).toBe(primary)
    fireEvent.keyDown(primary, { key: 'Tab' })
    expect(document.activeElement).toBe(input)
    fireEvent.keyDown(input, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(primary)
  })

  it('esc closes and returns focus', () => {
    const onClose = vi.fn()
    const windowSpy = vi.fn()
    window.addEventListener('keydown', windowSpy)
    const opener = document.createElement('button')
    document.body.appendChild(opener)
    opener.focus()
    const { rerender } = render(<TestSheet onClose={onClose} />)
    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(windowSpy.mock.calls.filter(([e]) => (e as KeyboardEvent).key === 'Escape')).toHaveLength(0)
    rerender(<TestSheet onClose={onClose} opened={false} />)
    expect(document.activeElement).toBe(opener)
    window.removeEventListener('keydown', windowSpy)
  })

  it('opener gone falls back to #main', () => {
    const main = document.createElement('main')
    main.id = 'main'
    main.tabIndex = -1
    document.body.appendChild(main)
    const opener = document.createElement('button')
    document.body.appendChild(opener)
    opener.focus()
    const { rerender } = render(<TestSheet />)
    opener.remove()
    rerender(<TestSheet opened={false} />)
    expect(document.activeElement).toBe(main)
  })

  it('inner Esc handler wins', () => {
    const onClose = vi.fn()
    render(
      <TestSheet
        onClose={onClose}
        inputProps={{
          onKeyDown: (e: { key: string; preventDefault: () => void }) => {
            if (e.key === 'Escape') e.preventDefault()
          },
        }}
      />
    )
    fireEvent.keyDown(screen.getByLabelText('Note'), { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('only the top sheet reacts', () => {
    const first = vi.fn()
    const second = vi.fn()
    render(
      <>
        <Sheet opened onClose={first} title="First">
          <button type="button">a</button>
        </Sheet>
        <Sheet opened onClose={second} title="Second">
          <button type="button">b</button>
        </Sheet>
      </>
    )
    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' })
    expect(second).toHaveBeenCalledTimes(1)
    expect(first).not.toHaveBeenCalled()
  })

  it('scrim click closes', () => {
    const onClose = vi.fn()
    render(<TestSheet onClose={onClose} />)
    fireEvent.click(document.querySelector('.dg-sheet-scrim') as Element)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('dango-foundations.css', () => {
  const css = postcss.parse(readFileSync(resolve(process.cwd(), 'src/renderer/static/dango-foundations.css'), 'utf8'))

  it('layers the sheet, disables motion when reduced, uses tokens only', () => {
    let position = ''
    css.walkRules('.dango-sheet-layer', (rule: Rule) => {
      rule.walkDecls('position', (d) => {
        position = d.value
      })
    })
    expect(position).toBe('fixed')

    let reducedNone = false
    css.walkAtRules('media', (at: AtRule) => {
      if (!at.params.includes('prefers-reduced-motion: reduce')) return
      at.walkRules((rule: Rule) => {
        if (!rule.selector.includes('.dg-sheet')) return
        rule.walkDecls('animation', (d) => {
          if (d.value === 'none') reducedNone = true
        })
      })
    })
    expect(reducedNone).toBe(true)

    const hex: string[] = []
    css.walkDecls((d) => {
      if (/#[0-9a-fA-F]/.test(d.value)) hex.push(`${d.prop}: ${d.value}`)
    })
    expect(hex).toEqual([])
  })
})
