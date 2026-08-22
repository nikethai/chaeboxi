import NiceModal from '@ebay/nice-modal-react'
import { ToolRiskTier } from '@shared/types/mcp'
import type { ToolSet } from 'ai'
import { t } from 'i18next'
import type { ToolApprovalModalResult } from '@/modals/ToolApproval'
import { getToolApproval, toolApprovalStore } from '@/stores/toolApprovalStore'
import { getToolRiskTier } from '../tools/risk-engine'

const TOOL_EXECUTE_TIMEOUT_MS = 90_000
const TOOL_APPROVAL_TIMEOUT_MS = 120_000

export function workspaceApprovalFingerprint(toolName: string, args: unknown): string | null {
  if (toolName !== 'create_file' && toolName !== 'edit_file' && toolName !== 'delete_file') {
    return null
  }
  return JSON.stringify({ toolName, args })
}

function createToolDeniedResult(toolName: string, riskTier: ToolRiskTier) {
  return {
    denied: true,
    toolName,
    riskTier,
    message: t('Tool execution denied by user.'),
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`))
    }, ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      }
    )
  })
}

/** Shared approval wrapper. Workspace mutations never session-auto; fingerprint changes need a new approval. */
export function wrapToolsWithApproval(sessionId: string | undefined, tools: ToolSet): ToolSet {
  if (!sessionId) {
    return tools
  }

  return Object.fromEntries(
    Object.entries(tools).map(([toolName, definition]) => {
      const riskTier = getToolRiskTier(toolName, definition?.description)

      return [
        toolName,
        {
          ...definition,
          execute: async (args: unknown, context) => {
            const existingApproval = getToolApproval(sessionId, toolName)
            const fingerprint = workspaceApprovalFingerprint(toolName, args)
            const destructiveWorkspace = fingerprint !== null
            const fingerprintMatches = !fingerprint || existingApproval?.argsFingerprint === fingerprint
            const canAutoApprove =
              !destructiveWorkspace &&
              (riskTier === ToolRiskTier.LOW ||
                (existingApproval?.scope === 'session' &&
                  existingApproval.riskTier === riskTier &&
                  riskTier !== ToolRiskTier.CRITICAL &&
                  fingerprintMatches))

            let approvedScope: 'auto' | 'once' | 'session' = 'auto'

            if (canAutoApprove) {
              toolApprovalStore.getState().addAuditEntry({
                sessionId,
                toolName,
                riskTier,
                scope: existingApproval?.scope || 'session',
                decision: 'auto-approve',
                timestamp: Date.now(),
                args,
              })
            } else {
              const modalResult = (await withTimeout(
                NiceModal.show('tool-approval', {
                  toolName,
                  description: definition?.description,
                  riskTier,
                  parameters: args,
                }) as Promise<ToolApprovalModalResult | undefined>,
                TOOL_APPROVAL_TIMEOUT_MS,
                `Tool approval for ${toolName}`
              ).catch(() => 'deny' as const)) as ToolApprovalModalResult | undefined

              if (!modalResult || modalResult === 'deny') {
                toolApprovalStore.getState().addAuditEntry({
                  sessionId,
                  toolName,
                  riskTier,
                  scope: 'none',
                  decision: 'deny',
                  timestamp: Date.now(),
                  args,
                })
                return createToolDeniedResult(toolName, riskTier)
              }

              approvedScope = modalResult
              const approval = {
                toolName,
                riskTier,
                scope: modalResult,
                timestamp: Date.now(),
                argsFingerprint: fingerprint ?? undefined,
              }
              toolApprovalStore.getState().addApproval(sessionId, approval)
              toolApprovalStore.getState().addAuditEntry({
                sessionId,
                toolName,
                riskTier,
                scope: modalResult,
                decision: 'allow',
                timestamp: approval.timestamp,
                args,
              })
            }

            try {
              return await withTimeout(
                Promise.resolve(definition.execute?.(args, context)),
                TOOL_EXECUTE_TIMEOUT_MS,
                `Tool ${toolName}`
              )
            } finally {
              if (approvedScope === 'once') {
                toolApprovalStore.getState().removeApproval(sessionId, toolName)
              }
            }
          },
        },
      ]
    })
  ) as ToolSet
}
