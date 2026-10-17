import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import postcss, { type Rule } from 'postcss'
import { describe, expect, test } from 'vitest'

const read = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), 'utf8')

const LABEL_CLASSES = ['settings-section-label', 'settings-section-title', 'settings-collapsible-badge']

const labelRules = () => {
  const rules: Rule[] = []
  postcss.parse(read('src/renderer/components/settings/settings-surfaces.css')).walkRules((rule) => {
    if (LABEL_CLASSES.some((name) => rule.selector.includes(name))) {
      rules.push(rule)
    }
  })
  return rules
}

describe('settings section labels and badges follow the Dango label style', () => {
  test('the CSS finds the label rules', () => {
    expect(labelRules().length).toBeGreaterThanOrEqual(LABEL_CLASSES.length)
  })

  test('no uppercase and no letter-spacing', () => {
    const offenders: string[] = []
    for (const rule of labelRules()) {
      rule.each((node) => {
        if (node.type !== 'decl') {
          return
        }
        const value = node.value.trim()
        if (node.prop === 'text-transform' && value !== 'none') {
          offenders.push(`${rule.selector} { text-transform: ${value} }`)
        }
        if (node.prop === 'letter-spacing' && !['0', 'normal'].includes(value)) {
          offenders.push(`${rule.selector} { letter-spacing: ${value} }`)
        }
      })
    }
    expect(offenders).toEqual([])
  })

  test('section labels are 12px, 600, muted', () => {
    const decl = (rule: Rule, prop: string) => {
      let found: string | undefined
      rule.each((node) => {
        if (node.type === 'decl' && node.prop === prop) {
          found = node.value.replace(/\s*!important$/, '').trim()
        }
      })
      return found
    }
    for (const rule of labelRules().filter((r) => /section-(label|title)/.test(r.selector))) {
      const fontSize = decl(rule, 'font-size')
      if (fontSize !== undefined) {
        expect(fontSize, `${rule.selector} font-size`).toBe('0.75rem')
      }
      const weight = decl(rule, 'font-weight')
      if (weight !== undefined) {
        expect(weight, `${rule.selector} font-weight`).toBe('600')
      }
      const color = decl(rule, 'color')
      if (color !== undefined) {
        expect(color, `${rule.selector} color`).toBe('var(--dango-muted)')
      }
    }
  })

  test('the section header components carry no uppercase or tracking utilities', () => {
    for (const file of ['SettingsSection.tsx', 'SettingsCollapsible.tsx']) {
      const source = read(`src/renderer/components/settings/${file}`)
      expect(source, file).not.toMatch(/tt=["']uppercase["']|\buppercase\b|\btracking-/)
    }
  })
})
