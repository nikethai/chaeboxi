import type { ToolRiskTier } from '@shared/types/mcp'
import { createStore, useStore } from 'zustand'
import { combine, persist } from 'zustand/middleware'
import { safeStorage } from './safeStorage'

export type ToolApprovalScope = 'once' | 'session'
export type ToolApprovalAuditDecision = 'allow' | 'deny' | 'auto-approve'

export type ToolApprovalRecord = {
  toolName: string
  riskTier: ToolRiskTier
  scope: ToolApprovalScope
  timestamp: number
}

export type ToolApprovalAuditEntry = {
  sessionId: string
  toolName: string
  riskTier: ToolRiskTier
  scope: ToolApprovalScope | 'none'
  decision: ToolApprovalAuditDecision
  timestamp: number
  args?: unknown
}

type ToolApprovalState = {
  approvedTools: Map<string, ToolApprovalRecord>
  auditLog: ToolApprovalAuditEntry[]
  addApproval: (sessionId: string, approval: ToolApprovalRecord) => void
  removeApproval: (sessionId: string, toolName: string) => void
  clearSessionApprovals: (sessionId: string) => void
  addAuditEntry: (entry: ToolApprovalAuditEntry) => void
}

function getApprovalKey(sessionId: string, toolName: string) {
  return `${sessionId}:${toolName}`
}

function serializeMap(map: Map<string, ToolApprovalRecord>): Record<string, ToolApprovalRecord> {
  const obj: Record<string, ToolApprovalRecord> = {}
  map.forEach((value, key) => {
    obj[key] = value
  })
  return obj
}

function deserializeMap(obj: Record<string, ToolApprovalRecord>): Map<string, ToolApprovalRecord> {
  return new Map(Object.entries(obj))
}

export const toolApprovalStore = createStore(
  persist(
    combine(
      {
        approvedTools: new Map<string, ToolApprovalRecord>(),
        auditLog: [] as ToolApprovalAuditEntry[],
      },
      (set, get) => ({
        addApproval: (sessionId, approval) =>
          set((state) => {
            const approvedTools = new Map(state.approvedTools)
            approvedTools.set(getApprovalKey(sessionId, approval.toolName), approval)
            return { approvedTools }
          }),
        removeApproval: (sessionId, toolName) =>
          set((state) => {
            const approvedTools = new Map(state.approvedTools)
            approvedTools.delete(getApprovalKey(sessionId, toolName))
            return { approvedTools }
          }),
        clearSessionApprovals: (sessionId) =>
          set((state) => {
            const approvedTools = new Map(state.approvedTools)
            for (const key of approvedTools.keys()) {
              if (key.startsWith(`${sessionId}:`)) {
                approvedTools.delete(key)
              }
            }
            return { approvedTools }
          }),
        addAuditEntry: (entry) =>
          set((state) => ({
            auditLog: [...state.auditLog, entry],
          })),
      })
    ),
    {
      name: 'tool-approval-store',
      version: 0,
      partialize: (state) => ({
        auditLog: state.auditLog,
        approvedTools: serializeMap(state.approvedTools),
      }),
      merge: (persistedState: unknown, currentState) => {
        const persisted = persistedState as { approvedTools?: Record<string, ToolApprovalRecord> } | undefined
        return {
          ...currentState,
          ...(persisted?.approvedTools ? { approvedTools: deserializeMap(persisted.approvedTools) } : {}),
        }
      },
      storage: safeStorage,
    }
  )
)

export function getToolApproval(sessionId: string, toolName: string) {
  return toolApprovalStore.getState().approvedTools.get(getApprovalKey(sessionId, toolName))
}

export function useToolApprovalStore<U>(selector: (state: ToolApprovalState) => U) {
  return useStore(toolApprovalStore, selector)
}
