import { describe, expect, it } from 'vitest'
import { chipDataFromToken } from './composer-chip-dom'

describe('composer-chip-dom', () => {
  it('chipDataFromToken defaults labels and kinds', () => {
    expect(chipDataFromToken('@product-manager').kind).toBe('agent')
    expect(chipDataFromToken('@product-manager').label.toLowerCase()).toContain('product')
    expect(chipDataFromToken('$code-review').label).toBe('code-review')
    expect(chipDataFromToken('#work-jira').kind).toBe('account')
    expect(chipDataFromToken('@mem:q3').kind).toBe('mem')
  })
})

// DOM serialize/create needs a browser environment (app uses contenteditable at runtime)
describe.runIf(typeof document !== 'undefined')('composer-chip-dom DOM', () => {
  it('serializes chips back to tokens', async () => {
    const { createComposerChipElement, serializeComposerDom } = await import('./composer-chip-dom')
    const root = document.createElement('div')
    root.appendChild(document.createTextNode('Hey '))
    root.appendChild(
      createComposerChipElement({
        kind: 'agent',
        token: '@product-manager',
        label: 'Product Manager',
      })
    )
    root.appendChild(document.createTextNode(' use '))
    root.appendChild(
      createComposerChipElement({
        kind: 'skill',
        token: '$code-review',
        label: 'code-review',
      })
    )
    expect(serializeComposerDom(root)).toBe('Hey @product-manager use $code-review')
  })
})
