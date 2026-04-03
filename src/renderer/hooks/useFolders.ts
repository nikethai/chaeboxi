import type { Folder } from '@shared/types'
import { useAtom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { v4 as uuidv4 } from 'uuid'
import storage, { StorageKey } from '@/storage'

export const myFoldersAtom = atomWithStorage<Folder[]>(StorageKey.MyFolders, [], storage)

function sortFolders(folders: Folder[]) {
  return [...folders].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
}

export function useFolders() {
  const [folders, setFolders] = useAtom(myFoldersAtom)

  const addFolder = (folder: Omit<Folder, 'id' | 'order'> & Partial<Pick<Folder, 'id' | 'order'>>) => {
    const nextFolder: Folder = {
      id: folder.id || uuidv4(),
      name: folder.name,
      emoji: folder.emoji,
      defaultCopilotId: folder.defaultCopilotId,
      order: folder.order ?? folders.reduce((maxOrder, item) => Math.max(maxOrder, item.order), -1) + 1,
    }
    setFolders(async (prev) => sortFolders([...(await prev), nextFolder]))
    return nextFolder
  }

  const updateFolder = (folderId: string, updater: Partial<Folder> | ((folder: Folder) => Folder)) => {
    setFolders(async (prev) =>
      sortFolders(
        (await prev).map((folder) => {
          if (folder.id !== folderId) {
            return folder
          }
          return typeof updater === 'function' ? updater(folder) : { ...folder, ...updater }
        })
      )
    )
  }

  const removeFolder = (folderId: string) => {
    setFolders(async (prev) => (await prev).filter((folder) => folder.id !== folderId))
  }

  return {
    folders: sortFolders(folders),
    addFolder,
    updateFolder,
    removeFolder,
  }
}
