import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import postcss, { type Rule } from 'postcss'
import { describe, expect, test } from 'vitest'
import { dangoColors } from './dangoTokens'

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

// top-level :root variables (the dark block does not redeclare the mapped ones)
const rootVars = new Map<string, string>()
for (const rule of rulesWhere((s) => s === ':root')) {
  if (rule.parent?.type === 'root') {
    for (const d of declsOf([rule])) {
      rootVars.set(d.prop, d.value)
    }
  }
}
// follow var() chains down to a Dango colour, or fail on anything else (a color-mix over the rail is not allowed)
const resolveColor = (value: string, mode: 'light' | 'dark'): string => {
  const v = value.replace(/\s*!important$/, '').trim()
  const match = /^var\((--[\w-]+)\)$/.exec(v)
  if (!match) {
    throw new Error(`hover background must be a plain variable, got ${v}`)
  }
  if (match[1].startsWith('--dango-')) {
    return dangoColors[mode][match[1].slice('--dango-'.length) as keyof (typeof dangoColors)['light']]
  }
  const next = rootVars.get(match[1])
  if (!next) {
    throw new Error(`${match[1]} is not declared on :root`)
  }
  return resolveColor(next, mode)
}

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

  test('day group labels (Today, Yesterday, ...) are sentence case and quieter than the section labels', () => {
    const rules = rulesWhere((s) => s.endsWith('.rail-day-header'))
    expect(rules.length).toBeGreaterThan(0)
    expect(valuesOf(rules, 'text-transform')).toEqual([])
    expect(valuesOf(rules, 'letter-spacing')).toEqual([])
    // opacity would pull muted text below 4.5:1
    expect(valuesOf(rules, 'opacity')).toEqual([])
    expect(valuesOf(rules, 'font-size').map((d) => d.value)).toEqual(['12px'])
    // 400, one step lighter than the 600 section label above the groups
    expect(valuesOf(rules, 'font-weight').map((d) => d.value)).toEqual(['400'])
    expect(valuesOf(rules, 'color').map((d) => d.value)).toEqual(['var(--dango-muted)'])
  })

  test('rows on the rail show a hover background that differs from the rail in both themes', () => {
    for (const selector of [
      '.studio-rail-row:hover',
      '.rail-nav-item:hover',
      '.settings-nav-item:not(.settings-nav-item-on):hover',
    ]) {
      const rules = rulesWhere((s) => s === selector)
      const backgrounds = valuesOf(rules, 'background')
      expect(backgrounds.length, selector).toBe(1)
      expect(backgrounds[0].value, selector).toBe('var(--chatbox-background-tertiary-hover)')
      for (const mode of ['light', 'dark'] as const) {
        expect(resolveColor(backgrounds[0].value, mode), `${selector} ${mode}`).not.toBe(
          resolveColor('var(--chatbox-background-rail)', mode)
        )
      }
    }
  })

  test('folder rows hover like the other rail rows', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/renderer/components/session/FolderItem.tsx'), 'utf8')
    const hovers = [...source.matchAll(/hover:bg-\[(var\(--[\w-]+\))\]/g)].map((m) => m[1])
    expect(hovers).toEqual(['var(--chatbox-background-tertiary-hover)'])
    for (const mode of ['light', 'dark'] as const) {
      expect(resolveColor(hovers[0], mode), mode).not.toBe(resolveColor('var(--chatbox-background-rail)', mode))
    }
  })

  test('selected rows keep the same left padding as idle rows', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/renderer/components/session/SessionItem.tsx'), 'utf8')
    expect(source).not.toMatch(/pl=\{selected\s*\?/)
  })
})
