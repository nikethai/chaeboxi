import type { ToolRiskTier } from '@shared/types/mcp'
import { createStore, useStore } from 'zustand'

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

export const toolApprovalStore = createStore<ToolApprovalState>((set) => ({
  approvedTools: new Map(),
  auditLog: [],
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
}))

export function getToolApproval(sessionId: string, toolName: string) {
  return toolApprovalStore.getState().approvedTools.get(getApprovalKey(sessionId, toolName))
}

export function useToolApprovalStore<U>(selector: (state: ToolApprovalState) => U) {
  return useStore(toolApprovalStore, selector)
}
