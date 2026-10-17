import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import { composerToolbarButtonClass } from './composerToolbar'

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), 'utf8')

describe('mobile touch target contract', () => {
  test('gives high-frequency composer controls a 44px mobile target', () => {
    const inputBox = readSource('src/renderer/components/InputBox/InputBox.tsx')
    const toolsMenu = readSource('src/renderer/components/InputBox/ComposerToolsMenu.tsx')
    const actionIconStyles = readSource('src/renderer/components/InputBox/actionIconStyles.ts')
    const styles = readSource('src/renderer/static/globals.css')

    expect(inputBox).toContain("'mobile-touch-target'")
    // the Tools and Dictate buttons share the toolbar class, which carries the target on small screens
    expect(toolsMenu).toContain('composerToolbarButtonClass(isSmallScreen)')
    expect(composerToolbarButtonClass(true).split(' ')).toContain('mobile-touch-target')
    expect(actionIconStyles).toContain('w: 44')
    expect(actionIconStyles).toContain('h: 44')
    expect(styles).toContain('.mobile-touch-target')
    expect(styles).toContain('min-height: 44px')
  })

  test('keeps mobile sidebar navigation and drawer actions at least 44px tall', () => {
    const styles = readSource('src/renderer/static/globals.css')

    expect(styles).toContain('.rail-nav-item')
    expect(styles).toContain('min-height: 44px')
    expect(styles).toContain('.rail-foot .mantine-Menu-item')
  })
})
