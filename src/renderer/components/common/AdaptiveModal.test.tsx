/**
 * @vitest-environment jsdom
 */

import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { AdaptiveModal } from './AdaptiveModal'

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: () => ({
    addEventListener: vi.fn(),
    matches: false,
    removeEventListener: vi.fn(),
  }),
})

vi.mock('@/hooks/useScreenChange', () => ({
  useIsSmallScreen: () => true,
}))

describe('AdaptiveModal.Actions', () => {
  it('keeps the mobile divider by default', () => {
    render(
      <MantineProvider>
        <AdaptiveModal.Actions>
          <button type="button">Default action</button>
        </AdaptiveModal.Actions>
      </MantineProvider>
    )

    expect(screen.getByRole('button', { name: 'Default action' }).parentElement?.classList.contains('border-t')).toBe(
      true
    )
  })

  it('can omit the mobile divider for a single CTA action slot', () => {
    render(
      <MantineProvider>
        <AdaptiveModal.Actions withoutDivider>
          <button type="button">Add</button>
        </AdaptiveModal.Actions>
      </MantineProvider>
    )

    expect(screen.getByRole('button', { name: 'Add' }).parentElement?.classList.contains('border-t')).toBe(false)
  })
})
