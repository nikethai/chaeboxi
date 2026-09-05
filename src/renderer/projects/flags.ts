import { DEFAULT_PROJECT_WORKSPACE_FLAGS, type ProjectWorkspaceFlags } from '@shared/types/workspace'
import { settingsStore } from '@/stores/settingsStore'

export function getProjectWorkspaceFlags(): ProjectWorkspaceFlags {
  const settings = settingsStore.getState().getSettings?.() ?? settingsStore.getState()
  const flags = (settings as { projectWorkspace?: ProjectWorkspaceFlags }).projectWorkspace
  return {
    migrationEnabled: flags?.migrationEnabled !== false,
    directoryUxEnabled: flags?.directoryUxEnabled !== false,
    explorerEnabled: flags?.explorerEnabled !== false,
    mutationEnabled: flags?.mutationEnabled === true,
    exportEnabled: flags?.exportEnabled === true,
    scmEnabled: flags?.scmEnabled === true,
    stagingEnabled: flags?.stagingEnabled === true,
    applyEnabled: flags?.applyEnabled === true,
    wasiEnabled: flags?.wasiEnabled === true,
    worktreesEnabled: flags?.worktreesEnabled === true,
  }
}

export { DEFAULT_PROJECT_WORKSPACE_FLAGS }
