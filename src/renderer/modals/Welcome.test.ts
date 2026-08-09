import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), 'utf8')

describe('Welcome onboarding mobile layout', () => {
  test('keeps long benefit copy within the sheet width at enlarged text scale', () => {
    const welcome = readSource('src/renderer/modals/Welcome.tsx')

    expect(welcome).toContain('className="w-full min-w-0"')
    expect(welcome).toContain('className="flex flex-col items-stretch"')
  })
})
