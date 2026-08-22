import type { WorkspaceDescriptor } from '@shared/types/workspace'
import { useEffect, useState } from 'react'
import platform, { platformCapabilities } from '@/platform'
import { getEffectiveProjectId, resolveProjectContext } from '@/projects/project-context'

function sameWorkspaceDescriptor(a: WorkspaceDescriptor | null, b: WorkspaceDescriptor) {
  return (
    a?.projectId === b.projectId &&
    a?.capabilityId === b.capabilityId &&
    a?.rootGeneration === b.rootGeneration &&
    a?.status === b.status &&
    a?.displayPath === b.displayPath
  )
}

export function useProjectWorkspace(
  session?: { projectId?: string; folderId?: string; workspaceRoot?: string } | null
) {
  const projectId = session ? getEffectiveProjectId(session) : undefined
  const [descriptor, setDescriptor] = useState<WorkspaceDescriptor | null>(null)

  useEffect(() => {
    if (!projectId || !platformCapabilities.supportsProjectWorkspace || !platform.restoreProjectBinding) {
      setDescriptor((prev) => (prev === null ? prev : null))
      return
    }
    let cancelled = false
    const load = () => {
      void platform
        .restoreProjectBinding?.(projectId)
        .then((desc) => {
          if (cancelled || !desc) return
          setDescriptor((prev) => (sameWorkspaceDescriptor(prev, desc) ? prev : desc))
        })
        .catch(() => {
          if (!cancelled) setDescriptor(null)
        })
    }
    load()
    window.addEventListener('focus', load)
    return () => {
      cancelled = true
      window.removeEventListener('focus', load)
    }
  }, [projectId])

  const resolved = resolveProjectContext({
    session: session || {},
    descriptor,
  })
  return { projectId, descriptor, setDescriptor, resolved }
}
