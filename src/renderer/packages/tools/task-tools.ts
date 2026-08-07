import type { MessageContentParts, MessageToolCallPart } from '@shared/types'
import type { Task, TaskStatus } from '@/stores/taskStore'

export const TASK_TOOL_NAMES = ['create_task', 'update_task', 'list_tasks'] as const
export type TaskToolName = (typeof TASK_TOOL_NAMES)[number]

export function isTaskTrackingTool(toolName: string): toolName is TaskToolName {
  return (TASK_TOOL_NAMES as readonly string[]).includes(toolName)
}

export type TaskSnapshot = {
  id: string
  title: string
  status: TaskStatus
  progress?: number
}

function asTaskStatus(value: unknown): TaskStatus | null {
  if (value === 'pending' || value === 'in-progress' || value === 'done' || value === 'failed') {
    return value
  }
  return null
}

function taskFromUnknown(value: unknown): TaskSnapshot | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const id = typeof record.id === 'string' ? record.id : null
  const title = typeof record.title === 'string' ? record.title : null
  const status = asTaskStatus(record.status)
  if (!id || !title || !status) return null
  const progress = typeof record.progress === 'number' ? record.progress : undefined
  return { id, title, status, progress }
}

/** Build a frozen checklist from task tool results in a message (history fallback). */
export function snapshotTasksFromContentParts(parts: MessageContentParts | undefined): TaskSnapshot[] {
  if (!parts?.length) return []
  const byId = new Map<string, TaskSnapshot>()

  for (const part of parts) {
    if (part.type !== 'tool-call' || !isTaskTrackingTool(part.toolName)) continue
    const toolPart = part as MessageToolCallPart
    const result = toolPart.result as Record<string, unknown> | undefined
    if (!result) continue

    if (Array.isArray(result.tasks)) {
      for (const item of result.tasks) {
        const task = taskFromUnknown(item)
        if (task) byId.set(task.id, task)
      }
    }

    const single = taskFromUnknown(result.task)
    if (single) byId.set(single.id, single)

    // create_task may return flat id/title/status
    if (toolPart.toolName === 'create_task' && typeof result.id === 'string') {
      const flat = taskFromUnknown(result)
      if (flat) byId.set(flat.id, flat)
    }
  }

  return [...byId.values()]
}

export function contentPartsHaveTaskTools(parts: MessageContentParts | undefined): boolean {
  return Boolean(parts?.some((p) => p.type === 'tool-call' && isTaskTrackingTool(p.toolName)))
}

export function toTaskSnapshot(task: Task): TaskSnapshot {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    progress: task.progress,
  }
}
