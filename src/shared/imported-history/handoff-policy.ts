import type { CopilotToolAccess } from '../types'
import type { ContinuationLineage } from './types'

export const FIRST_HANDOFF_TOOL_ACCESS: CopilotToolAccess = {
  mode: 'allowlist',
  tools: [],
  includeMcp: false,
}

export type FirstHandoffStreamOverrides = {
  webBrowsing: false
  nativeWebSearch: undefined
  knowledgeBase: undefined
  enableImageGenerationTool: false
  agentCodingEnabled: false
  browserArmed: false
  computerArmed: false
  skipSkillContext: true
  skipCommandContext: true
  skipIntegrationsContext: true
  toolAccess: CopilotToolAccess
  memoryAutoSave: false
}

export function isFirstImportedHandoff(lineage?: ContinuationLineage | null): boolean {
  return Boolean(lineage?.firstHandoffPending && !lineage.sourceMissing)
}

export function buildFirstHandoffStreamOverrides(
  lineage?: ContinuationLineage | null
): FirstHandoffStreamOverrides | null {
  if (!isFirstImportedHandoff(lineage)) {
    return null
  }
  return {
    webBrowsing: false,
    nativeWebSearch: undefined,
    knowledgeBase: undefined,
    enableImageGenerationTool: false,
    agentCodingEnabled: false,
    browserArmed: false,
    computerArmed: false,
    skipSkillContext: true,
    skipCommandContext: true,
    skipIntegrationsContext: true,
    toolAccess: FIRST_HANDOFF_TOOL_ACCESS,
    memoryAutoSave: false,
  }
}

export function markHandoffConsumed(lineage: ContinuationLineage): ContinuationLineage {
  return { ...lineage, firstHandoffPending: false }
}
