/**
 * Shareable room pack (v1).
 *
 * File: `*.chaeboxi-room.json`
 * Magic: `__type: "chaeboxi-room-pack"`
 *
 * Include: room name, mode, lead, agent personas (name/prompt/avatar ref),
 * pinned skill ids + names.
 * Never include: API keys, MCP env, workspace paths, credential ids, messages.
 * Import always mints new UUIDs so a pack cannot clobber a local room.
 */

export const ROOM_PACK_MAGIC = 'chaeboxi-room-pack'
export const ROOM_PACK_VERSION = 1
export const ROOM_PACK_EXT = '.chaeboxi-room.json'

export type RoomPackMode = 'discuss' | 'work' | 'swarm'

export type RoomPackAgent = {
  packId: string
  name: string
  prompt: string
  emojiAvatar?: string
  picUrl?: string
}

export type RoomPackSkill = {
  id: string
  name: string
}

export type RoomPack = {
  __type: typeof ROOM_PACK_MAGIC
  __version: typeof ROOM_PACK_VERSION
  name: string
  mode: RoomPackMode
  leadPackId?: string
  agents: RoomPackAgent[]
  skills: RoomPackSkill[]
}

export type RoomPackPreview = {
  name: string
  mode: RoomPackMode
  memberCount: number
  skillNames: string[]
}

export type InstalledSkill = {
  id: string
  name: string
}

export type AgentInput = {
  id: string
  name: string
  prompt: string
  emojiAvatar?: string
  picUrl?: string
}

export type SessionInput = {
  name: string
  roomMode?: string
  roomLeadId?: string
  agentIds?: string[]
  pinnedSkillIds?: string[]
  workspaceRoot?: string
  credentialIds?: string[]
}

const SECRET_KEY = /api[_-]?key|secret|token|password|credential|mcp|workspace/i
const LOCAL_PATH = /^(?:[a-zA-Z]:[\\/]|\/|file:|\\\\)/

export function isSafeAvatarRef(value: string | undefined): value is string {
  if (!value || typeof value !== 'string') {
    return false
  }
  const trimmed = value.trim()
  if (!trimmed || LOCAL_PATH.test(trimmed)) {
    return false
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:image/')) {
    return true
  }
  // emoji / short built-in key
  return trimmed.length <= 64 && !trimmed.includes('/') && !trimmed.includes('\\')
}

function sanitizeString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

export function buildRoomPack(input: {
  session: SessionInput
  agents: AgentInput[]
  skills?: InstalledSkill[]
}): RoomPack {
  const agentIds = (input.session.agentIds || []).filter(Boolean)
  const byId = new Map(input.agents.map((agent) => [agent.id, agent]))
  const agents: RoomPackAgent[] = agentIds
    .map((id) => byId.get(id))
    .filter((agent): agent is AgentInput => Boolean(agent))
    .map((agent) => {
      const packed: RoomPackAgent = {
        packId: agent.id,
        name: agent.name.trim() || 'Agent',
        prompt: agent.prompt || '',
      }
      if (isSafeAvatarRef(agent.emojiAvatar)) {
        packed.emojiAvatar = agent.emojiAvatar
      }
      if (isSafeAvatarRef(agent.picUrl)) {
        packed.picUrl = agent.picUrl
      }
      return packed
    })

  if (agents.length === 0) {
    throw new Error('Room pack needs at least one agent')
  }

  const skillById = new Map((input.skills || []).map((skill) => [skill.id, skill]))
  const skills: RoomPackSkill[] = (input.session.pinnedSkillIds || [])
    .map((id) => skillById.get(id) || { id, name: id })
    .map((skill) => ({ id: skill.id, name: skill.name }))

  const leadPackId =
    input.session.roomLeadId && agents.some((agent) => agent.packId === input.session.roomLeadId)
      ? input.session.roomLeadId
      : agents[0].packId

  const mode: RoomPackMode =
    input.session.roomMode === 'work' || input.session.roomMode === 'swarm' || input.session.roomMode === 'discuss'
      ? input.session.roomMode
      : 'discuss'

  return {
    __type: ROOM_PACK_MAGIC,
    __version: ROOM_PACK_VERSION,
    name: input.session.name.trim() || 'Room',
    mode,
    leadPackId,
    agents,
    skills,
  }
}

export function parseRoomPack(value: unknown): RoomPack {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid room pack')
  }
  const raw = value as Record<string, unknown>
  if (raw.__type !== ROOM_PACK_MAGIC) {
    throw new Error('Not a Chaeboxi room pack')
  }
  if (raw.__version !== ROOM_PACK_VERSION) {
    throw new Error('Unsupported room pack version')
  }
  const agents = Array.isArray(raw.agents) ? raw.agents : []
  if (agents.length === 0) {
    throw new Error('Room pack needs at least one agent')
  }
  const packedAgents: RoomPackAgent[] = agents.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new Error('Invalid room pack agent')
    }
    const agent = item as Record<string, unknown>
    const packed: RoomPackAgent = {
      packId: sanitizeString(agent.packId, `agent-${index}`),
      name: sanitizeString(agent.name, 'Agent'),
      prompt: sanitizeString(agent.prompt),
    }
    if (isSafeAvatarRef(sanitizeString(agent.emojiAvatar))) {
      packed.emojiAvatar = String(agent.emojiAvatar)
    }
    if (isSafeAvatarRef(sanitizeString(agent.picUrl))) {
      packed.picUrl = String(agent.picUrl)
    }
    return packed
  })
  const skills: RoomPackSkill[] = Array.isArray(raw.skills)
    ? raw.skills
        .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
        .map((skill) => ({
          id: sanitizeString(skill.id),
          name: sanitizeString(skill.name, sanitizeString(skill.id)),
        }))
        .filter((skill) => skill.id)
    : []

  const mode: RoomPackMode = raw.mode === 'work' || raw.mode === 'swarm' || raw.mode === 'discuss' ? raw.mode : 'discuss'
  const leadPackId = sanitizeString(raw.leadPackId)
  return {
    __type: ROOM_PACK_MAGIC,
    __version: ROOM_PACK_VERSION,
    name: sanitizeString(raw.name, 'Room'),
    mode,
    leadPackId: packedAgents.some((agent) => agent.packId === leadPackId) ? leadPackId : packedAgents[0].packId,
    agents: packedAgents,
    skills,
  }
}

export function previewRoomPack(pack: RoomPack): RoomPackPreview {
  return {
    name: pack.name,
    mode: pack.mode,
    memberCount: pack.agents.length,
    skillNames: pack.skills.map((skill) => skill.name),
  }
}

export function listMissingSkills(pack: RoomPack, installed: InstalledSkill[]): RoomPackSkill[] {
  const byId = new Set(installed.map((skill) => skill.id))
  const byName = new Set(installed.map((skill) => skill.name.toLowerCase()))
  return pack.skills.filter((skill) => !byId.has(skill.id) && !byName.has(skill.name.toLowerCase()))
}

export function resolveInstalledSkillIds(pack: RoomPack, installed: InstalledSkill[]): string[] {
  const byId = new Map(installed.map((skill) => [skill.id, skill.id]))
  const byName = new Map(installed.map((skill) => [skill.name.toLowerCase(), skill.id]))
  const ids: string[] = []
  for (const skill of pack.skills) {
    const resolved = byId.get(skill.id) || byName.get(skill.name.toLowerCase())
    if (resolved && !ids.includes(resolved)) {
      ids.push(resolved)
    }
  }
  return ids
}

export function remapRoomPack(
  pack: RoomPack,
  newId: () => string
): {
  pack: RoomPack
  idMap: Record<string, string>
} {
  const idMap: Record<string, string> = {}
  const agents = pack.agents.map((agent) => {
    const nextId = newId()
    idMap[agent.packId] = nextId
    return { ...agent, packId: nextId }
  })
  const leadPackId = pack.leadPackId ? idMap[pack.leadPackId] || agents[0].packId : agents[0].packId
  return {
    pack: { ...pack, agents, leadPackId },
    idMap,
  }
}

export function assertPackHasNoSecrets(value: unknown): void {
  const json = JSON.stringify(value)
  if (SECRET_KEY.test(json) && /sk-|Bearer |apiKey|mcpEnv|workspaceRoot|credentialIds/i.test(json)) {
    throw new Error('Room pack must not contain secrets or local paths')
  }
  if (/"workspaceRoot"|"credentialIds"|"apiKey"|"mcp"|"capabilityId"|"rootGeneration"|"filesystemIdentity"/i.test(json)) {
    throw new Error('Room pack must not contain secrets or local paths')
  }
}

export function roomPackFileName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  return `${slug || 'room'}${ROOM_PACK_EXT}`
}
