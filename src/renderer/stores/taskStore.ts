import { createStore, useStore } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import storage from '@/storage'
import { StorageKeyGenerator } from '@/storage/StoreStorage'

export type TaskStatus = 'pending' | 'in-progress' | 'done' | 'failed'

export type TaskCreatedBy = 'orchestrator' | 'agent' | 'user'

export type Task = {
  id: string
  sessionId: string
  title: string
  status: TaskStatus
  progress?: number
  /** Room agent persona id assigned to this task (Swarm multi-owner board). */
  assigneeAgentId?: string
  /** Task ids that must be `done` before this task is ready. */
  dependsOn?: string[]
  createdBy?: TaskCreatedBy
  createdAt: number
  updatedAt: number
}

export type CreateTaskOptions = {
  assigneeAgentId?: string
  dependsOn?: string[]
  createdBy?: TaskCreatedBy
}

export type UpdateTaskFields = {
  title?: string
  status?: TaskStatus
  progress?: number
  assigneeAgentId?: string | null
  dependsOn?: string[] | null
}

export const MAX_SESSION_TASKS = 20

type TaskState = {
  tasks: Task[]
  /** Sessions currently hydrated from storage (avoids re-fetch thrash). */
  hydratedSessionIds: Record<string, true>
  createTask: (
    sessionId: string,
    id: string,
    title: string,
    options?: CreateTaskOptions
  ) => { ok: true; task: Task } | { ok: false; error: string }
  updateTask: (id: string, updates: UpdateTaskFields) => Task | null
  setTaskAssignee: (id: string, assigneeAgentId: string | undefined) => Task | null
  setTaskDeps: (id: string, dependsOn: string[] | undefined) => Task | null
  /** Pending tasks whose dependencies are all done (stable createdAt order). */
  listReadyTasks: (sessionId: string) => Task[]
  toggleTaskDone: (id: string) => Task | null
  getSessionTasks: (sessionId: string) => Task[]
  clearSessionTasks: (sessionId: string) => void
  replaceSessionTasks: (sessionId: string, tasks: Task[]) => void
  hydrateSessionTasks: (sessionId: string) => Promise<void>
  /** Test helper: reset store without touching storage */
  _resetForTests: () => void
}

let taskCounter = 0

export function generateTaskId(): string {
  taskCounter += 1
  return `task_${Date.now()}_${taskCounter}`
}

const persistTimers = new Map<string, ReturnType<typeof setTimeout>>()

function schedulePersist(sessionId: string, getTasks: () => Task[]) {
  const existing = persistTimers.get(sessionId)
  if (existing) clearTimeout(existing)
  const timer = setTimeout(() => {
    persistTimers.delete(sessionId)
    const tasks = getTasks()
    void storage.setItem(StorageKeyGenerator.sessionTasks(sessionId), tasks).catch((err) => {
      console.error('Failed to persist session tasks', sessionId, err)
    })
  }, 300)
  persistTimers.set(sessionId, timer)
}

async function persistNow(sessionId: string, tasks: Task[]) {
  const existing = persistTimers.get(sessionId)
  if (existing) {
    clearTimeout(existing)
    persistTimers.delete(sessionId)
  }
  await storage.setItemNow(StorageKeyGenerator.sessionTasks(sessionId), tasks)
}

function normalizeTitle(title: string): string {
  return title.replace(/\s+/g, ' ').trim()
}

function sanitizeDependsOn(dependsOn: string[] | undefined, selfId: string): string[] {
  if (!dependsOn?.length) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const dep of dependsOn) {
    if (!dep || dep === selfId || seen.has(dep)) continue
    seen.add(dep)
    out.push(dep)
  }
  return out
}

/** Pure ready-queue helper (also used by tests without store). */
export function listReadyTasksFrom(tasks: Task[]): Task[] {
  const byId = new Map(tasks.map((t) => [t.id, t]))
  return tasks
    .filter((task) => {
      if (task.status !== 'pending') return false
      if (!task.dependsOn?.length) return true
      return task.dependsOn.every((depId) => byId.get(depId)?.status === 'done')
    })
    .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
}

const MAX_ACTIVE_TASK_CONTEXT = 12

export function formatActiveTaskContext(tasks: Task[]): string {
  const activeTasks = tasks
    .filter((task) => task.status === 'pending' || task.status === 'in-progress')
    .sort((left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id))
    .slice(0, MAX_ACTIVE_TASK_CONTEXT)

  const doneCount = tasks.filter((task) => task.status === 'done').length
  const failedCount = tasks.filter((task) => task.status === 'failed').length

  if (activeTasks.length === 0) {
    return `\n\n## Active session tasks\nNo active tasks. Create a checklist only if the current request is genuinely multi-step.\n`
  }

  const lines = activeTasks.map((task) => {
    const owner = task.assigneeAgentId ? `, owner=${task.assigneeAgentId}` : ''
    const deps = task.dependsOn?.length ? `, deps=${task.dependsOn.join('|')}` : ''
    return `- ${task.id}: ${JSON.stringify(task.title)} [${task.status}${task.progress === undefined ? '' : `, ${task.progress}%`}${owner}${deps}]`
  })

  return `\n\n## Active session tasks\nThese tasks are authoritative. Reuse their IDs instead of creating duplicates.\n${lines.join(
    '\n'
  )}\nCompleted: ${doneCount}; failed: ${failedCount}; active: ${activeTasks.length}\n`
}

export const taskStore = createStore<TaskState>()(
  immer((set, get) => ({
    tasks: [],
    hydratedSessionIds: {},

    createTask: (sessionId, id, title, options) => {
      const cleaned = normalizeTitle(title)
      if (!cleaned) {
        return { ok: false, error: 'Task title cannot be empty.' }
      }
      const sessionTasks = get().tasks.filter((t) => t.sessionId === sessionId)
      if (sessionTasks.length >= MAX_SESSION_TASKS) {
        return {
          ok: false,
          error: `Task limit reached (${MAX_SESSION_TASKS}). Mark items done or remove completed work before adding more.`,
        }
      }
      if (get().tasks.some((t) => t.id === id)) {
        return { ok: false, error: `Task with id "${id}" already exists.` }
      }

      const now = Date.now()
      const deps = sanitizeDependsOn(options?.dependsOn, id)
      const task: Task = {
        id,
        sessionId,
        title: cleaned,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
        ...(options?.assigneeAgentId ? { assigneeAgentId: options.assigneeAgentId } : {}),
        ...(deps.length > 0 ? { dependsOn: deps } : {}),
        ...(options?.createdBy ? { createdBy: options.createdBy } : {}),
      }
      set((state) => {
        state.tasks.push(task)
      })
      schedulePersist(sessionId, () => get().getSessionTasks(sessionId))
      return { ok: true, task }
    },

    updateTask: (id, updates) => {
      let updated: Task | null = null
      let sessionId: string | null = null
      set((state) => {
        const task = state.tasks.find((t) => t.id === id)
        if (!task) return

        if (updates.status === 'in-progress') {
          for (const sibling of state.tasks) {
            if (sibling.sessionId === task.sessionId && sibling.id !== task.id && sibling.status === 'in-progress') {
              sibling.status = 'pending'
              delete sibling.progress
              sibling.updatedAt = Date.now()
            }
          }
        }

        if (updates.title !== undefined) {
          const cleaned = normalizeTitle(updates.title)
          if (cleaned) task.title = cleaned
        }
        if (updates.status !== undefined) task.status = updates.status
        if (updates.status === 'done') {
          task.progress = 100
        } else if (updates.status === 'pending' && updates.progress === undefined) {
          delete task.progress
        } else if (updates.progress !== undefined) {
          task.progress = Math.max(0, Math.min(100, updates.progress))
        }
        if (updates.assigneeAgentId !== undefined) {
          if (updates.assigneeAgentId === null || updates.assigneeAgentId === '') {
            delete task.assigneeAgentId
          } else {
            task.assigneeAgentId = updates.assigneeAgentId
          }
        }
        if (updates.dependsOn !== undefined) {
          if (updates.dependsOn === null || updates.dependsOn.length === 0) {
            delete task.dependsOn
          } else {
            task.dependsOn = sanitizeDependsOn(updates.dependsOn, task.id)
          }
        }
        task.updatedAt = Date.now()
        updated = { ...task }
        sessionId = task.sessionId
      })
      if (sessionId) {
        const persistedSessionId = sessionId
        schedulePersist(persistedSessionId, () => get().getSessionTasks(persistedSessionId))
      }
      return updated
    },

    setTaskAssignee: (id, assigneeAgentId) => {
      return get().updateTask(id, { assigneeAgentId: assigneeAgentId ?? null })
    },

    setTaskDeps: (id, dependsOn) => {
      return get().updateTask(id, { dependsOn: dependsOn ?? null })
    },

    listReadyTasks: (sessionId) => {
      const sessionTasks = get()
        .tasks.filter((t) => t.sessionId === sessionId)
        .slice()
        .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
      const byId = new Map(sessionTasks.map((t) => [t.id, t]))
      return sessionTasks.filter((task) => {
        if (task.status !== 'pending') return false
        if (!task.dependsOn?.length) return true
        return task.dependsOn.every((depId) => byId.get(depId)?.status === 'done')
      })
    },

    toggleTaskDone: (id) => {
      const existing = get().tasks.find((t) => t.id === id)
      if (!existing || existing.status === 'failed') return null
      const nextStatus: TaskStatus = existing.status === 'done' ? 'pending' : 'done'
      return get().updateTask(id, {
        status: nextStatus,
      })
    },

    getSessionTasks: (sessionId) => {
      return get().tasks.filter((t) => t.sessionId === sessionId)
    },

    clearSessionTasks: (sessionId) => {
      set((state) => {
        state.tasks = state.tasks.filter((t) => t.sessionId !== sessionId)
        delete state.hydratedSessionIds[sessionId]
      })
      void storage.removeItem(StorageKeyGenerator.sessionTasks(sessionId)).catch((err) => {
        console.error('Failed to remove persisted session tasks', sessionId, err)
      })
    },

    replaceSessionTasks: (sessionId, tasks) => {
      set((state) => {
        state.tasks = [...state.tasks.filter((t) => t.sessionId !== sessionId), ...tasks]
        state.hydratedSessionIds[sessionId] = true
      })
    },

    hydrateSessionTasks: async (sessionId) => {
      if (!sessionId || get().hydratedSessionIds[sessionId]) return
      try {
        const stored = await storage.getItem<Task[] | null>(StorageKeyGenerator.sessionTasks(sessionId), null)
        set((state) => {
          // Mark hydrated even if empty so we don't re-read every mount
          state.hydratedSessionIds[sessionId] = true
          if (!Array.isArray(stored) || stored.length === 0) return
          // Keep any in-memory tasks for this session (e.g. created mid-hydrate); merge by id
          const memory = state.tasks.filter((t) => t.sessionId === sessionId)
          const memoryIds = new Set(memory.map((t) => t.id))
          const fromDisk = stored.filter((t) => t?.id && t.sessionId === sessionId && !memoryIds.has(t.id))
          // Drop prior session rows then re-add memory + disk (memory wins)
          state.tasks = [...state.tasks.filter((t) => t.sessionId !== sessionId), ...fromDisk, ...memory]
        })
      } catch (err) {
        console.error('Failed to hydrate session tasks', sessionId, err)
        set((state) => {
          state.hydratedSessionIds[sessionId] = true
        })
      }
    },

    _resetForTests: () => {
      for (const timer of persistTimers.values()) clearTimeout(timer)
      persistTimers.clear()
      set((state) => {
        state.tasks = []
        state.hydratedSessionIds = {}
      })
    },
  }))
)

export function useTaskStore<U>(selector: (state: TaskState) => U) {
  return useStore(taskStore, selector)
}

/** Flush pending debounce and write immediately (optional for shutdown). */
export async function flushSessionTasks(sessionId: string) {
  const tasks = taskStore.getState().getSessionTasks(sessionId)
  await persistNow(sessionId, tasks)
}
