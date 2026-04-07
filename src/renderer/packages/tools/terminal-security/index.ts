import type { CommandRiskLevel } from './commandClassifier'
import { classifyCommand } from './commandClassifier'
import { checkDestructive } from './destructiveWarning'
import { validatePaths } from './pathValidator'

export { classifyCommand, type CommandRiskLevel } from './commandClassifier'
export { checkDestructive } from './destructiveWarning'
export { validatePaths } from './pathValidator'

export interface SecurityGateResult {
  allowed: boolean
  riskLevel: CommandRiskLevel
  warnings: string[]
  reason?: string
}

/**
 * Run all security gates on a command. Returns a combined result
 * indicating whether the command should be executed and any warnings.
 */
export function runSecurityGates(command: string, cwd?: string): SecurityGateResult {
  const classification = classifyCommand(command)
  const pathValidation = validatePaths(command, cwd)
  const destructiveCheck = checkDestructive(command)

  const warnings = [...destructiveCheck.warnings]

  if (classification.level === 'blocked') {
    return {
      allowed: false,
      riskLevel: 'blocked',
      warnings,
      reason: classification.reason,
    }
  }

  if (!pathValidation.safe) {
    return {
      allowed: false,
      riskLevel: 'dangerous',
      warnings: [...warnings, pathValidation.reason || 'Sensitive path detected'],
      reason: pathValidation.reason,
    }
  }

  return {
    allowed: true,
    riskLevel: classification.level,
    warnings,
    reason: classification.reason,
  }
}
