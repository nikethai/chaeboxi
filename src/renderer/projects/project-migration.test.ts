import { describe, expect, it } from 'vitest'
import type { Folder } from '@shared/types'
import {
  folderToProject,
  portableProjectHasNoRoot,
  PROJECT_MIGRATION_JOURNAL_KEY,
  type ProjectMigrationJournal,
  runProjectMetadataMigration,
} from './project-migration'

const MyFolders = 'myFolders'
const MyProjects = 'myProjects'
const ChatSessionsList = 'chat-sessions-list'

function memoryStore(initial: Record<string, unknown> = {}) {
  const data = { ...initial }
  return {
    data,
    getData: async <T>(key: string, defaultValue: T) => (key in data ? (data[key] as T) : defaultValue),
    setData: async <T>(key: string, value: T) => {
      data[key] = value
    },
  }
}

const folders: Folder[] = [
  { id: 'keep-id', name: 'Alpha', emoji: '🚀', defaultAgentId: 'agent-1', order: 2 },
  { id: 'second', name: 'Beta', defaultCopilotId: 'copilot-old', order: 1 },
]

describe('journaled Folder to Project migration', () => {
  it('preserves ids, names, emoji, order, and default agent', async () => {
    const store = memoryStore({ [MyFolders]: folders, [ChatSessionsList]: [{ id: 's1', folderId: 'keep-id' }] })
    await runProjectMetadataMigration(store)
    const projects = await store.getData(MyProjects, [] as Folder[])
    expect(projects.map((p) => p.id)).toEqual(['second', 'keep-id'])
    expect(projects.find((p) => p.id === 'keep-id')).toMatchObject({
      name: 'Alpha',
      emoji: '🚀',
      defaultAgentId: 'agent-1',
    })
    expect(projects.find((p) => p.id === 'second')).toMatchObject({
      defaultAgentId: 'copilot-old',
    })
    const dualFolders = await store.getData(MyFolders, [] as Folder[])
    expect(dualFolders.map((f) => f.id)).toEqual(projects.map((p) => p.id))
    const list = await store.getData(ChatSessionsList, [] as Array<{ projectId?: string; folderId?: string }>)
    expect(list[0]).toMatchObject({ folderId: 'keep-id', projectId: 'keep-id' })
    const journal = await store.getData<ProjectMigrationJournal>(PROJECT_MIGRATION_JOURNAL_KEY, { stage: 'not-started' })
    expect(journal.stage).toBe('committed')
    expect(projects.every(portableProjectHasNoRoot)).toBe(true)
  })

  it('is idempotent from each journal stage', async () => {
    const stages: ProjectMigrationJournal['stage'][] = ['not-started', 'projects-written', 'sessions-dual-written', 'committed']
    for (const stage of stages) {
      const initial: Record<string, unknown> = {
        [MyFolders]: folders,
        [ChatSessionsList]: [{ id: 's1', folderId: 'keep-id' }],
        [PROJECT_MIGRATION_JOURNAL_KEY]: { stage },
      }
      if (stage !== 'not-started') {
        initial[MyProjects] = folders.map(folderToProject)
      }
      const store = memoryStore(initial)
      await runProjectMetadataMigration(store)
      await runProjectMetadataMigration(store)
      const journal = await store.getData<ProjectMigrationJournal>(PROJECT_MIGRATION_JOURNAL_KEY, { stage: 'not-started' })
      expect(journal.stage).toBe('committed')
      const projects = await store.getData(MyProjects, [] as Folder[])
      expect(projects).toHaveLength(2)
      expect(projects.map((p) => p.id).sort()).toEqual(['keep-id', 'second'])
    }
  })

  it('rejects portable metadata that smuggles a root', () => {
    expect(portableProjectHasNoRoot({ id: 'p', name: 'n', order: 0, root: '/etc' })).toBe(false)
    expect(portableProjectHasNoRoot({ id: 'p', name: 'n', order: 0 })).toBe(true)
  })
})
