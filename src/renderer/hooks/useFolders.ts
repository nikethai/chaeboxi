import type { Folder, Project } from '@shared/types'
import { useAtom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { v4 as uuidv4 } from 'uuid'
import { folderToProject, projectToFolder } from '@/projects/project-migration'
import storage, { StorageKey } from '@/storage'

export const myFoldersAtom = atomWithStorage<Folder[]>(StorageKey.MyFolders, [], storage)
export const myProjectsAtom = atomWithStorage<Project[]>(StorageKey.MyProjects, [], storage)

function sortFolders(folders: Folder[]) {
  return [...folders].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
}

export function useFolders() {
  const [folders, setFolders] = useAtom(myFoldersAtom)
  const [, setProjects] = useAtom(myProjectsAtom)

  const commit = async (next: Folder[]) => {
    const sorted = sortFolders(next)
    setFolders(sorted)
    setProjects(sorted.map(folderToProject))
    return sorted
  }

  const addFolder = (folder: Omit<Folder, 'id' | 'order'> & Partial<Pick<Folder, 'id' | 'order'>>) => {
    const nextFolder: Folder = {
      id: folder.id || uuidv4(),
      name: folder.name,
      emoji: folder.emoji,
      defaultCopilotId: folder.defaultCopilotId,
      defaultAgentId: folder.defaultAgentId ?? folder.defaultCopilotId,
      order: folder.order ?? folders.reduce((maxOrder, item) => Math.max(maxOrder, item.order), -1) + 1,
    }
    void commit([...folders, nextFolder])
    return nextFolder
  }

  const updateFolder = (folderId: string, updater: Partial<Folder> | ((folder: Folder) => Folder)) => {
    void commit(
      folders.map((folder) => {
        if (folder.id !== folderId) {
          return folder
        }
        return typeof updater === 'function' ? updater(folder) : { ...folder, ...updater }
      })
    )
  }

  const removeFolder = (folderId: string) => {
    void commit(folders.filter((folder) => folder.id !== folderId))
  }

  return {
    folders: sortFolders(folders),
    addFolder,
    updateFolder,
    removeFolder,
  }
}

export function toPortableProject(folder: Folder): Project {
  return folderToProject(folder)
}

export function toCompatibilityFolder(project: Project): Folder {
  return projectToFolder(project)
}
