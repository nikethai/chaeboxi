import type { MessageContentParts, MessageToolCallPart } from '@shared/types'
import type { Task, TaskStatus } from '@/stores/taskStore'

export const TASK_TOOL_NAMES = ['create_task', 'update_task', 'list_tasks'] as const
export type TaskToolName = (typeof TASK_TOOL_NAMES)[number]

export function normalizeTaskToolName(toolName: string): string {
  const canonicalName = toolName.split(/[:/]|__/).at(-1)
  return canonicalName && (TASK_TOOL_NAMES as readonly string[]).includes(canonicalName) ? canonicalName : toolName
}

export function isTaskTrackingTool(toolName: string): toolName is TaskToolName {
  return (TASK_TOOL_NAMES as readonly string[]).includes(normalizeTaskToolName(toolName))
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
  let lastList: TaskSnapshot[] | null = null
  let wroteThisTurn = false

  for (const part of parts) {
    if (part.type !== 'tool-call' || !isTaskTrackingTool(part.toolName)) continue
    const toolPart = part as MessageToolCallPart
    const toolName = normalizeTaskToolName(toolPart.toolName)
    const result = toolPart.result as Record<string, unknown> | undefined
    if (!result) continue

    if (toolName === 'list_tasks' && Array.isArray(result.tasks)) {
      lastList = result.tasks.map(taskFromUnknown).filter((task): task is TaskSnapshot => Boolean(task))
      continue
    }

    // create/update also return the full session board on `tasks` — ignore that dump
    // so a new checklist is not mixed with leftover session todos.
    const single = taskFromUnknown(result.task)
    if (single) {
      byId.set(single.id, single)
      wroteThisTurn = true
    }

    if (toolName === 'create_task' && typeof result.id === 'string') {
      const flat = taskFromUnknown(result)
      if (flat) {
        byId.set(flat.id, flat)
        wroteThisTurn = true
      }
    }
  }

  if (wroteThisTurn) return [...byId.values()]
  return lastList ?? []
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
