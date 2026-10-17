export type BackgroundJob = {
  id: string
  scopeId: string
  kind: 'sync' | 'review' | 'swarm' | 'plan'
  label: string
  status: 'running' | 'done' | 'failed' | 'needs-you'
  attempts: number
  nextRetryAt?: number
  startedAt: number
  finishedAt?: number
  error?: string
}
export const RETRY_DELAYS_MS = [10_000, 60_000, 300_000] as const // then a Needs you entry
