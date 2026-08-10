import { describe, expect, it, vi } from 'vitest'
import type { Task } from '@/stores/taskStore'
import { sortTasksForDisplay } from './TaskProgress'

vi.mock('@/hooks/useScreenChange', () => ({
  useIsSmallScreen: () => false,
}))

function task(partial: Partial<Task> & Pick<Task, 'id' | 'status'>): Task {
  return {
    sessionId: 's1',
    title: partial.title ?? partial.id,
    createdAt: partial.createdAt ?? 0,
    updatedAt: partial.updatedAt ?? 0,
    ...partial,
  }
}

describe('sortTasksForDisplay', () => {
  it('orders in-progress, pending, failed, then done', () => {
    const sorted = sortTasksForDisplay([
      task({ id: 'd', status: 'done', createdAt: 1 }),
      task({ id: 'p', status: 'pending', createdAt: 2 }),
      task({ id: 'f', status: 'failed', createdAt: 3 }),
      task({ id: 'i', status: 'in-progress', createdAt: 4 }),
    ])
    expect(sorted.map((t) => t.id)).toEqual(['i', 'p', 'f', 'd'])
  })

  it('stable by createdAt within the same status', () => {
    const sorted = sortTasksForDisplay([
      task({ id: 'b', status: 'pending', createdAt: 20 }),
      task({ id: 'a', status: 'pending', createdAt: 10 }),
    ])
    expect(sorted.map((t) => t.id)).toEqual(['a', 'b'])
  })
})
