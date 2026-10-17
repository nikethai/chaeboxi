import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import postcss, { type Rule } from 'postcss'
import { describe, expect, test } from 'vitest'
import { contrastRatio } from './contrast'
import { dangoColors, dangoFonts } from './dangoTokens'
import { createDangoMantineTheme } from './mantineTheme'
import { getThemeDesign } from './muiTheme'

const root = process.cwd()
const readSource = (relativePath: string) => readFileSync(resolve(root, relativePath), 'utf8')
const globalsCss = readSource('src/renderer/static/globals.css')
const globalsRoot = postcss.parse(globalsCss)

// [chatbox variable suffix, dango token]
const VARIABLE_MAP: Array<[string, string]> = [
  ['tint-primary', 'ink'],
  ['tint-secondary', 'ink-2'],
  ['tint-tertiary', 'muted'],
  ['tint-gray', 'muted'],
  ['tint-placeholder', 'muted'],
  ['tint-brand', 'green'],
  ['tint-success', 'green'],
  ['tint-error', 'danger'],
  ['tint-warning', 'amber-text'],
  ['tint-on-brand', 'on-green'],
  ['border-primary', 'hairline'],
  ['border-secondary', 'line'],
  ['border-brand', 'green'],
  ['border-success', 'green'],
  ['border-error', 'danger'],
  ['border-warning', 'amber-text'],
  ['background-primary', 'ground'],
  ['background-rail', 'surface'],
  ['background-secondary', 'raised'],
  ['background-lift', 'raised'],
  ['background-tertiary', 'surface'],
  ['background-user-bubble', 'surface'],
  ['background-primary-hover', 'surface'],
  ['background-secondary-hover', 'surface'],
  ['background-tertiary-hover', 'hairline'],
  ['background-brand-primary', 'green'],
  ['background-brand-secondary', 'green-wash'],
  ['background-success-primary', 'green'],
  ['background-success-secondary', 'green-wash'],
  ['background-warning-secondary', 'amber-wash'],
  ['background-error-primary', 'danger'],
  ['background-mask-overlay', 'scrim'],
  ['composer-bg', 'raised'],
  ['composer-shadow', 'shadow-composer'],
  ['font-ui', 'font-sans'],
  ['font-mono', 'font-mono'],
  ['radius-sm', 'radius-sm'],
  ['radius-md', 'radius-md'],
  ['radius-lg', 'radius-lg'],
  ['radius-xl', 'radius-xl'],
  ['radius-xxl', 'radius-sheet'],
]

const declsOf = (rule: Rule) => {
  const out = new Map<string, string>()
  rule.each((node) => {
    if (node.type === 'decl') {
      out.set(node.prop, node.value.trim())
    }
  })
  return out
}

const rootRules = (selector: string) => {
  const rules: Rule[] = []
  globalsRoot.walkRules((rule) => {
    if (rule.selector.replace(/\s+/g, ' ').trim() === selector) {
      rules.push(rule)
    }
  })
  return rules
}

describe('theme mapping onto Dango', () => {
  test('every mapped variable points at its Dango token', () => {
    const [lightRule] = rootRules(':root')
    const darkRules = rootRules(':root[data-mantine-color-scheme="dark"]')
    expect(lightRule).toBeDefined()
    expect(darkRules.length).toBeGreaterThan(0)
    const light = declsOf(lightRule)
    const dark = new Map<string, string>()
    for (const rule of darkRules) {
      for (const [prop, value] of declsOf(rule)) {
        dark.set(prop, value)
      }
    }

    const wrong: string[] = []
    for (const [name, token] of VARIABLE_MAP) {
      const prop = `--chatbox-${name}`
      if (light.get(prop) !== `var(--dango-${token})`) {
        wrong.push(`${prop}: light is ${light.get(prop)}, want var(--dango-${token})`)
      }
      if (dark.has(prop)) {
        wrong.push(`${prop}: still redeclared in the dark block`)
      }
    }
    expect(wrong).toEqual([])

    expect(light.get('--chatbox-background-brand-primary-hover')).toBe(
      'color-mix(in srgb, var(--dango-green) 88%, var(--dango-ink))'
    )
  })

  test('brand fills never carry white text in CSS', () => {
    const isBrandFill = (value: string) =>
      !value.includes('color-mix') &&
      (value.includes('--chatbox-background-brand-primary') || value.includes('--chatbox-tint-brand'))
    const isWhite = (value: string) =>
      ['#fff', '#ffffff', 'white', 'var(--chatbox-tint-white)', 'var(--mantine-color-white)'].includes(
        value
          .trim()
          .toLowerCase()
          .replace(/\s*!important$/, '')
      )

    const offenders: string[] = []
    globalsRoot.walkRules((rule) => {
      const decls = declsOf(rule)
      const fill = decls.get('background') ?? decls.get('background-color')
      const color = decls.get('color')
      const isFilledButtonRule = rule.selector.includes('data-variant="filled"')
      if (color && isWhite(color) && ((fill && isBrandFill(fill)) || isFilledButtonRule)) {
        offenders.push(`${rule.selector} (line ${rule.source?.start?.line})`)
      }
    })
    expect(offenders).toEqual([])
  })

  test('brand fills never carry white text in TSX', () => {
    const files: string[] = []
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name)
        if (entry.isDirectory()) {
          walk(full)
        } else if (entry.name.endsWith('.tsx')) {
          files.push(full)
        }
      }
    }
    walk(resolve(root, 'src/renderer'))

    const literal = /'[^'\n]*'|"[^"\n]*"|`[^`]*`/g
    const offenders: string[] = []
    for (const file of files) {
      const source = readFileSync(file, 'utf8')
      for (const match of source.matchAll(literal)) {
        const text = match[0]
        if (
          text.includes('bg-chatbox-background-brand-primary') &&
          /(^|[\s'"`:])(text-white|text-chatbox-tint-white)(?=$|[\s'"`])/.test(text)
        ) {
          const line = source.slice(0, match.index).split('\n').length
          offenders.push(`${file.replace(`${root}/`, '')}:${line}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  test('Mantine filled buttons use on-brand text', () => {
    const theme = createDangoMantineTheme()
    // biome-ignore lint/suspicious/noExplicitAny: resolvers are typed against Mantine's internal theme
    const components = theme.components as any
    const mantineTheme = {} as never
    const onBrand = 'var(--chatbox-tint-on-brand)'

    expect(components.Button.vars(mantineTheme, { variant: 'filled' }).root['--button-color']).toBe(onBrand)
    expect(components.ActionIcon.vars(mantineTheme, { variant: 'filled' }).root['--ai-color']).toBe(onBrand)
    expect(
      components.Button.vars(mantineTheme, { variant: 'filled', color: 'chatbox-brand' }).root['--button-color']
    ).toBe(onBrand)

    // danger and muted fills take the raised surface colour (see the contrast test below)
    for (const color of ['chatbox-error', 'chatbox-gray']) {
      const props = { variant: 'filled', color }
      expect(components.Button.vars(mantineTheme, props).root['--button-color']).toBe('var(--dango-raised)')
      expect(components.ActionIcon.vars(mantineTheme, props).root['--ai-color']).toBe('var(--dango-raised)')
    }

    for (const color of ['chatbox-success', 'blue']) {
      const props = { variant: 'filled', color }
      expect(components.Button.vars(mantineTheme, props).root).toEqual({})
      expect(components.ActionIcon.vars(mantineTheme, props).root).toEqual({})
    }
    expect(components.Button.vars(mantineTheme, { variant: 'light' }).root['--button-color']).toBeUndefined()

    expect(theme.fontFamily).toBe('var(--chatbox-font-ui)')
  })

  test('raised text on filled danger and muted controls is readable in both themes', () => {
    for (const mode of ['light', 'dark'] as const) {
      expect(
        contrastRatio(dangoColors[mode].raised, dangoColors[mode].danger),
        `raised on danger, ${mode}`
      ).toBeGreaterThanOrEqual(4.5)
      expect(
        contrastRatio(dangoColors[mode].raised, dangoColors[mode].muted),
        `raised on muted, ${mode}`
      ).toBeGreaterThanOrEqual(4.5)
    }
  })

  test('composer surface uses the Dango composer radius and send is green with on-green text', () => {
    const find = (selector: string) => rootRules(selector).map(declsOf)

    const cards = find('.composer-card').filter((decls) =>
      decls.get('background')?.startsWith('var(--chatbox-composer-bg')
    )
    expect(cards.length).toBeGreaterThan(0)
    for (const decls of cards) {
      expect(decls.get('border-radius')).toBe('var(--dango-radius-composer)')
    }

    const sends = find('.composer-send').filter((decls) => decls.has('background'))
    expect(sends.length).toBeGreaterThan(0)
    for (const decls of sends) {
      expect(decls.get('background')).toBe('var(--chatbox-background-brand-primary)')
      expect(decls.get('color')).toBe('var(--chatbox-tint-on-brand)')
    }
  })

  test('MUI follows Dango', () => {
    const light = getThemeDesign('light', 16, 'en')
    expect(light.palette?.primary).toMatchObject({ main: dangoColors.light.green })
    expect(light.palette?.background).toMatchObject({ default: dangoColors.light.ground })

    const dark = getThemeDesign('dark', 16, 'en')
    expect(dark.palette?.primary).toMatchObject({ main: dangoColors.dark.green })
    expect(dark.palette?.background).toMatchObject({
      default: dangoColors.dark.ground,
      paper: dangoColors.dark.raised,
    })
    expect(dark.palette?.text).toMatchObject({ primary: dangoColors.dark.ink, secondary: dangoColors.dark['ink-2'] })
    expect(dark.palette?.divider).toBe(dangoColors.dark.hairline)

    expect(light.typography).toMatchObject({ fontFamily: dangoFonts.sans, fontSize: 14 })
    expect(getThemeDesign('light', 16, 'ar').typography).toMatchObject({ fontFamily: 'Cairo, Arial, sans-serif' })
    expect(getThemeDesign('light', 20, 'en').typography).toMatchObject({ fontSize: 17.5 })
  })
})
