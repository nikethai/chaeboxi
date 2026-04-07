import { createStore, useStore } from 'zustand'
import { immer } from 'zustand/middleware/immer'

export type TaskStatus = 'pending' | 'in-progress' | 'done' | 'failed'

export type Task = {
  id: string
  sessionId: string
  title: string
  status: TaskStatus
  progress?: number
  createdAt: number
  updatedAt: number
}

type TaskState = {
  tasks: Task[]
  createTask: (sessionId: string, id: string, title: string) => void
  updateTask: (id: string, updates: { title?: string; status?: TaskStatus; progress?: number }) => void
  getSessionTasks: (sessionId: string) => Task[]
  clearSessionTasks: (sessionId: string) => void
}

let taskCounter = 0

export function generateTaskId(): string {
  taskCounter += 1
  return `task_${Date.now()}_${taskCounter}`
}

export const taskStore = createStore<TaskState>()(
  immer((set, get) => ({
    tasks: [],
    createTask: (sessionId, id, title) =>
      set((state) => {
        state.tasks.push({
          id,
          sessionId,
          title,
          status: 'pending',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })
      }),
    updateTask: (id, updates) =>
      set((state) => {
        const task = state.tasks.find((t) => t.id === id)
        if (task) {
          if (updates.title !== undefined) task.title = updates.title
          if (updates.status !== undefined) task.status = updates.status
          if (updates.progress !== undefined) task.progress = Math.max(0, Math.min(100, updates.progress))
          task.updatedAt = Date.now()
        }
      }),
    getSessionTasks: (sessionId) => {
      return get().tasks.filter((t) => t.sessionId === sessionId)
    },
    clearSessionTasks: (sessionId) =>
      set((state) => {
        state.tasks = state.tasks.filter((t) => t.sessionId !== sessionId)
      }),
  }))
)

export function useTaskStore<U>(selector: (state: TaskState) => U) {
  return useStore(taskStore, selector)
}
