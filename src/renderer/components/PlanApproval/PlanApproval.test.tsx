/**
 * @vitest-environment jsdom
 */

import { MantineProvider } from '@mantine/core'
import type { MessagePlanPart } from '@shared/types'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import PlanApproval from './PlanApproval'

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

const pendingPlan: MessagePlanPart = {
  type: 'plan',
  planText: 'Inspect the issue, implement the fix, then validate it.',
  status: 'pending',
}

function renderPlanApproval(overrides?: Partial<React.ComponentProps<typeof PlanApproval>>) {
  const props: React.ComponentProps<typeof PlanApproval> = {
    planPart: pendingPlan,
    onApprove: vi.fn().mockResolvedValue(undefined),
    onRequestChanges: vi.fn().mockResolvedValue(undefined),
    onReject: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }

  render(
    <MantineProvider>
      <PlanApproval {...props} />
    </MantineProvider>
  )

  return props
}

describe('PlanApproval', () => {
  it('submits inline revision feedback without approving the plan', async () => {
    const onApprove = vi.fn().mockResolvedValue(undefined)
    const onRequestChanges = vi.fn().mockResolvedValue(undefined)
    renderPlanApproval({ onApprove, onRequestChanges })

    fireEvent.click(screen.getByRole('button', { name: 'Request changes' }))

    const feedback = screen.getByLabelText('Request changes')
    fireEvent.change(feedback, { target: { value: 'Add a rollback step before deployment.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Request revised plan' }))

    await waitFor(() => {
      expect(onRequestChanges).toHaveBeenCalledWith('Add a rollback step before deployment.')
    })
    expect(onApprove).not.toHaveBeenCalled()
  })

  it('requires feedback before submitting a revision request', () => {
    renderPlanApproval()

    fireEvent.click(screen.getByRole('button', { name: 'Request changes' }))

    expect(screen.getByRole('button', { name: 'Request revised plan' }).hasAttribute('disabled')).toBe(true)
  })
})
