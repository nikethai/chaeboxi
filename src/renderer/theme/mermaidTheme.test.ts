import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import { contrastRatio } from './contrast'
import { dangoColors } from './dangoTokens'
import { mermaidThemeVariables } from './mermaidTheme'

describe('Mermaid diagrams follow Dango', () => {
  test.each(['light', 'dark'] as const)('%s: every colour is a Dango token, borders are green', (mode) => {
    const vars = mermaidThemeVariables(mode)
    const palette = new Set(Object.values(dangoColors[mode]))
    for (const [name, value] of Object.entries(vars)) {
      if (value.startsWith('#')) {
        expect(palette.has(value), `${name}: ${value}`).toBe(true)
      }
    }
    expect(vars.primaryBorderColor).toBe(dangoColors[mode].green)
    expect(vars.nodeBorder).toBe(dangoColors[mode].green)
    expect(contrastRatio(vars.primaryTextColor, vars.primaryColor)).toBeGreaterThanOrEqual(4.5)
  })

  test('Mermaid.tsx takes its theme variables from Dango and has no hard-coded colours', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/renderer/components/Mermaid.tsx'), 'utf8')
    expect(source).toContain('themeVariables: mermaidThemeVariables(theme)')
    expect(source).not.toMatch(/#5b63d4/i)
  })
})
