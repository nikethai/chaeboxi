import { COMMAND_EXPLICIT_MAX, type CommandActivation, type CommandPackage } from '@shared/types'

export interface ResolveCommandActivationsInput {
  /** Command package ids from / chips / message.commandIds */
  explicitCommandIds?: string[]
  /** Optional names from inline /tokens */
  explicitNames?: string[]
  commands: CommandPackage[]
  explicitMax?: number
}

/**
 * Commands are explicit-only — never auto-matched.
 */
export function resolveCommandActivations(input: ResolveCommandActivationsInput): CommandActivation[] {
  const byId = new Map(input.commands.map((c) => [c.id, c]))
  const byName = new Map(input.commands.map((c) => [c.name.toLowerCase(), c]))
  const max = input.explicitMax ?? COMMAND_EXPLICIT_MAX
  const seen = new Set<string>()
  const result: CommandActivation[] = []

  const push = (cmd: CommandPackage | undefined) => {
    if (!cmd || !cmd.enabled || seen.has(cmd.id) || result.length >= max) return
    seen.add(cmd.id)
    result.push({ commandId: cmd.id, name: cmd.name, mode: 'explicit' })
  }

  for (const ref of input.explicitCommandIds || []) {
    push(byId.get(ref) || byName.get(ref.toLowerCase()))
  }
  for (const name of input.explicitNames || []) {
    push(byName.get(name.toLowerCase()))
  }

  return result
}

export function buildCommandContextBlocks(
  activations: CommandActivation[],
  byId: Map<string, CommandPackage>
): string {
  if (activations.length === 0) return ''
  const parts: string[] = ['## Active commands']
  for (const act of activations) {
    const cmd = byId.get(act.commandId)
    if (!cmd) continue
    parts.push(`### /${cmd.name}\n\n${cmd.instructions}`)
  }
  return parts.join('\n\n')
}
