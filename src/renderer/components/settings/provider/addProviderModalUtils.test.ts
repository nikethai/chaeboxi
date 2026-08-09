/**
 * @vitest-environment jsdom
 */

import { blurActiveElement } from './addProviderModalUtils'

describe('blurActiveElement', () => {
  it('clears focus from the provider-list trigger before the mobile Add sheet opens', () => {
    const trigger = document.createElement('button')
    document.body.append(trigger)
    trigger.focus()

    blurActiveElement()

    expect(document.activeElement).toBe(document.body)
  })
})
