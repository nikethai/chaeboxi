import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), 'utf8')

describe('mobile accessibility baseline', () => {
  test('does not lock viewport zoom', () => {
    const index = readSource('src/renderer/index.html')

    expect(index).not.toContain('user-scalable=no')
  })

  test('labels the model selector trigger and mobile search input', () => {
    const inputBox = readSource('src/renderer/components/InputBox/InputBox.tsx')
    const mobileModelSelector = readSource('src/renderer/components/ModelSelector/MobileModelSelector.tsx')

    expect(inputBox).toContain("aria-label={t('Select Model')}")
    expect(mobileModelSelector).toContain("aria-label={t('Search models') as string}")
    expect(mobileModelSelector).toContain('<Drawer.Title className="sr-only">')
  })
})
