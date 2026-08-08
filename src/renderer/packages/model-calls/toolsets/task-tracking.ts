import { tool } from 'ai'
import z from 'zod'
import { generateTaskId, MAX_SESSION_TASKS, taskStore } from '@/stores/taskStore'

export const TASK_TOOL_NAMES = ['create_task', 'update_task', 'list_tasks'] as const

const toolSetDescription = `
# Task tracking (checklist)

Use these tools to show a live checklist for multi-step work in the current session.

## When to use
- Multi-step work with about 3+ distinct steps, or when the user asks for a plan/checklist/todos.
- Non-trivial operations where progress visibility helps the user.

## When to skip
- Trivial single-step requests.
- Pure Q&A or short replies.

## Rules
- Prefer \`create_task\` once per step, then \`update_task\` for status changes. Do not recreate tasks.
- At most **one** task should be \`in-progress\` at a time.
- Mark a task \`done\` as soon as that step finishes — do not batch completions at the end.
- On a follow-up request, inspect the active session tasks and resume an existing pending task instead of recreating it.
- Before a final answer, update every task whose status changed in the current turn. Never infer \`done\` from prose alone.
- Keep titles short and action-oriented (under ~80 chars).
- Soft cap: ${MAX_SESSION_TASKS} tasks per session. Prefer finishing or failing items over growing the list forever.
- Use \`list_tasks\` to recover state after long runs or if unsure of current ids.

## create_task
Create a new checklist item. Returns the task including its id.

## update_task
Update an existing task's status, title, or progress (0–100).

## list_tasks
List all tasks for the current session with status and progress.
`

function sessionTasksPayload(sessionId: string) {
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
}

export const createTaskTool = tool({
  description:
    'Create a new checklist task for multi-step work. Use for distinct steps; keep titles short. Returns the created task id.',
  inputSchema: z.object({
    title: z.string().min(1).describe('Short action-oriented description of the task.'),
  }),
  execute: async (input: { title: string }, context: { sessionId?: string }) => {
    const sessionId = context.sessionId || 'default'
    await taskStore.getState().hydrateSessionTasks(sessionId)
    const id = generateTaskId()
    const result = taskStore.getState().createTask(sessionId, id, input.title)
    if (!result.ok) {
      return {
        error: result.error,
        ...sessionTasksPayload(sessionId),
      }
    }
    return {
      id: result.task.id,
      title: result.task.title,
      status: result.task.status,
      message: `Task "${result.task.title}" created.`,
      task: result.task,
      ...sessionTasksPayload(sessionId),
    }
  },
} as any)

export const updateTaskTool = tool({
  description:
    'Update an existing checklist task (status, title, or progress 0–100). Prefer this over creating duplicates.',
  inputSchema: z.object({
    id: z.string().describe('The task ID returned from create_task.'),
    status: z.enum(['pending', 'in-progress', 'done', 'failed']).optional().describe('New status for the task.'),
    title: z.string().optional().describe('Updated short title.'),
    progress: z.number().min(0).max(100).optional().describe('Progress percentage (0-100).'),
  }),
  execute: async (
    input: { id: string; status?: string; title?: string; progress?: number },
    context: { sessionId?: string }
  ) => {
    const sessionId = context.sessionId || 'default'
    await taskStore.getState().hydrateSessionTasks(sessionId)
    const state = taskStore.getState()
    const existing = state.tasks.find((t) => t.id === input.id)
    if (!existing) {
      return {
        error: `Task with id "${input.id}" not found.`,
        ...sessionTasksPayload(sessionId),
      }
    }
    if (existing.sessionId !== sessionId) {
      return {
        error: `Task with id "${input.id}" does not belong to the current session.`,
        ...sessionTasksPayload(sessionId),
      }
    }

    const updated = state.updateTask(input.id, {
      status: input.status as 'pending' | 'in-progress' | 'done' | 'failed' | undefined,
      title: input.title,
      progress: input.progress,
    })
    return {
      message: `Task "${input.id}" updated.`,
      task: updated,
      ...sessionTasksPayload(sessionId),
    }
  },
} as any)

export const listTasksTool = tool({
  description: 'List all checklist tasks for the current session with status and progress.',
  // Optional dummy field keeps schema non-empty for providers (e.g. Gemini) that reject empty objects.
  inputSchema: z.object({
    reason: z.string().optional().describe('Optional note; usually omit.'),
  }),
  execute: async (_input: { reason?: string }, context: { sessionId?: string }) => {
    const sessionId = context.sessionId || 'default'
    await taskStore.getState().hydrateSessionTasks(sessionId)
    return sessionTasksPayload(sessionId)
  },
} as any)

/**
 * Canonical task tools only. Do not register namespaced aliases (e.g. google:tasks:*)
 * in the live tool map — colons and MCP-style prefixes break Gemini functionDeclarations
 * (INVALID_ARGUMENT). History/UI still accept aliases via normalizeTaskToolName().
 */
export const CANONICAL_TASK_TOOLS = {
  create_task: createTaskTool,
  update_task: updateTaskTool,
  list_tasks: listTasksTool,
} as const

export default {
  description: toolSetDescription,
  tools: {
    ...CANONICAL_TASK_TOOLS,
  },
}
