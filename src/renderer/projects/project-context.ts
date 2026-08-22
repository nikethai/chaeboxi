import type { Session } from '@shared/types'
import type { WorkspaceDescriptor, WorkspaceStatus } from '@shared/types/workspace'

export type ResolvedProjectContext =
  | {
      kind: 'ready'
      projectId: string
      descriptor: WorkspaceDescriptor
    }
  | {
      kind: 'unavailable'
      projectId: string
      status: Extract<WorkspaceStatus, 'missing' | 'permission-denied' | 'relink-required' | 'chat-only' | 'unsupported'>
      descriptor?: WorkspaceDescriptor
    }
  | {
      kind: 'legacy-reconnect-required'
      legacyRootHint: string
    }
  | {
      kind: 'chat-only'
      projectId?: string
    }

export function getEffectiveProjectId(session: {
  projectId?: string
  folderId?: string
}): string | undefined {
  return session.projectId || session.folderId || undefined
}

/**
 * Resolver truth table:
 * - projectId set + valid native binding => ready
 * - projectId set + no/missing binding => no filesystem context; never fall back to session root
 * - projectId set + relink/permission => explicit unavailable
 * - no projectId, legacy workspaceRoot => legacy-reconnect-required; no capability
 * - no project/root => chat only
 */
export function resolveProjectContext(input: {
  session: Pick<Session, 'projectId' | 'folderId' | 'workspaceRoot'>
  descriptor?: WorkspaceDescriptor | null
}): ResolvedProjectContext {
  const projectId = getEffectiveProjectId(input.session)
  if (projectId) {
    const descriptor = input.descriptor
    if (descriptor && descriptor.status === 'ready' && descriptor.capabilityId) {
      return { kind: 'ready', projectId, descriptor }
    }
    if (descriptor && (descriptor.status === 'missing' || descriptor.status === 'permission-denied' || descriptor.status === 'relink-required')) {
      return { kind: 'unavailable', projectId, status: descriptor.status, descriptor }
    }
    return { kind: 'unavailable', projectId, status: 'chat-only', descriptor: descriptor ?? undefined }
  }
  const legacy = input.session.workspaceRoot?.trim()
  if (legacy) {
    return { kind: 'legacy-reconnect-required', legacyRootHint: legacy }
  }
  return { kind: 'chat-only', projectId: undefined }
}

export function tombstoneLegacyRoot<T extends { workspaceRoot?: string }>(session: T): T {
  if (!session.workspaceRoot) return session
  return { ...session, workspaceRoot: undefined }
}

export function dualWriteProjectIds<T extends { projectId?: string; folderId?: string }>(input: T): T {
  const id = input.projectId || input.folderId
  if (!id) return input
  return { ...input, projectId: id, folderId: id }
}
