import type { CopilotDetail, Session } from '@shared/types'
import {
  assertPackHasNoSecrets,
  buildRoomPack,
  listMissingSkills,
  parseRoomPack,
  previewRoomPack,
  remapRoomPack,
  resolveInstalledSkillIds,
  roomPackFileName,
  type InstalledSkill,
  type RoomPack,
  type RoomPackPreview,
} from '@shared/room-pack'
import { v4 as uuidv4 } from 'uuid'
import platform from '@/platform'
import storage, { StorageKey } from '@/storage'
import * as chatStore from '@/stores/chatStore'
import * as sessionActions from '@/stores/sessionActions'

export type { RoomPack, RoomPackPreview }

export async function exportRoomPack(session: Session, agents: CopilotDetail[], skills: InstalledSkill[]) {
  const pack = buildRoomPack({
    session: {
      name: session.name,
      roomMode: session.roomMode,
      roomLeadId: session.roomLeadId,
      agentIds: session.agentIds,
      pinnedSkillIds: session.pinnedSkillIds,
    },
    agents,
    skills,
  })
  assertPackHasNoSecrets(pack)
  const fileName = roomPackFileName(pack.name)
  const content = `${JSON.stringify(pack, null, 2)}\n`
  await platform.exporter.exportTextFile(fileName, content)
  return { fileName, pack, preview: previewRoomPack(pack) }
}

export function previewRoomPackFile(content: string): { pack: RoomPack; preview: RoomPackPreview } {
  const pack = parseRoomPack(JSON.parse(content))
  return { pack, preview: previewRoomPack(pack) }
}

export async function importRoomPack(
  content: string,
  installedSkills: InstalledSkill[]
): Promise<{ sessionId: string; preview: RoomPackPreview; missingSkills: { id: string; name: string }[] }> {
  const pack = parseRoomPack(JSON.parse(content))
  const missingSkills = listMissingSkills(pack, installedSkills)
  const remapped = remapRoomPack(pack, () => uuidv4())
  const pinnedSkillIds = resolveInstalledSkillIds(pack, installedSkills)

  const existing = (await storage.getItem<CopilotDetail[]>(StorageKey.MyCopilots, [])) || []
  const created: CopilotDetail[] = remapped.pack.agents.map((agent) => ({
    id: agent.packId,
    name: agent.name,
    prompt: agent.prompt,
    emojiAvatar: agent.emojiAvatar,
    picUrl: agent.picUrl,
    usedCount: 0,
  }))
  await storage.setItemNow(StorageKey.MyCopilots, [...existing, ...created])

  const session = await sessionActions.createEmpty('chat', {
    agentIds: created.map((agent) => agent.id),
  })
  await chatStore.updateSession(session.id, {
    name: remapped.pack.name,
    roomMode: remapped.pack.mode,
    roomLeadId: remapped.pack.leadPackId,
    pinnedSkillIds,
  })

  return {
    sessionId: session.id,
    preview: previewRoomPack(remapped.pack),
    missingSkills,
  }
}
