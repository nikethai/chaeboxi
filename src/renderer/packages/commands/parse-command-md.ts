import {
  COMMAND_DESCRIPTION_MAX,
  COMMAND_NAME_MAX,
  type CommandOrigin,
  type CommandPackage,
  type CommandSource,
} from '@shared/types'
import { isValidSkillName, normalizeSkillName } from '@/packages/skills'

export class CommandParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CommandParseError'
  }
}

export function isValidCommandName(name: string): boolean {
  return isValidSkillName(name)
}

export function normalizeCommandName(raw: string, fallback = ''): string {
  return normalizeSkillName(raw, fallback)
}

/**
 * Parse slash-command markdown (frontmatter optional for loose agent files).
 * Claude/Cursor commands are often single `.md` files with optional YAML frontmatter.
 */
export function parseCommandMd(
  raw: string,
  options?: {
    id?: string
    source?: CommandSource
    enabled?: boolean
    loose?: boolean
    fileBaseName?: string
    origin?: CommandOrigin
    originPath?: string
  }
): CommandPackage {
  const text = raw.replace(/^\uFEFF/, '').trim()
  let frontmatter = ''
  let instructions = text
  let fields: Record<string, string> = {}

  if (text.startsWith('---')) {
    const end = text.indexOf('\n---', 3)
    if (end === -1) {
      if (!options?.loose) {
        throw new CommandParseError('Command frontmatter is not closed with ---')
      }
    } else {
      frontmatter = text.slice(3, end).trim()
      instructions = text.slice(end + 4).replace(/^\n/, '')
      fields = parseSimpleFrontmatter(frontmatter)
    }
  }

  const rawName = (fields.name || options?.fileBaseName || '').trim()
  const displayName = rawName || options?.fileBaseName || ''
  const name = options?.loose
    ? normalizeCommandName(rawName, options.fileBaseName || 'command')
    : (rawName || options?.fileBaseName || '').toLowerCase()
  const description =
    (fields.description || '').trim() ||
    (options?.loose ? `Command /${name}` : '')

  if (!name) {
    throw new CommandParseError('Command requires a name (frontmatter or filename)')
  }
  if (!isValidCommandName(name)) {
    throw new CommandParseError(
      `Invalid command name "${name}". Use lowercase letters, numbers, and single hyphens (max ${COMMAND_NAME_MAX}).`
    )
  }
  if (!description) {
    throw new CommandParseError('Command requires a description')
  }
  if (description.length > COMMAND_DESCRIPTION_MAX) {
    throw new CommandParseError(`Description max ${COMMAND_DESCRIPTION_MAX} chars`)
  }
  if (!instructions.trim() && !options?.loose) {
    throw new CommandParseError('Command body is empty')
  }

  return {
    id: options?.id || `user:${name}`,
    name,
    description: description.slice(0, COMMAND_DESCRIPTION_MAX),
    instructions: instructions.trim() || description,
    enabled: options?.enabled ?? true,
    source: options?.source || 'user',
    origin: options?.origin,
    originPath: options?.originPath,
    displayName: displayName || undefined,
  }
}

export function serializeCommandMd(cmd: CommandPackage): string {
  const lines = ['---', `name: ${cmd.name}`, `description: ${cmd.description}`]
  if (cmd.tags?.length) {
    lines.push(`tags: ${cmd.tags.join(', ')}`)
  }
  lines.push('---', '', cmd.instructions || '')
  return lines.join('\n')
}

function parseSimpleFrontmatter(frontmatter: string): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const line of frontmatter.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const colon = trimmed.indexOf(':')
    if (colon === -1) continue
    const key = trimmed.slice(0, colon).trim()
    let value = trimmed.slice(colon + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    fields[key] = value
  }
  return fields
}
