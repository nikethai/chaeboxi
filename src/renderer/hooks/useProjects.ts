import { useFolders, myProjectsAtom } from './useFolders'

export { myProjectsAtom }

/** Compatibility adapter: Project writes dual-write Folder metadata. */
export function useProjects() {
  const { folders, addFolder, updateFolder, removeFolder } = useFolders()
  return {
    projects: folders,
    addProject: addFolder,
    updateProject: updateFolder,
    removeProject: removeFolder,
  }
}
