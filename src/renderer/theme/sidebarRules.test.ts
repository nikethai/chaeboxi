import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import postcss, { type Rule } from 'postcss'
import { describe, expect, test } from 'vitest'

const globalsRoot = postcss.parse(readFileSync(resolve(process.cwd(), 'src/renderer/static/globals.css'), 'utf8'))

const normalize = (selector: string) => selector.replace(/\s+/g, ' ').trim()

// Every rule with a selector in the list that satisfies `matches`.
const rulesWhere = (matches: (selector: string) => boolean) => {
  const rules: Rule[] = []
  globalsRoot.walkRules((rule) => {
    if (rule.selectors.some((selector) => matches(normalize(selector)))) {
      rules.push(rule)
    }
  })
  return rules
}

const declsOf = (rules: Rule[]) => {
  const out: Array<{ prop: string; value: string; selector: string }> = []
  for (const rule of rules) {
    rule.each((node) => {
      if (node.type === 'decl') {
        out.push({
          prop: node.prop,
          value: `${node.value.replace(/\s+/g, ' ').trim()}${node.important ? ' !important' : ''}`,
          selector: rule.selector,
        })
      }
    })
  }
  return out
}

const valuesOf = (rules: Rule[], prop: string) => declsOf(rules).filter((d) => d.prop === prop)

describe('sidebar rules follow the Dango design system', () => {
  test('active row is green wash with green text', () => {
    // Rules that style the row itself (not its children, not pseudo-elements).
    const rows = rulesWhere((s) => /(^|\s)\.studio-rail-row-active(:hover)?$/.test(s))
    expect(rows.length).toBeGreaterThan(0)
    const backgrounds = valuesOf(rows, 'background')
    expect(backgrounds.length).toBeGreaterThan(0)
    for (const decl of backgrounds) {
      expect(decl.value, decl.selector).toBe('var(--dango-green-wash) !important')
    }
    expect(valuesOf(rows, 'color').map((d) => d.value)).toContain('var(--dango-green-text)')
    expect(valuesOf(rows, 'box-shadow')).toEqual([])
  })

  test('no coloured edge on the active row', () => {
    const edges = rulesWhere((s) => s.includes('.studio-rail-row-active::before'))
    const offending = declsOf(edges).filter((d) => d.prop === 'background' || d.prop === 'content')
    expect(offending).toEqual([])
  })

  test('New chat row is not tinted', () => {
    const rules = rulesWhere((s) => s.includes('.rail-nav-item--primary'))
    const tinted = declsOf(rules).filter(
      (d) => d.prop.startsWith('background') && d.value.includes('--chatbox-tint-brand')
    )
    expect(tinted).toEqual([])
  })

  test('section labels are sentence case', () => {
    const rules = rulesWhere((s) => s.endsWith('.rail-section-label') && !s.includes(':hover'))
    expect(rules.length).toBeGreaterThan(0)
    expect(valuesOf(rules, 'text-transform')).toEqual([])
    expect(valuesOf(rules, 'letter-spacing')).toEqual([])
    expect(valuesOf(rules, 'font-size').map((d) => d.value)).toEqual(['12px'])
    expect(valuesOf(rules, 'font-weight').map((d) => d.value)).toEqual(['600'])
    expect(valuesOf(rules, 'color').map((d) => d.value)).toEqual(['var(--dango-muted)'])
  })

  test('selected rows keep the same left padding as idle rows', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/renderer/components/session/SessionItem.tsx'), 'utf8')
    expect(source).not.toMatch(/pl=\{selected\s*\?/)
  })
})
