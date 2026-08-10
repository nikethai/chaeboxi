/**
 * Swarm plan helpers: caps, optional JSON fallback parse.
 * Pure — no renderer deps.
 */

import { MAX_SWARM_TASKS } from './types'

export { MAX_SWARM_TASKS }

export type SwarmPlanTaskDraft = {
  title: string
  assigneeHint?: string
  dependsOnTitles?: string[]
}

/**
 * Soft-parse a TaskPlan-like JSON blob from lead plan prose.
 * Accepts fenced ```json blocks, bare arrays/objects with a `tasks` field,
 * or markdown bullet / numbered lists as a last-resort fallback.
 */
export function parseSwarmPlanFromText(text: string, maxTasks = MAX_SWARM_TASKS): SwarmPlanTaskDraft[] {
  if (!text?.trim()) return []

  const candidates: string[] = []
  const fence = /```(?:json)?\s*([\s\S]*?)```/gi
  let match: RegExpExecArray | null
  while ((match = fence.exec(text)) !== null) {
    candidates.push(match[1].trim())
  }
  // Bare array or object somewhere in the message
  const brace = text.match(/(\{[\s\S]*"tasks"[\s\S]*\}|\[[\s\S]*\{[\s\S]*"title"[\s\S]*\}[\s\S]*\])/)
  if (brace?.[1]) candidates.push(brace[1].trim())

  for (const raw of candidates) {
    try {
      const parsed = JSON.parse(raw) as unknown
      const drafts = normalizePlanTasks(parsed, maxTasks)
      if (drafts.length > 0) return drafts
    } catch {
      // try next candidate
    }
  }

  return parseBulletTasksFromText(text, maxTasks)
}

/** Last-resort: turn markdown list items into task titles. */
export function parseBulletTasksFromText(text: string, maxTasks = MAX_SWARM_TASKS): SwarmPlanTaskDraft[] {
  const out: SwarmPlanTaskDraft[] = []
  const seen = new Set<string>()
  for (const line of text.split('\n')) {
    if (out.length >= maxTasks) break
    const m = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(?:\*\*)?(.+?)(?:\*\*)?\s*$/)
    if (!m) continue
    let title = m[1]
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[*_`]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    // Drop "Owner: Name" style suffixes for the title; capture assignee if present
    let assigneeHint: string | undefined
    const ownerMatch = title.match(/\s*[—–-]\s*(?:owner|assignee|by)\s*:\s*(.+)$/i)
    if (ownerMatch) {
      assigneeHint = ownerMatch[1].trim()
      title = title.slice(0, ownerMatch.index).trim()
    }
    if (title.length < 4 || title.length > 160) continue
    // Skip section headers / protocol noise
    if (/^(rules?|teammates?|swarm|your job|room directory)\b/i.test(title)) continue
    const key = title.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ title, assigneeHint })
  }
  // Need at least 2 bullets to treat as a real plan (avoid accidental single-line hits)
  return out.length >= 2 ? out : []
}

function normalizePlanTasks(parsed: unknown, maxTasks: number): SwarmPlanTaskDraft[] {
  let list: unknown[] = []
  if (Array.isArray(parsed)) {
    list = parsed
  } else if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { tasks?: unknown }).tasks)) {
    list = (parsed as { tasks: unknown[] }).tasks
  } else {
    return []
  }

  const out: SwarmPlanTaskDraft[] = []
  for (const item of list) {
    if (out.length >= maxTasks) break
    if (!item || typeof item !== 'object') continue
    const rec = item as Record<string, unknown>
    const title = typeof rec.title === 'string' ? rec.title.replace(/\s+/g, ' ').trim() : ''
    if (!title) continue
    const assigneeHint =
      typeof rec.assigneeAgentId === 'string'
        ? rec.assigneeAgentId
        : typeof rec.assignee === 'string'
          ? rec.assignee
          : typeof rec.owner === 'string'
            ? rec.owner
            : undefined
    const dependsOnTitles = Array.isArray(rec.dependsOn)
      ? rec.dependsOn.filter((d): d is string => typeof d === 'string' && d.trim().length > 0)
      : undefined
    out.push({
      title,
      assigneeHint: assigneeHint?.trim() || undefined,
      dependsOnTitles,
    })
  }
  return out
}

/** True when session already has pending/in-progress tasks suitable as a swarm board. */
export function hasActiveSwarmBoard(tasks: { status: string }[]): boolean {
  return tasks.some((t) => t.status === 'pending' || t.status === 'in-progress')
}

/**
 * Pure interrupt detector for Swarm (unit-tested).
 * The starter user message at run baseline is NOT an interrupt.
 */
export function isSwarmUserInterrupt(params: {
  baselineMsgCount: number
  baselineLastId: string | undefined
  messages: { id: string; role: string }[]
}): boolean {
  const last = params.messages[params.messages.length - 1]
  if (!last) return true
  if (last.role !== 'user') return false
  if (params.messages.length === params.baselineMsgCount && last.id === params.baselineLastId) return false
  return params.messages.length > params.baselineMsgCount || last.id !== params.baselineLastId
}
