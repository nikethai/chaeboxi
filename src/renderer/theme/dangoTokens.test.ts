import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import { contrastRatio } from './contrast'
import { type DangoColor, dangoColors } from './dangoTokens'
import { type DangoTokensJson, renderDangoTokensCss, renderDangoTokensTs } from './renderDangoTokens'

const root = process.cwd()
const tokensPath = resolve(root, 'design/dango/tokens.json')
const cssPath = resolve(root, 'src/renderer/static/dango-tokens.css')
const tsPath = resolve(root, 'src/renderer/theme/dangoTokens.ts')

const tokens = JSON.parse(readFileSync(tokensPath, 'utf8')) as DangoTokensJson

describe('Dango tokens', () => {
  test('generated files match tokens.json', () => {
    const css = renderDangoTokensCss(tokens)
    const ts = renderDangoTokensTs(tokens)
    if (process.env.UPDATE_DANGO_TOKENS === '1') {
      writeFileSync(cssPath, css)
      writeFileSync(tsPath, ts)
      return
    }
    expect(readFileSync(cssPath, 'utf8')).toBe(css)
    expect(readFileSync(tsPath, 'utf8')).toBe(ts)
  })

  test('dark values sit under both dark selectors', () => {
    const css = readFileSync(cssPath, 'utf8')
    const darkHeader = ':root[data-mantine-color-scheme="dark"],\n:root[data-theme="dark"] {'
    const darkStart = css.indexOf(darkHeader)
    expect(darkStart).toBeGreaterThan(-1)
    const darkBlock = css.slice(darkStart, css.indexOf('}', darkStart))
    expect(darkBlock).toContain('--dango-green: #4fb894;')

    const lightStart = css.indexOf(':root {')
    expect(lightStart).toBeGreaterThan(-1)
    const lightBlock = css.slice(lightStart, css.indexOf('}', lightStart))
    expect(lightBlock).toContain('--dango-green: #1f7a63;')
  })

  test('text pairs pass contrast in both themes', () => {
    const grounds: DangoColor[] = ['ground', 'surface', 'raised']
    const textOnGrounds: DangoColor[] = ['ink', 'ink-2', 'muted', 'danger']
    const textPairs: Array<[DangoColor, DangoColor]> = [
      ['green-text', 'green-wash'],
      ['blue-text', 'blue-wash'],
      ['amber-text', 'amber-wash'],
      ['on-green', 'green'],
      ['on-blue', 'blue'],
      ['on-toast', 'toast'],
    ]
    const failures: string[] = []
    const check = (theme: 'light' | 'dark', fg: DangoColor, bg: DangoColor, min: number) => {
      const ratio = contrastRatio(dangoColors[theme][fg], dangoColors[theme][bg])
      if (ratio < min) {
        failures.push(`${theme}: ${fg} on ${bg} = ${ratio.toFixed(2)} (< ${min})`)
      }
    }

    for (const theme of ['light', 'dark'] as const) {
      for (const fg of textOnGrounds) {
        for (const bg of grounds) {
          check(theme, fg, bg, 4.5)
        }
      }
      for (const [fg, bg] of textPairs) {
        check(theme, fg, bg, 4.5)
      }
      check(theme, 'control-border', 'ground', 3)
      check(theme, 'control-border', 'raised', 3)
    }
    expect(failures).toEqual([])
  })

  test('contrastRatio matches the known white on green value', () => {
    const ratio = contrastRatio('#ffffff', '#1f7a63')
    expect(ratio).toBeGreaterThan(5.2)
    expect(ratio).toBeLessThan(5.3)
  })
})
