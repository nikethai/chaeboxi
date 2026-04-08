import { tool } from 'ai'
import z from 'zod'
import { generateTaskId, taskStore } from '@/stores/taskStore'

const toolSetDescription = `
Use these tools to track progress on multi-step tasks within the current session.

## create_task
Create a new task to track. Returns the created task with its ID.

## update_task
Update an existing task's status, title, or progress percentage.

## list_tasks
List all tasks for the current session with their current status.
`

export const createTaskTool = tool({
  description: 'Create a new task to track progress on a multi-step operation.',
  inputSchema: z.object({
    title: z.string().describe('A short description of the task.'),
  }),
  execute: async (input: { title: string }, context: { sessionId?: string }) => {
    const sessionId = context.sessionId || 'default'
    const id = generateTaskId()
    const state = taskStore.getState()
    state.createTask(sessionId, id, input.title)
    const task = state.tasks.find((t) => t.id === id)
    return {
      id,
      title: input.title,
      status: 'pending',
      message: `Task "${input.title}" created.`,
      task,
    }
  },
})

export const updateTaskTool = tool({
  description: 'Update an existing task with a new status, title, or progress percentage.',
  inputSchema: z.object({
    id: z.string().describe('The task ID returned from create_task.'),
    status: z
      .enum(['pending', 'in-progress', 'done', 'failed'])
      .optional()
      .describe('New status for the task.'),
    title: z.string().optional().describe('Updated title for the task.'),
    progress: z
      .number()
      .min(0)
      .max(100)
      .optional()
      .describe('Progress percentage (0-100).'),
  }),
  execute: async (input: { id: string; status?: string; title?: string; progress?: number }) => {
    const state = taskStore.getState()
    const existing = state.tasks.find((t) => t.id === input.id)
    if (!existing) {
      return { error: `Task with id "${input.id}" not found.` }
    }
    state.updateTask(input.id, {
      status: input.status as 'pending' | 'in-progress' | 'done' | 'failed' | undefined,
      title: input.title,
      progress: input.progress,
    })
    const updated = state.tasks.find((t) => t.id === input.id)
    return {
      message: `Task "${input.id}" updated.`,
      task: updated,
    }
  },
})

export const listTasksTool = tool({
  description: 'List all tasks for the current session with their current status and progress.',
  inputSchema: z.object({}),
  execute: async (_input: Record<string, never>, context: { sessionId?: string }) => {
    const sessionId = context.sessionId || 'default'
    const tasks = taskStore.getState().getSessionTasks(sessionId)
    return {
      tasks,
      total: tasks.length,
      summary: {
        pending: tasks.filter((t) => t.status === 'pending').length,
        'in-progress': tasks.filter((t) => t.status === 'in-progress').length,
        done: tasks.filter((t) => t.status === 'done').length,
        failed: tasks.filter((t) => t.status === 'failed').length,
      },
    }
  },
})

export default {
  description: toolSetDescription,
  tools: {
    create_task: createTaskTool,
    update_task: updateTaskTool,
    list_tasks: listTasksTool,
  },
}
