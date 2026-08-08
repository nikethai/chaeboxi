/**
 * Deterministic procedural agent avatars + shared resolve order.
 * Never falls back to bare letter circles for a stable agent id.
 */

import type { AgentRole, CopilotDetail } from '@shared/types'

export type AgentAvatarInput = {
  id: string
  role?: AgentRole
  avatarSeed?: string
  avatarKey?: string
  picUrl?: string
  /** Legacy; ignored for image resolve when procedural is available. */
  emojiAvatar?: string
}

export type ResolvedAgentAvatar =
  | { kind: 'blob'; storageKey: string }
  | { kind: 'url'; url: string }
  | { kind: 'procedural'; src: string; accent: string }
  | { kind: 'emoji'; emoji: string }

/** Studio-safe hues (indigo-adjacent, avoid purple wash). */
const PALETTE = [
  { bg: '#3d4a8c', fg: '#e8eaf6', accent: '#5b63d4' },
  { bg: '#2f4a5e', fg: '#e3eef5', accent: '#4a90b8' },
  { bg: '#3a4f42', fg: '#e8f0eb', accent: '#5a9e78' },
  { bg: '#5a4030', fg: '#f5ebe3', accent: '#c4845a' },
  { bg: '#4a3a52', fg: '#f0e8f5', accent: '#8b6bb0' },
  { bg: '#3a4550', fg: '#e8ecf0', accent: '#6b7f94' },
  { bg: '#4a3838', fg: '#f5e8e8', accent: '#b86b6b' },
  { bg: '#2e4a48', fg: '#e3f2f0', accent: '#4a9e94' },
] as const

function hashString(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function normalizeRole(role?: AgentRole): string {
  if (!role) return 'custom'
  const r = String(role).toLowerCase()
  if (r === 'research' || r === 'code' || r === 'writing' || r === 'data' || r === 'planning' || r === 'openclaw') {
    return r
  }
  return 'custom'
}

/** Simple geometric glyph paths (viewBox 0 0 64 64, centered). */
function roleGlyphPath(role: string): string {
  switch (role) {
    case 'research':
      // magnifier
      return 'M28 26a8 8 0 1 1 0.01 0M34 34l6 6'
    case 'code':
      // chevrons
      return 'M26 24l-6 8 6 8M38 24l6 8-6 8M34 22l-4 20'
    case 'writing':
      // pen tip
      return 'M22 40l4-14 14-4-4 14-14 4zm4-10l6 6'
    case 'data':
      // bars
      return 'M22 40V30h4v10H22zm8 0V24h4v16h-4zm8 0V28h4v12h-4z'
    case 'planning':
      // checklist box
      return 'M24 22h16v20H24V22zm4 6h8M28 34h8M28 40h5'
    case 'openclaw':
      // hex node
      return 'M32 20l10 6v12l-10 6-10-6V26l10-6zm0 10v12'
    default:
      // diamond
      return 'M32 22l10 10-10 10-10-10 10-10z'
  }
}

/**
 * Deterministic SVG data-URI for an agent id/seed.
 */
export function proceduralAgentAvatar(
  id: string,
  opts?: { seed?: string; role?: AgentRole }
): { src: string; accent: string } {
  const seed = opts?.seed?.trim() || id
  const hash = hashString(seed)
  const palette = PALETTE[hash % PALETTE.length]
  const role = normalizeRole(opts?.role)
  const glyph = roleGlyphPath(role)
  // Secondary pattern offset from high bits
  const rot = (hash >>> 8) % 360
  const ring = 0.12 + ((hash >>> 16) % 10) / 100

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 64 64" role="img" aria-hidden="true">
  <defs>
    <clipPath id="c"><circle cx="32" cy="32" r="32"/></clipPath>
  </defs>
  <g clip-path="url(#c)">
    <rect width="64" height="64" fill="${palette.bg}"/>
    <circle cx="32" cy="32" r="28" fill="none" stroke="${palette.accent}" stroke-opacity="${ring}" stroke-width="1.5"/>
    <g transform="rotate(${rot} 32 32)" opacity="0.14">
      <circle cx="18" cy="16" r="14" fill="${palette.accent}"/>
      <circle cx="50" cy="48" r="18" fill="${palette.fg}"/>
    </g>
    <path d="${glyph}" fill="none" stroke="${palette.fg}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
  <circle cx="32" cy="32" r="31.25" fill="none" stroke="rgba(0,0,0,0.18)" stroke-width="1.5"/>
</svg>`

  const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  return { src, accent: palette.accent }
}

/**
 * Shared resolve order: blob key → remote URL → procedural SVG.
 * Letter avatars are never returned for a non-empty id.
 */
export function resolveAgentAvatar(input: AgentAvatarInput | CopilotDetail | null | undefined): ResolvedAgentAvatar | null {
  if (!input?.id) return null

  if (input.avatarKey?.trim()) {
    return { kind: 'blob', storageKey: input.avatarKey.trim() }
  }

  if (input.picUrl?.trim()) {
    return { kind: 'url', url: input.picUrl.trim() }
  }

  // Prefer procedural over emoji so catalog stays consistent across platforms
  const procedural = proceduralAgentAvatar(input.id, {
    seed: input.avatarSeed,
    role: input.role,
  })
  return { kind: 'procedural', src: procedural.src, accent: procedural.accent }
}

/** OpenClaw gateway agents: namespace id so seeds never collide with native agents. */
export function openClawAgentAvatarId(agentId: string): string {
  return agentId.startsWith('openclaw:') ? agentId : `openclaw:${agentId}`
}

export function resolveOpenClawAgentAvatar(agentId: string): ResolvedAgentAvatar {
  const id = openClawAgentAvatarId(agentId)
  const procedural = proceduralAgentAvatar(id, { role: 'openclaw' })
  return { kind: 'procedural', src: procedural.src, accent: procedural.accent }
}

/** Stable accent for speaker chrome rings (matches procedural palette). */
export function agentAvatarAccent(agentId: string, seed?: string): string {
  return proceduralAgentAvatar(agentId, { seed }).accent
}

export function newAvatarSeed(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** Default AI image prompt for an agent persona (illustration, not photo). */
export function buildAgentAvatarGeneratePrompt(detail: {
  name: string
  role?: AgentRole
  voice?: string
  description?: string
}): string {
  const role = detail.role ? String(detail.role) : 'assistant'
  const voice = detail.voice?.trim() || 'focused and professional'
  const desc = detail.description?.trim() || `${role} specialist`
  return [
    `Minimal flat vector emblem avatar for AI agent named "${detail.name}".`,
    `Role: ${role}. Character: ${voice}. Theme: ${desc}.`,
    'Studio product icon style, soft geometric mark, indigo-friendly solid background,',
    'no text, no letters, no photoreal face, square composition, crisp edges.',
  ].join(' ')
}
