import { afterEach, describe, expect, it } from 'vitest'
import { generateTaskId, taskStore } from './taskStore'

describe('taskStore', () => {
  afterEach(() => {
    // Clear all tasks between tests
    const state = taskStore.getState()
    const sessionIds = [...new Set(state.tasks.map((t) => t.sessionId))]
    for (const sid of sessionIds) {
      state.clearSessionTasks(sid)
    }
  })

  describe('createTask', () => {
    it('should create a task with pending status', () => {
      const id = generateTaskId()
      taskStore.getState().createTask('session-1', id, 'Test task')
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
  })

  describe('updateTask', () => {
    it('should update task status', () => {
      const id = generateTaskId()
      taskStore.getState().createTask('session-1', id, 'Test task')
      taskStore.getState().updateTask(id, { status: 'in-progress' })

      const task = taskStore.getState().tasks.find((t) => t.id === id)
      expect(task?.status).toBe('in-progress')
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
})
