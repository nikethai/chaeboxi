/**
 * Computer Use Harness v2 — host-side loop helpers (industry parity).
 * Keep pure logic here for unit tests; side effects stay in computer.ts / stream path.
 */

export const COMPUTER_ACT_TOOLS = new Set([
  'computer_open_app',
  'computer_open_uri',
  'computer_click',
  'computer_type',
  'computer_key',
  'computer_scroll',
  'computer_mouse_move',
  'computer_wait',
])

export const COMPUTER_AUTO_SCREENSHOT_TOOLS = new Set([
  'computer_open_app',
  'computer_open_uri',
  'computer_click',
  'computer_type',
  'computer_key',
  'computer_scroll',
  'computer_wait',
])

/** Apps that must not be opened for messaging / contact-find goals. */
export const BLOCKED_MESSAGING_OPEN_APPS = new Set([
  'finder',
  'spotlight',
  'launchpad',
  'system settings',
  'system preferences',
])

const MESSAGING_APP_HINTS = [
  'whatsapp',
  'telegram',
  'slack',
  'messages',
  'imessage',
  'discord',
  'signal',
  'wechat',
  'line',
  'microsoft teams',
  'teams',
]

export function isMessagingTargetApp(name: string | undefined | null): boolean {
  if (!name) return false
  const n = name.trim().toLowerCase()
  return MESSAGING_APP_HINTS.some((h) => n === h || n.includes(h))
}

export function isBlockedMessagingOpenApp(name: string): boolean {
  const n = name.trim().toLowerCase()
  if (!n) return false
  if (BLOCKED_MESSAGING_OPEN_APPS.has(n)) return true
  // "Finder.app" / paths
  const base = n.replace(/\.app$/, '').split('/').pop() || n
  return BLOCKED_MESSAGING_OPEN_APPS.has(base)
}

/** Spotlight / global search chords that derail in-app contact find. */
export function isSpotlightLikeKey(key: string): boolean {
  const k = key.trim().toLowerCase().replace(/\s+/g, '')
  return (
    k === 'cmd+space' ||
    k === 'command+space' ||
    k === 'meta+space' ||
    k === 'cmd+spacebar' ||
    k === 'command+spacebar'
  )
}

export function normalizeAppToken(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\.app$/, '')
    .split('/')
    .pop()!
    .replace(/[^a-z0-9]+/g, '')
}

/**
 * True when frontmost process name looks like the target app (loose match).
 * Empty frontmost → unknown (treat as ok / don't re-activate).
 */
export function frontmostMatchesTarget(frontmost: string | undefined | null, target: string | undefined | null): boolean {
  if (!target?.trim()) return true
  if (!frontmost?.trim()) return true
  const f = normalizeAppToken(frontmost)
  const t = normalizeAppToken(target)
  if (!f || !t) return true
  if (f === t) return true
  if (f.includes(t) || t.includes(f)) return true
  // Known aliases
  if (t === 'messages' && (f === 'messages' || f === 'imessage')) return true
  if (t === 'whatsapp' && f.includes('whatsapp')) return true
  return false
}

export type LastComputerToolKind = 'open_app' | 'act' | 'screenshot' | 'other' | null

export function classifyComputerToolName(name: string | undefined): LastComputerToolKind {
  if (!name) return null
  if (name === 'computer_open_app' || name === 'computer_open_uri') return 'open_app'
  if (name === 'computer_screenshot') return 'screenshot'
  if (COMPUTER_ACT_TOOLS.has(name)) return 'act'
  return 'other'
}

/**
 * After open_app (or act without embedded screenshot), force the model to call screenshot next.
 */
export function shouldForceComputerScreenshot(lastToolName: string | undefined, hasEmbeddedScreenshot: boolean): boolean {
  if (hasEmbeddedScreenshot) return false
  const kind = classifyComputerToolName(lastToolName)
  return kind === 'open_app' || kind === 'act'
}

export type PruneImageOptions = {
  /** Keep this many most recent image parts (default 3). */
  keepN?: number
}

type ContentPart = { type?: string; [k: string]: unknown }

/**
 * Replace older image / image-data parts with a short placeholder text.
 * Walks ModelMessage-like arrays: { role, content: string | ContentPart[] }.
 */
export function pruneOldImageParts<T extends { content?: unknown }>(messages: T[], opts: PruneImageOptions = {}): T[] {
  const keepN = opts.keepN ?? 3
  const positions: Array<{ mi: number; pi: number }> = []

  for (let mi = 0; mi < messages.length; mi++) {
    const content = messages[mi]?.content
    if (!Array.isArray(content)) continue
    for (let pi = 0; pi < content.length; pi++) {
      const part = content[pi] as ContentPart
      const t = part?.type
      if (t === 'image' || t === 'image-data' || t === 'file') {
        // file with image mediaType counts; keep simple: type image*
        if (t === 'file' && typeof part.mediaType === 'string' && !String(part.mediaType).startsWith('image/')) {
          continue
        }
        positions.push({ mi, pi })
      }
    }
  }

  if (positions.length <= keepN) return messages

  const drop = new Set(positions.slice(0, positions.length - keepN).map((p) => `${p.mi}:${p.pi}`))
  return messages.map((msg, mi) => {
    const content = msg.content
    if (!Array.isArray(content)) return msg
    let changed = false
    const next = content.map((part, pi) => {
      if (!drop.has(`${mi}:${pi}`)) return part
      changed = true
      return { type: 'text', text: '[Screenshot omitted — older frame; use latest screenshot coordinates only.]' }
    })
    return changed ? { ...msg, content: next } : msg
  })
}

export function clampWaitSeconds(seconds: number): number {
  if (!Number.isFinite(seconds)) return 0.5
  return Math.min(2, Math.max(0.3, seconds))
}
