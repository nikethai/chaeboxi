/**
 * Optional Computer Use trajectory ring buffer for support/debug (Phase 7).
 */

export type TrajectoryStep = {
  at: number
  sessionId: string
  tool: string
  /** Redacted / short args summary — never dump full typed secrets intentionally */
  summary: string
  ok?: boolean
  error?: string
}

const MAX_STEPS = 20
const buffers = new Map<string, TrajectoryStep[]>()

export function resetComputerTrajectory(sessionId: string) {
  buffers.delete(sessionId)
}

export function recordComputerTrajectory(
  sessionId: string,
  step: Omit<TrajectoryStep, 'at' | 'sessionId'>
) {
  if (!sessionId) return
  const list = buffers.get(sessionId) || []
  list.push({
    at: Date.now(),
    sessionId,
    tool: step.tool,
    summary: step.summary.slice(0, 500),
    ok: step.ok,
    error: step.error?.slice(0, 300),
  })
  while (list.length > MAX_STEPS) list.shift()
  buffers.set(sessionId, list)
}

export function getComputerTrajectory(sessionId: string): TrajectoryStep[] {
  return [...(buffers.get(sessionId) || [])]
}

export function exportComputerTrajectoryText(sessionId: string): string {
  const steps = getComputerTrajectory(sessionId)
  if (steps.length === 0) return 'No computer trajectory recorded for this session.'
  return steps
    .map((s, i) => {
      const t = new Date(s.at).toISOString()
      const status = s.error ? `ERR ${s.error}` : s.ok === false ? 'fail' : 'ok'
      return `${i + 1}. [${t}] ${s.tool} (${status}) — ${s.summary}`
    })
    .join('\n')
}

/** Allowlist: empty/undefined = allow all. Case-insensitive substring / exact. */
export function isAppAllowedByAllowlist(appName: string, allowlist: string[] | undefined | null): boolean {
  if (!allowlist || allowlist.length === 0) return true
  const n = appName.trim().toLowerCase()
  if (!n) return false
  return allowlist.some((entry) => {
    const e = entry.trim().toLowerCase()
    if (!e) return false
    return n === e || n.includes(e) || e.includes(n)
  })
}

export function summarizeToolArgs(tool: string, args: unknown): string {
  if (!args || typeof args !== 'object') return tool
  const o = args as Record<string, unknown>
  if (tool === 'computer_type' && typeof o.text === 'string') {
    const t = o.text
    if (t.length > 40) return `textLen=${t.length}`
    return `text=${JSON.stringify(t)}`
  }
  if (tool === 'computer_open_app' && typeof o.name === 'string') return `name=${o.name}`
  if (tool === 'computer_open_uri' && typeof o.uri === 'string') {
    const u = o.uri
    return `uri=${u.length > 80 ? `${u.slice(0, 80)}…` : u}`
  }
  if (tool === 'computer_click') return `x=${o.x},y=${o.y}`
  if (tool === 'computer_key' && typeof o.key === 'string') return `key=${o.key}`
  try {
    return JSON.stringify(o).slice(0, 200)
  } catch {
    return tool
  }
}
