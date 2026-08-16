import { describe, expect, it } from 'vitest'
import {
  assertPackHasNoSecrets,
  buildRoomPack,
  listMissingSkills,
  parseRoomPack,
  previewRoomPack,
  remapRoomPack,
  resolveInstalledSkillIds,
  roomPackFileName,
} from './room-pack'

const critic = { id: 'a1', name: 'Critic', prompt: 'You are the critic.', emojiAvatar: '🧐' }
const builder = { id: 'a2', name: 'Builder', prompt: 'You are the builder.', picUrl: 'https://example.com/b.png' }
const researcher = { id: 'a3', name: 'Researcher', prompt: 'You are the researcher.' }

function workRoom() {
  return buildRoomPack({
    session: {
      name: 'Critic + Builder + Researcher',
      roomMode: 'work',
      roomLeadId: 'a2',
      agentIds: ['a1', 'a2', 'a3'],
      pinnedSkillIds: ['skill-review'],
      workspaceRoot: '/Users/huy/secret-project',
      credentialIds: ['cred-1'],
    },
    agents: [
      critic,
      builder,
      researcher,
      { id: 'unused', name: 'Local', prompt: 'no', picUrl: '/tmp/local.png' },
    ],
    skills: [{ id: 'skill-review', name: 'code-review' }],
  })
}

describe('room pack', () => {
  it('exports a 3-agent work room and strips local paths', () => {
    const pack = workRoom()
    expect(pack.__type).toBe('chaeboxi-room-pack')
    expect(pack.mode).toBe('work')
    expect(pack.agents).toHaveLength(3)
    expect(pack.leadPackId).toBe('a2')
    expect(pack.skills).toEqual([{ id: 'skill-review', name: 'code-review' }])
    expect(JSON.stringify(pack)).not.toContain('/Users/huy')
    expect(JSON.stringify(pack)).not.toContain('cred-1')
    expect(JSON.stringify(pack)).not.toContain('/tmp/local.png')
    expect(pack.agents[1].picUrl).toBe('https://example.com/b.png')
    assertPackHasNoSecrets(pack)
  })

  it('remaps ids on import so it cannot clobber', () => {
    const pack = workRoom()
    let n = 0
    const remapped = remapRoomPack(pack, () => `new-${++n}`)
    expect(remapped.pack.agents.map((a) => a.packId)).toEqual(['new-1', 'new-2', 'new-3'])
    expect(remapped.pack.leadPackId).toBe('new-2')
    expect(remapped.idMap.a1).toBe('new-1')
    expect(pack.agents[0].packId).toBe('a1')
  })

  it('lists missing skills and still resolves installed ones by name', () => {
    const pack = workRoom()
    pack.skills.push({ id: 'missing-id', name: 'not-installed' })
    const missing = listMissingSkills(pack, [{ id: 'other', name: 'code-review' }])
    expect(missing).toEqual([{ id: 'missing-id', name: 'not-installed' }])
    expect(resolveInstalledSkillIds(pack, [{ id: 'other', name: 'code-review' }])).toEqual(['other'])
  })

  it('roundtrips JSON and previews name + member count', () => {
    const pack = workRoom()
    const parsed = parseRoomPack(JSON.parse(JSON.stringify(pack)))
    expect(previewRoomPack(parsed)).toEqual({
      name: 'Critic + Builder + Researcher',
      mode: 'work',
      memberCount: 3,
      skillNames: ['code-review'],
    })
    expect(roomPackFileName(parsed.name)).toBe('critic-builder-researcher.chaeboxi-room.json')
  })

  it('rejects a file that is not a room pack', () => {
    expect(() => parseRoomPack({ __type: 'chatbox-history-transfer' })).toThrow(/Not a Chaeboxi room pack/)
  })
})
