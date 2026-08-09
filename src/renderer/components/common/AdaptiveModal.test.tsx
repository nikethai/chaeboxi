/**
 * @vitest-environment jsdom
 */

import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { AdaptiveModal } from './AdaptiveModal'

const { useIsSmallScreen } = vi.hoisted(() => ({
  useIsSmallScreen: vi.fn(),
}))

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: () => ({
    addEventListener: vi.fn(),
    matches: false,
    removeEventListener: vi.fn(),
  }),
})

vi.mock('@/hooks/useScreenChange', () => ({
  useIsSmallScreen,
}))

function renderActions() {
  render(
    <MantineProvider>
      <AdaptiveModal.Actions>
        <button type="button">Cancel</button>
        <button type="button">Save</button>
      </AdaptiveModal.Actions>
    </MantineProvider>
  )

  return screen.getByRole('button', { name: 'Save' }).parentElement
}

describe('AdaptiveModal.Actions', () => {
  it('uses the unframed reversed stack for multiple mobile actions', () => {
    useIsSmallScreen.mockReturnValue(true)

    const actions = renderActions()

    expect(actions).not.toBeNull()
    expect(actions?.classList.contains('flex-col-reverse')).toBe(true)
    expect(actions?.classList.contains('mantine-Stack-root')).toBe(true)
    expect(actions?.classList.contains('border-t')).toBe(false)
  })

  it('keeps the desktop Flex action layout', () => {
    useIsSmallScreen.mockReturnValue(false)

    const actions = renderActions()

    expect(actions).not.toBeNull()
    expect(actions?.classList.contains('mantine-Flex-root')).toBe(true)
    expect(actions?.classList.contains('flex-col-reverse')).toBe(false)
    expect(actions?.classList.contains('border-t')).toBe(false)
  })
})
