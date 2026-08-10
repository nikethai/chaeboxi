/**
 * Built-in slash commands (composer actions), separate from user CommandPackage prompts.
 * Example: /compact → summarize conversation context.
 */

export type SystemCommandId = 'compact'

export type SystemCommand = {
  id: SystemCommandId
  /** Slash name without leading / */
  name: string
  aliases?: string[]
  description: string
}

export const SYSTEM_COMMANDS: readonly SystemCommand[] = [
  {
    id: 'compact',
    name: 'compact',
    aliases: ['compress', 'summarize'],
    description: 'Summarize older messages to free context space',
  },
] as const

/** Match a whole-message slash command: `/compact`, `/compress`, optional trailing spaces. */
export function matchSystemSlashCommand(text: string): SystemCommand | null {
  const trimmed = text.trim()
  const match = trimmed.match(/^\/([a-z][a-z0-9-]*)\s*$/i)
  if (!match) return null
  const name = match[1].toLowerCase()
  return (
    SYSTEM_COMMANDS.find((cmd) => cmd.name === name || cmd.aliases?.includes(name)) ?? null
  )
}

/** Active / partial query matches for the command picker (system builtins). */
export function filterSystemCommands(query: string): SystemCommand[] {
  const q = query.trim().toLowerCase()
  if (!q) return [...SYSTEM_COMMANDS]
  return SYSTEM_COMMANDS.filter((cmd) => {
    if (cmd.name.startsWith(q) || cmd.name.includes(q)) return true
    return cmd.aliases?.some((a) => a.startsWith(q) || a.includes(q)) ?? false
  })
}
