import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import postcss, { type Rule } from 'postcss'
import { describe, expect, test } from 'vitest'
import { contrastRatio } from './contrast'
import { dangoColors, dangoFonts } from './dangoTokens'
import { createDangoMantineTheme, dangoCssVariablesResolver } from './mantineTheme'
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

const normalizeSelector = (selector: string) => selector.replace(/\s+/g, ' ').trim()

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

    // hovers are expressions over Dango tokens, in light only (the tokens flip for dark)
    const greenHover = 'color-mix(in srgb, var(--dango-green) 88%, var(--dango-ink))'
    const washHover = 'color-mix(in srgb, var(--dango-green-wash) 85%, var(--dango-green))'
    const hovers: Array<[string, string]> = [
      ['background-brand-primary-hover', greenHover],
      ['background-success-primary-hover', greenHover],
      ['background-brand-secondary-hover', washHover],
      ['background-success-secondary-hover', washHover],
    ]
    const wrongHovers: string[] = []
    for (const [name, value] of hovers) {
      const prop = `--chatbox-${name}`
      if (light.get(prop) !== value) {
        wrongHovers.push(`${prop}: light is ${light.get(prop)}, want ${value}`)
      }
      if (dark.has(prop)) {
        wrongHovers.push(`${prop}: still redeclared in the dark block`)
      }
    }
    expect(wrongHovers).toEqual([])
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

    // plain .composer-send must not set a fill (it would hit Stop and disabled)
    for (const decls of find('.composer-send')) {
      expect(decls.has('background')).toBe(false)
      expect(decls.has('color')).toBe(false)
    }

    const sends = find('.composer-send:not(.is-stop):not(:disabled)')
    expect(sends.length).toBe(1)
    expect(sends[0].get('background')).toBe('var(--chatbox-background-brand-primary)')
    expect(sends[0].get('color')).toBe('var(--chatbox-tint-on-brand)')
  })

  test('the Send button is green through its Mantine colour prop, Stop is dark', () => {
    const source = readSource('src/renderer/components/InputBox/InputBox.tsx')
    const labelAt = source.indexOf('aria-label={isSamplingVideoFrames')
    expect(labelAt).toBeGreaterThan(-1)
    const openTag = source.lastIndexOf('<ActionIcon', labelAt)
    const tag = source.slice(openTag, labelAt)
    expect(tag).toContain("color={showStop ? 'dark' : 'chatbox-brand'}")
    expect(tag).toContain("showStop && 'is-stop'")
  })

  test('the dark ground is Dango, not the old #121214', () => {
    const indexCss = readSource('src/renderer/static/index.css')
    const indexHtml = readSource('src/renderer/index.html')
    expect(/#121214/i.test(indexCss), 'index.css has #121214').toBe(false)
    expect(/#121214/i.test(indexHtml), 'index.html has #121214').toBe(false)

    // html/body/#root take the ground from the mapped variable, with no dark-only literal override
    const offenders: string[] = []
    postcss.parse(indexCss).walkRules((rule) => {
      const touchesPage = /(^|[\s,])(html|body|#root)(\[[^\]]*\])?(\s+body)?$/.test(rule.selector.trim())
      if (!touchesPage) {
        return
      }
      for (const [prop, value] of declsOf(rule)) {
        if (prop.startsWith('background') && !value.includes('var(--chatbox-background-primary')) {
          offenders.push(`${rule.selector} { ${prop}: ${value} }`)
        }
      }
    })
    expect(offenders).toEqual([])

    // the splash paints before CSS loads, so it keeps literals: they must be the Dango ground
    expect(indexHtml.includes(`background-color: ${dangoColors.dark.ground}`), 'splash dark ground').toBe(true)
    expect(indexHtml.includes(`background-color: ${dangoColors.light.ground}`), 'splash light ground').toBe(true)
  })

  test("Mantine's semantic colour variables resolve to Dango in both schemes", () => {
    const resolved = dangoCssVariablesResolver({} as never)
    const expected = {
      '--mantine-color-body': 'var(--dango-ground)',
      '--mantine-color-text': 'var(--dango-ink)',
      '--mantine-color-dimmed': 'var(--dango-muted)',
      '--mantine-color-placeholder': 'var(--dango-muted)',
      '--mantine-color-default-border': 'var(--dango-line)',
      '--mantine-color-default': 'var(--dango-raised)',
      '--mantine-color-default-hover': 'var(--dango-surface)',
      '--mantine-color-default-color': 'var(--dango-ink)',
    }
    expect(resolved.light).toMatchObject(expected)
    expect(resolved.dark).toMatchObject(expected)
  })

  test('Mantine inputs use the raised fill and the control border; the chevron is muted', () => {
    const theme = createDangoMantineTheme()
    // biome-ignore lint/suspicious/noExplicitAny: style resolvers are typed against Mantine's internal theme
    const components = theme.components as any
    const mantineTheme = {} as never

    const wrapper = components.Input.styles(mantineTheme, {}).wrapper
    expect(wrapper['--input-bg']).toBe('var(--dango-raised)')
    expect(wrapper['--input-bd']).toBe('var(--dango-control-border)')
    expect(wrapper['--input-color']).toBe('var(--dango-ink)')
    expect(wrapper['--input-placeholder-color']).toBe('var(--dango-muted)')

    for (const name of ['Input', 'TextInput', 'Textarea', 'Select', 'NativeSelect']) {
      const input = components[name].styles(mantineTheme, {}).input
      expect(input.backgroundColor, `${name} fill`).toBe('var(--dango-raised)')
      expect(input.borderColor, `${name} border`).toBe('var(--dango-control-border)')
      expect(input.color, `${name} text`).toBe('var(--dango-ink)')
    }

    expect(components.ComboboxChevron.vars(mantineTheme, {}).chevron['--combobox-chevron-color']).toBe(
      'var(--dango-muted)'
    )
    expect(components.ComboboxChevron.vars(mantineTheme, { error: 'bad' }).chevron).toEqual({})
  })

  test('the root MantineProvider passes the Dango variables resolver', () => {
    expect(readSource('src/renderer/routes/__root.tsx')).toContain('cssVariablesResolver={dangoCssVariablesResolver}')
  })

  test('no CSS rule gives a Mantine input a non-Dango fill or border', () => {
    const cssFiles: string[] = []
    const walkCss = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name)
        if (entry.isDirectory()) {
          walkCss(full)
        } else if (entry.name.endsWith('.css')) {
          cssFiles.push(full)
        }
      }
    }
    walkCss(resolve(root, 'src/renderer'))

    const INPUT_SELECTOR = /mantine-(Input|TextInput|Textarea|PasswordInput|Select|InputBase)-input/
    // bare inputs inside a panel: deliberately borderless and transparent, so they carry no fill or border to check
    // composer toolbar pickers (reasoning select, model trigger): borderless and transparent like the design
    // system's `.dg-model` (border: 0; background: transparent), asserted separately below
    const BARE = /model-picker-search-field|composer-reasoning-select|model-picker-trigger/
    const ALLOWED = [
      'var(--dango-raised)',
      'var(--dango-control-border)',
      'var(--dango-focus)',
      'var(--dango-danger)',
      'var(--chatbox-tint-brand)', // focus: maps onto green
      'var(--chatbox-tint-error)',
      'var(--chatbox-border-error)',
      'none',
      'transparent',
      '0',
      'inherit',
    ]
    const BORDER_WORDS = /^(\d+(\.\d+)?px|solid|dashed|none)$/
    const STATE_TOKENS = ALLOWED.filter((ok) => /focus|danger|error|tint-brand/.test(ok))
    const isAllowed = (value: string) => {
      const cleaned = value.replace(/\s*!important$/, '').trim()
      if (cleaned.startsWith('color-mix(')) {
        // translucent focus / error edges only
        return STATE_TOKENS.some((ok) => cleaned.includes(ok))
      }
      return cleaned
        .split(/\s+/)
        .filter((token) => !BORDER_WORDS.test(token))
        .every((token) => ALLOWED.includes(token))
    }

    const offenders: string[] = []
    for (const file of cssFiles) {
      postcss.parse(readFileSync(file, 'utf8')).walkRules((rule) => {
        if (!rule.selectors.some((sel) => INPUT_SELECTOR.test(sel) && !BARE.test(sel))) {
          return
        }
        rule.each((node) => {
          if (
            node.type === 'decl' &&
            ['background', 'background-color', 'border', 'border-color'].includes(node.prop)
          ) {
            if (!isAllowed(node.value)) {
              offenders.push(`${file.replace(`${root}/`, '')}:${node.source?.start?.line} ${node.prop}: ${node.value}`)
            }
          }
        })
      })
    }
    expect(offenders).toEqual([])
  })

  test('composer toolbar pickers are borderless and transparent (design system .dg-model)', () => {
    const PICKER = /(^|[^(])\.model-picker-trigger|composer-reasoning-select .*mantine-(Select|Input)-input/
    const all: Rule[] = []
    globalsRoot.walkRules((rule) => {
      if (rule.selectors.some((sel) => PICKER.test(normalizeSelector(sel)))) {
        all.push(rule)
      }
    })
    const strip = (value: string) => value.replace(/\s*!important$/, '').trim()
    const offenders: string[] = []
    for (const rule of all) {
      for (const [prop, value] of declsOf(rule)) {
        const v = strip(value)
        if (['background', 'background-color'].includes(prop) && !['transparent', 'var(--dango-surface)'].includes(v)) {
          offenders.push(`${rule.selector} { ${prop}: ${v} }`)
        }
        if (prop === 'border' && !['none', '0'].includes(v)) {
          offenders.push(`${rule.selector} { ${prop}: ${v} }`)
        }
        if (prop === 'box-shadow' && v !== 'none') {
          offenders.push(`${rule.selector} { ${prop}: ${v} }`)
        }
      }
    }
    expect(offenders).toEqual([])

    const find = (selector: string) => rootRules(selector).map(declsOf)
    const trigger = find('.model-picker-trigger')[0]
    expect(trigger.get('background')).toBe('transparent')
    expect(trigger.get('border')).toBe('none')
    expect(trigger.get('box-shadow')).toBe('none')
    expect(find('.model-picker-trigger:hover')[0].get('background')).toBe('var(--dango-surface)')

    // desktop select: inline Mantine styles need !important to lose
    const select = find('.composer-bar .composer-reasoning-select .mantine-Select-input')[0]
    const importantProps = (selector: string) => {
      const props: string[] = []
      for (const rule of rootRules(selector)) {
        rule.each((node) => {
          if (node.type === 'decl' && node.important) {
            props.push(node.prop)
          }
        })
      }
      return props
    }
    const selectSelector = '.composer-bar .composer-reasoning-select .mantine-Select-input'
    expect(select.get('background')).toBe('transparent')
    expect(select.get('border')).toBe('0')
    expect(select.get('box-shadow')).toBe('none')
    expect(select.get('color')).toBe('var(--dango-ink-2)')
    expect(importantProps(selectSelector)).toEqual(['background', 'border', 'box-shadow', 'color'])
    expect(find(`${selectSelector}:hover`)[0].get('background')).toBe('var(--dango-surface)')

    // the dock silences focus rings; the pickers bring the global one back
    for (const selector of [
      '.composer-card .model-picker-trigger:focus-visible',
      '.composer-card .composer-reasoning-select .mantine-Select-input:focus-visible',
    ]) {
      let decls: Map<string, string> | undefined
      globalsRoot.walkRules((rule) => {
        if (rule.selectors.some((sel) => normalizeSelector(sel) === selector)) {
          decls = declsOf(rule)
        }
      })
      expect(decls?.get('outline'), selector).toBe('2px solid var(--dango-focus)')
      expect(globalsCss.includes('outline: 2px solid var(--dango-focus) !important;'), selector).toBe(true)
      expect(decls?.get('outline-offset'), selector).toBe('2px')
    }
  })

  test('the Sidebar folder dialog input uses the raised fill and the control border', () => {
    const source = readSource('src/renderer/Sidebar.tsx')
    expect(source).not.toContain("background: 'var(--chatbox-background-primary)'")
    expect(source).not.toContain("borderColor: 'var(--chatbox-border-secondary)'")
    expect(source).toContain("background: 'var(--dango-raised)'")
    expect(source).toContain("borderColor: 'var(--dango-control-border)'")
  })

  test('the global focus ring is 2px solid --dango-focus with a 2px offset', () => {
    const rules = rootRules(':focus-visible')
    expect(rules.length).toBe(1)
    const decls = declsOf(rules[0])
    expect(decls.get('outline')).toBe('2px solid var(--dango-focus)')
    expect(decls.get('outline-offset')).toBe('2px')
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
