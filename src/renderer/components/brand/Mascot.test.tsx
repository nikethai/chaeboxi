/**
 * @vitest-environment jsdom
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act, cleanup, render, screen } from '@testing-library/react'
import postcss, { type AtRule, type Rule } from 'postcss'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Mascot, type MascotState } from './Mascot'

const BODY = 'M8 38 C 8 21, 19 11, 32 11 C 45 11, 56 21, 56 38 C 56 49, 47 54, 32 54 C 17 54, 8 49, 8 38 Z'

const STATES: [MascotState, string][] = [
  ['idle', 'Assistant, idle'],
  ['thinking', 'Assistant, thinking'],
  ['replying', 'Assistant, replying'],
  ['working', 'Assistant, working'],
  ['needs-you', 'Assistant, needs you'],
  ['done', 'Assistant, done'],
  ['asleep', 'Assistant, asleep'],
  ['stuck', 'Assistant, stuck'],
]

function stubMatchMedia(matches: boolean) {
  const listeners = new Set<(e: { matches: boolean }) => void>()
  const mql = {
    matches,
    media: '(prefers-reduced-motion: reduce)',
    addEventListener: (_: string, l: (e: { matches: boolean }) => void) => listeners.add(l),
    removeEventListener: (_: string, l: (e: { matches: boolean }) => void) => listeners.delete(l),
  }
  vi.stubGlobal('matchMedia', () => mql)
  return {
    change(next: boolean) {
      mql.matches = next
      for (const l of [...listeners]) l({ matches: next })
    },
  }
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('Mascot', () => {
  it('every state is labelled', () => {
    stubMatchMedia(false)
    for (const [state, label] of STATES) {
      const { container, unmount } = render(<Mascot state={state} size={24} />)
      const svgs = container.querySelectorAll('svg.dg-mascot')
      expect(svgs).toHaveLength(1)
      const svg = svgs[0]
      expect(svg.getAttribute('role')).toBe('img')
      expect(svg.getAttribute('aria-label')).toBe(label)
      expect(svg.getAttribute('width')).toBe('24')
      expect(svg.getAttribute('height')).toBe('24')
      expect(svg.getAttribute('viewBox')).toBe('0 0 64 64')
      expect(svg.getAttribute('data-state')).toBe(state)
      unmount()
    }
    render(<Mascot state="thinking" size={24} label="Dango is thinking" />)
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('Dango is thinking')
  })

  it('idle geometry', () => {
    stubMatchMedia(false)
    const { container } = render(<Mascot state="idle" size={40} />)
    expect(container.querySelector('path.body')?.getAttribute('d')).toBe(BODY)
    const eyes = container.querySelectorAll('g.eyes > ellipse.eye')
    expect(eyes).toHaveLength(2)
    expect(eyes[0].getAttribute('transform')).toBe('rotate(-7 26 36)')
    expect(eyes[1].getAttribute('transform')).toBe('rotate(-7 39 35)')
  })

  it('extras per state', () => {
    stubMatchMedia(false)
    const q = (state: MascotState) => render(<Mascot state={state} size={56} />).container
    expect(q('thinking').querySelectorAll('circle.accent')).toHaveLength(3)
    cleanup()
    const working = q('working')
    expect(working.querySelector('.ring')).not.toBeNull()
    expect(working.querySelector('.ring-track')).not.toBeNull()
    cleanup()
    const needs = q('needs-you')
    expect(needs.querySelectorAll('circle.alert')).toHaveLength(1)
    expect(needs.querySelector('ellipse.eye')?.getAttribute('rx')).toBe('3.8')
    cleanup()
    expect(q('asleep').querySelector('text')?.textContent).toBe('z')
    cleanup()
    expect(q('stuck').querySelector('text')?.textContent).toBe('?')
    cleanup()
    expect(q('done').querySelectorAll('ellipse')).toHaveLength(0)
  })

  it('colours come from the theme', () => {
    stubMatchMedia(false)
    for (const [state] of STATES) {
      const { container, unmount } = render(<Mascot state={state} size={24} />)
      for (const el of Array.from(container.querySelectorAll('*'))) {
        expect(el.getAttribute('fill') ?? '').not.toContain('#')
        expect(el.getAttribute('stroke') ?? '').not.toContain('#')
      }
      unmount()
    }
  })

  it('reduced motion holds the idle pose', () => {
    const mq = stubMatchMedia(true)
    const { container, rerender } = render(<Mascot state="working" size={24} />)
    const svg = container.querySelector('svg.dg-mascot') as SVGElement
    expect(svg.getAttribute('data-pose')).toBe('idle')
    expect(svg.getAttribute('data-state')).toBe('working')
    expect(container.querySelector('.ring')).toBeNull()
    expect(svg.getAttribute('aria-label')).toBe('Assistant, working')
    expect(screen.getByText('Working')).toBeTruthy()
    expect(container.querySelector('.dango-mascot__state')?.getAttribute('aria-hidden')).toBe('true')

    rerender(<Mascot state="idle" size={24} />)
    expect(container.querySelector('.dango-mascot__state')).toBeNull()
    rerender(<Mascot state="working" size={24} />)

    act(() => mq.change(false))
    expect(container.querySelector('svg.dg-mascot')?.getAttribute('data-pose')).toBe('working')
    expect(container.querySelector('.ring')).not.toBeNull()
    expect(container.querySelector('.dango-mascot__state')).toBeNull()
  })

  it('renders without matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined)
    const { container } = render(<Mascot state="working" size={24} />)
    expect(container.querySelector('svg.dg-mascot')?.getAttribute('data-pose')).toBe('working')
  })
})

describe('dango-foundations.css mascot rules', () => {
  it('disables mascot animation when motion is reduced', () => {
    const css = postcss.parse(readFileSync(resolve(process.cwd(), 'src/renderer/static/dango-foundations.css'), 'utf8'))
    let found = false
    css.walkAtRules('media', (at: AtRule) => {
      if (!at.params.includes('prefers-reduced-motion: reduce')) return
      at.walkRules((rule: Rule) => {
        if (!rule.selector.includes('.dg-mascot *')) return
        rule.walkDecls('animation', (d) => {
          if (d.value === 'none') found = true
        })
      })
    })
    expect(found).toBe(true)
  })
})
