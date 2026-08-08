import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatActiveTaskContext, generateTaskId, MAX_SESSION_TASKS, taskStore } from './taskStore'

const storageMock = vi.hoisted(() => ({
  getItem: vi.fn(async (_key: string, initial: unknown) => initial),
  setItem: vi.fn(async () => undefined),
  setItemNow: vi.fn(async () => undefined),
  removeItem: vi.fn(async () => undefined),
}))

vi.mock('@/storage', () => ({
  default: storageMock,
}))

vi.mock('@/storage/StoreStorage', () => ({
  StorageKeyGenerator: {
    sessionTasks: (sessionId: string) => `session:${sessionId}:tasks`,
  },
}))

describe('taskStore', () => {
  beforeEach(() => {
    taskStore.getState()._resetForTests()
    storageMock.getItem.mockReset()
    storageMock.setItem.mockReset()
    storageMock.setItemNow.mockReset()
    storageMock.removeItem.mockReset()
    storageMock.getItem.mockImplementation(async (_key: string, initial: unknown) => initial)
  })

  afterEach(() => {
    taskStore.getState()._resetForTests()
  })

  describe('createTask', () => {
    it('should create a task with pending status', () => {
      const id = generateTaskId()
      const result = taskStore.getState().createTask('session-1', id, 'Test task')
      expect(result.ok).toBe(true)
      const tasks = taskStore.getState().getSessionTasks('session-1')

      expect(tasks).toHaveLength(1)
      expect(tasks[0]).toMatchObject({
        id,
        sessionId: 'session-1',
        title: 'Test task',
        status: 'pending',
      })
      expect(tasks[0].createdAt).toBeTypeOf('number')
      expect(tasks[0].updatedAt).toBeTypeOf('number')
    })

    it('should create multiple tasks in the same session', () => {
      const id1 = generateTaskId()
      const id2 = generateTaskId()
      taskStore.getState().createTask('session-1', id1, 'Task 1')
      taskStore.getState().createTask('session-1', id2, 'Task 2')

      const tasks = taskStore.getState().getSessionTasks('session-1')
      expect(tasks).toHaveLength(2)
    })

    it('should reject empty titles', () => {
      const result = taskStore.getState().createTask('session-1', generateTaskId(), '   ')
      expect(result.ok).toBe(false)
      expect(taskStore.getState().getSessionTasks('session-1')).toHaveLength(0)
    })

    it('should enforce max session task cap', () => {
      for (let i = 0; i < MAX_SESSION_TASKS; i++) {
        const r = taskStore.getState().createTask('session-1', `id-${i}`, `Task ${i}`)
        expect(r.ok).toBe(true)
      }
      const overflow = taskStore.getState().createTask('session-1', 'overflow', 'Too many')
      expect(overflow.ok).toBe(false)
      expect(taskStore.getState().getSessionTasks('session-1')).toHaveLength(MAX_SESSION_TASKS)
    })
  })

  describe('updateTask', () => {
    it('should update task status', () => {
      const id = generateTaskId()
      taskStore.getState().createTask('session-1', id, 'Test task')
      taskStore.getState().updateTask(id, { status: 'in-progress' })

      const task = taskStore.getState().tasks.find((t) => t.id === id)
      expect(task?.status).toBe('in-progress')
    })

    it('should keep only one task in progress per session', () => {
      const firstId = generateTaskId()
      const secondId = generateTaskId()
      taskStore.getState().createTask('session-1', firstId, 'First task')
      taskStore.getState().createTask('session-1', secondId, 'Second task')

      taskStore.getState().updateTask(firstId, { status: 'in-progress', progress: 40 })
      taskStore.getState().updateTask(secondId, { status: 'in-progress' })

      const firstTask = taskStore.getState().tasks.find((task) => task.id === firstId)
      expect(firstTask?.status).toBe('pending')
      expect(firstTask).not.toHaveProperty('progress')
      expect(taskStore.getState().tasks.find((task) => task.id === secondId)?.status).toBe('in-progress')
    })

    it('normalizes done and reopened task progress', () => {
      const id = generateTaskId()
      taskStore.getState().createTask('session-1', id, 'Reopen me')

      taskStore.getState().updateTask(id, { status: 'done', progress: 20 })
      expect(taskStore.getState().tasks.find((task) => task.id === id)).toMatchObject({
        status: 'done',
        progress: 100,
      })

      taskStore.getState().updateTask(id, { status: 'pending' })
      const reopenedTask = taskStore.getState().tasks.find((task) => task.id === id)
      expect(reopenedTask?.status).toBe('pending')
      expect(reopenedTask).not.toHaveProperty('progress')
    })

    it('should update task title', () => {
      const id = generateTaskId()
      taskStore.getState().createTask('session-1', id, 'Old title')
      taskStore.getState().updateTask(id, { title: 'New title' })

      const task = taskStore.getState().tasks.find((t) => t.id === id)
      expect(task?.title).toBe('New title')
    })

    it('should update task progress and clamp to 0-100', () => {
      const id = generateTaskId()
      taskStore.getState().createTask('session-1', id, 'Test task')

      taskStore.getState().updateTask(id, { progress: 50 })
      expect(taskStore.getState().tasks.find((t) => t.id === id)?.progress).toBe(50)

      taskStore.getState().updateTask(id, { progress: 150 })
      expect(taskStore.getState().tasks.find((t) => t.id === id)?.progress).toBe(100)

      taskStore.getState().updateTask(id, { progress: -10 })
      expect(taskStore.getState().tasks.find((t) => t.id === id)?.progress).toBe(0)
    })

    it('should not fail when updating non-existent task', () => {
      expect(() => {
        taskStore.getState().updateTask('non-existent', { status: 'done' })
      }).not.toThrow()
    })

    it('should update the updatedAt timestamp', () => {
      const id = generateTaskId()
      taskStore.getState().createTask('session-1', id, 'Test task')
      const createdAt = taskStore.getState().tasks.find((t) => t.id === id)?.updatedAt ?? 0

      taskStore.getState().updateTask(id, { status: 'done' })
      const updatedAt = taskStore.getState().tasks.find((t) => t.id === id)?.updatedAt ?? 0

      expect(updatedAt).toBeGreaterThanOrEqual(createdAt)
    })
  })

  describe('toggleTaskDone', () => {
    it('should toggle between done and pending', () => {
      const id = generateTaskId()
      taskStore.getState().createTask('session-1', id, 'Toggle me')
      taskStore.getState().toggleTaskDone(id)
      expect(taskStore.getState().tasks.find((t) => t.id === id)?.status).toBe('done')
      taskStore.getState().toggleTaskDone(id)
      expect(taskStore.getState().tasks.find((t) => t.id === id)?.status).toBe('pending')
    })
  })

  describe('getSessionTasks', () => {
    it('should return only tasks for the given session', () => {
      taskStore.getState().createTask('session-1', generateTaskId(), 'Task A')
      taskStore.getState().createTask('session-2', generateTaskId(), 'Task B')
      taskStore.getState().createTask('session-1', generateTaskId(), 'Task C')

      const session1Tasks = taskStore.getState().getSessionTasks('session-1')
      const session2Tasks = taskStore.getState().getSessionTasks('session-2')

      expect(session1Tasks).toHaveLength(2)
      expect(session2Tasks).toHaveLength(1)
    })

    it('should return empty array for unknown session', () => {
      const tasks = taskStore.getState().getSessionTasks('unknown')
      expect(tasks).toHaveLength(0)
    })
  })

  describe('clearSessionTasks', () => {
    it('should clear only tasks for the given session', () => {
      taskStore.getState().createTask('session-1', generateTaskId(), 'Task A')
      taskStore.getState().createTask('session-2', generateTaskId(), 'Task B')

      taskStore.getState().clearSessionTasks('session-1')

      expect(taskStore.getState().getSessionTasks('session-1')).toHaveLength(0)
      expect(taskStore.getState().getSessionTasks('session-2')).toHaveLength(1)
      expect(storageMock.removeItem).toHaveBeenCalled()
    })
  })

  describe('hydrateSessionTasks', () => {
    it('should load tasks from storage once', async () => {
      storageMock.getItem.mockResolvedValueOnce([
        {
          id: 'disk-1',
          sessionId: 'session-1',
          title: 'From disk',
          status: 'pending',
          createdAt: 1,
          updatedAt: 1,
        },
      ])

      await taskStore.getState().hydrateSessionTasks('session-1')
      expect(taskStore.getState().getSessionTasks('session-1')).toHaveLength(1)
      expect(taskStore.getState().getSessionTasks('session-1')[0].title).toBe('From disk')

      // Second hydrate should no-op
      storageMock.getItem.mockClear()
      await taskStore.getState().hydrateSessionTasks('session-1')
      expect(storageMock.getItem).not.toHaveBeenCalled()
    })
  })

  describe('generateTaskId', () => {
    it('should return unique IDs', () => {
      const id1 = generateTaskId()
      const id2 = generateTaskId()
      expect(id1).not.toBe(id2)
    })

    it('should start with task_ prefix', () => {
      const id = generateTaskId()
      expect(id).toMatch(/^task_/)
    })
  })

  describe('formatActiveTaskContext', () => {
    it('includes active tasks and excludes terminal task details', () => {
      const first = taskStore.getState().createTask('session-1', 'pending-id', 'Continue this task')
      const second = taskStore.getState().createTask('session-1', 'done-id', 'Already complete')
      expect(first.ok).toBe(true)
      expect(second.ok).toBe(true)
      taskStore.getState().updateTask('pending-id', { status: 'in-progress', progress: 35 })
      taskStore.getState().updateTask('done-id', { status: 'done' })

      const context = formatActiveTaskContext(taskStore.getState().getSessionTasks('session-1'))

      expect(context).toContain('pending-id')
      expect(context).toContain('Continue this task')
      expect(context).toContain('35%')
      expect(context).not.toContain('Already complete')
      expect(context).toContain('Completed: 1')
    })
  })
})
