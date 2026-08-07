export type VideoSampleMode = 'evenly_spaced' | 'timestamps' | 'interval'

export interface ComputeSampleTimestampsParams {
  durationSec: number
  maxFrames: number
  mode?: VideoSampleMode
  timestamps?: number[]
  intervalSec?: number
  startSec?: number
  endSec?: number
}

/**
 * Compute seek timestamps for frame extraction.
 * Always clamps into [0, duration) and de-duplicates near-identical times.
 */
export function computeSampleTimestamps(params: ComputeSampleTimestampsParams): number[] {
  const durationSec = Math.max(0, params.durationSec)
  if (durationSec <= 0 || params.maxFrames < 1) {
    return []
  }

  const start = Math.max(0, params.startSec ?? 0)
  const end = Math.min(durationSec, params.endSec ?? durationSec)
  if (end <= start) {
    return [clampTimestamp(start, durationSec)]
  }

  const mode = params.mode ?? 'evenly_spaced'
  let raw: number[] = []

  if (mode === 'timestamps' && params.timestamps?.length) {
    raw = params.timestamps.map((t) => clampTimestamp(t, durationSec))
  } else if (mode === 'interval' && params.intervalSec && params.intervalSec > 0) {
    const interval = params.intervalSec
    for (let t = start; t < end && raw.length < params.maxFrames; t += interval) {
      raw.push(clampTimestamp(t, durationSec))
    }
    if (raw.length === 0) {
      raw.push(clampTimestamp(start, durationSec))
    }
  } else {
    // evenly_spaced within [start, end)
    const n = Math.min(params.maxFrames, Math.max(1, Math.floor((end - start) * 1000))) // avoid absurd n
    if (n === 1) {
      raw = [clampTimestamp(start + (end - start) / 2, durationSec)]
    } else {
      for (let i = 0; i < n; i++) {
        // Stay slightly inside the last frame to avoid seeking past EOF
        const ratio = i / (n - 1)
        const t = start + ratio * (end - start) * 0.999
        raw.push(clampTimestamp(t, durationSec))
      }
    }
  }

  const unique = dedupeTimestamps(raw, 0.05)
  return unique.slice(0, params.maxFrames)
}

function clampTimestamp(t: number, durationSec: number): number {
  if (!Number.isFinite(t)) {
    return 0
  }
  // Keep a tiny epsilon off the exact end so seeked events still fire
  const maxT = Math.max(0, durationSec - 0.001)
  return Math.min(Math.max(0, t), maxT)
}

function dedupeTimestamps(times: number[], minDelta: number): number[] {
  const sorted = [...times].sort((a, b) => a - b)
  const out: number[] = []
  for (const t of sorted) {
    if (out.length === 0 || Math.abs(t - out[out.length - 1]) >= minDelta) {
      out.push(t)
    }
  }
  return out
}
