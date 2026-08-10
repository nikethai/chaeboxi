/**
 * @vitest-environment jsdom
 */

import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { type Task, taskStore } from '@/stores/taskStore'
import { TaskProgress } from './TaskProgress'

const { useIsSmallScreen } = vi.hoisted(() => ({
  useIsSmallScreen: vi.fn(),
}))

vi.mock('@/hooks/useScreenChange', () => ({
  useIsSmallScreen,
}))

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

function createTask(partial: Partial<Task> & Pick<Task, 'id' | 'status'>): Task {
  return {
    sessionId: 'session-1',
    title: partial.title ?? partial.id,
    createdAt: partial.createdAt ?? 1,
    updatedAt: partial.updatedAt ?? 1,
    ...partial,
  }
}

function renderTaskProgress(
  sessionId = 'session-1',
  onContinue = vi.fn(),
  detailsMode: 'inline' | 'sheet' = 'inline'
) {
  return render(
    <MantineProvider>
      <TaskProgress sessionId={sessionId} onContinue={onContinue} detailsMode={detailsMode} />
    </MantineProvider>
  )
}

beforeEach(() => {
  useIsSmallScreen.mockReturnValue(false)
  taskStore.getState()._resetForTests()
})

afterEach(() => {
  taskStore.getState()._resetForTests()
})

describe('TaskProgress UI', () => {
  it('renders nothing when the session has no tasks', () => {
    renderTaskProgress()

    expect(screen.queryByRole('button', { name: /Tasks/ })).toBeNull()
  })

  it('expands task details inline on desktop and continues remaining work', () => {
    const onContinue = vi.fn()
    taskStore
      .getState()
      .replaceSessionTasks('session-1', [
        createTask({ id: 'active', status: 'in-progress', title: 'Implement dock', progress: 40 }),
        createTask({ id: 'done', status: 'done', title: 'Review layout', createdAt: 2 }),
      ])

    renderTaskProgress('session-1', onContinue)

    const trigger = screen.getByRole('button', { name: /Tasks/ })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(trigger)

    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getAllByText('Implement dock')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Continue remaining work' }))
    expect(onContinue).toHaveBeenCalledTimes(1)
  })

  it('opens task details in a bottom sheet on small screens', async () => {
    useIsSmallScreen.mockReturnValue(true)
    const onContinue = vi.fn()
    taskStore
      .getState()
      .replaceSessionTasks('session-1', [createTask({ id: 'active', status: 'pending', title: 'Finish mobile sheet' })])

    renderTaskProgress('session-1', onContinue)
    const trigger = screen.getByRole('button', { name: /Tasks/ })
    fireEvent.click(trigger)

    const dialog = await screen.findByRole('dialog', { name: 'Tasks' })
    expect(dialog).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Continue remaining work' }))

    expect(onContinue).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(trigger.getAttribute('aria-expanded')).toBe('false'))
  })

  it('forces sheet details in quick-chat mode even on desktop widths', async () => {
    useIsSmallScreen.mockReturnValue(false)
    const onContinue = vi.fn()
    taskStore
      .getState()
      .replaceSessionTasks('session-1', [
        createTask({ id: 'active', status: 'pending', title: 'Stay in sheet for quick chat' }),
      ])

    renderTaskProgress('session-1', onContinue, 'sheet')
    const trigger = screen.getByRole('button', { name: /Tasks/ })
    fireEvent.click(trigger)

    const dialog = await screen.findByRole('dialog', { name: 'Tasks' })
    expect(dialog).toBeTruthy()
    // Inline expanded list must not appear outside the sheet dialog
    expect(screen.queryByText('Stay in sheet for quick chat')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Continue remaining work' }))
    expect(onContinue).toHaveBeenCalledTimes(1)
  })

  it('resets expanded state when the session changes', async () => {
    taskStore.getState().replaceSessionTasks('session-1', [createTask({ id: 'one', status: 'pending' })])
    taskStore
      .getState()
      .replaceSessionTasks('session-2', [createTask({ id: 'two', status: 'pending', sessionId: 'session-2' })])

    const view = renderTaskProgress('session-1')
    fireEvent.click(screen.getByRole('button', { name: /Tasks/ }))
    expect(screen.getByRole('button', { name: /Tasks/ }).getAttribute('aria-expanded')).toBe('true')

    view.rerender(
      <MantineProvider>
        <TaskProgress key="session-2" sessionId="session-2" />
      </MantineProvider>
    )

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Tasks/ }).getAttribute('aria-expanded')).toBe('false')
    )
    fireEvent.click(screen.getByRole('button', { name: /Tasks/ }))
    expect(screen.getByText('two')).toBeTruthy()
    expect(screen.queryByText('one')).toBeNull()
  })
})
