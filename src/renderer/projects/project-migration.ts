import type { Folder, Project, Session } from '@shared/types'
import { dualWriteProjectIds } from './project-context'

const MyFolders = 'myFolders'
const MyProjects = 'myProjects'
const ChatSessionsList = 'chat-sessions-list'

export const PROJECT_MIGRATION_JOURNAL_KEY = 'projectMigrationJournal'

export type ProjectMigrationStage = 'not-started' | 'projects-written' | 'sessions-dual-written' | 'committed'

export type ProjectMigrationJournal = {
  stage: ProjectMigrationStage
}

export type MigrateStore = {
  getData: <T>(key: string, defaultValue: T) => Promise<T>
  setData: <T>(key: string, value: T) => Promise<void>
}

export function folderToProject(folder: Folder): Project {
  return {
    id: folder.id,
    name: folder.name,
    emoji: folder.emoji,
    defaultCopilotId: folder.defaultCopilotId,
    defaultAgentId: folder.defaultAgentId ?? folder.defaultCopilotId,
    order: folder.order,
  }
}

export function projectToFolder(project: Project): Folder {
  return {
    id: project.id,
    name: project.name,
    emoji: project.emoji,
    defaultCopilotId: project.defaultCopilotId ?? project.defaultAgentId,
    defaultAgentId: project.defaultAgentId ?? project.defaultCopilotId,
    order: project.order,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function portableProjectHasNoRoot(project: unknown): boolean {
  if (!isRecord(project)) return false
  return !('root' in project) && !('workspaceRoot' in project) && !('displayPath' in project) && !('capabilityId' in project)
}

/**
 * Journaled Folder → Project metadata transform. Idempotent across crash stages.
 * Does not scan message bodies. Does not auto-authorize workspaceRoot.
 */
export async function runProjectMetadataMigration(store: MigrateStore): Promise<void> {
  const journal = await store.getData<ProjectMigrationJournal>(PROJECT_MIGRATION_JOURNAL_KEY, {
    stage: 'not-started',
  })
  let stage = journal.stage || 'not-started'

  if (stage === 'not-started' || stage === 'projects-written') {
    const folders = (await store.getData<Folder[]>(MyFolders, [])) || []
    const existing = (await store.getData<Project[]>(MyProjects, [])) || []
    const byId = new Map(existing.map((p) => [p.id, p]))
    for (const folder of folders) {
      if (!byId.has(folder.id)) {
        byId.set(folder.id, folderToProject(folder))
      }
    }
    const projects = [...byId.values()].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
    await store.setData(MyProjects, projects)
    await store.setData(MyFolders, projects.map(projectToFolder))
    stage = 'projects-written'
    await store.setData(PROJECT_MIGRATION_JOURNAL_KEY, { stage })
  }

  if (stage === 'projects-written' || stage === 'sessions-dual-written') {
    const list =
      (await store.getData<Array<{ id?: string; folderId?: string; projectId?: string }>>(ChatSessionsList, [])) || []
    const nextList = list.map((meta) => dualWriteProjectIds(meta))
    await store.setData(ChatSessionsList, nextList)
    stage = 'sessions-dual-written'
    await store.setData(PROJECT_MIGRATION_JOURNAL_KEY, { stage })
  }

  if (stage === 'sessions-dual-written') {
    await store.setData(PROJECT_MIGRATION_JOURNAL_KEY, { stage: 'committed' })
  }
}

export function lazySessionProjectAssignment(session: Session): Session {
  const next = dualWriteProjectIds(session)
  return next
}
