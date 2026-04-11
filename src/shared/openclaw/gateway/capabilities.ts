export type CapabilityRisk = 'safe' | 'moderate' | 'dangerous'

const DANGEROUS_CAPABILITIES = new Set([
  'shell',
  'exec',
  'file_write',
  'file_delete',
  'system',
  'admin',
  'sudo',
  'network',
])

const MODERATE_CAPABILITIES = new Set([
  'tool',
  'tools',
  'tool_use',
  'file_read',
  'web_browse',
  'code_execution',
  'file',
])

export function classifyCapabilityRisk(capability: string): CapabilityRisk {
  const lower = capability.toLowerCase()
  if (DANGEROUS_CAPABILITIES.has(lower)) return 'dangerous'
  if (MODERATE_CAPABILITIES.has(lower)) return 'moderate'
  return 'safe'
}

export function getCapabilityRiskColor(risk: CapabilityRisk): string {
  switch (risk) {
    case 'dangerous':
      return 'red'
    case 'moderate':
      return 'yellow'
    case 'safe':
      return 'chatbox-brand'
  }
}

export function getCapabilityTooltip(capability: string, risk: CapabilityRisk): string | undefined {
  if (risk === 'dangerous') {
    return `"${capability}" allows this agent to execute system-level operations. Use with caution on remote gateways.`
  }
  if (risk === 'moderate') {
    return `"${capability}" grants tool access. Review agent behavior carefully.`
  }
  return undefined
}
