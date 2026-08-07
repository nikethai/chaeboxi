import {
  SKILL_DESCRIPTION_MAX,
  SKILL_NAME_MAX,
  type SkillPackage,
  type SkillSource,
} from '@shared/types'

export class SkillParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SkillParseError'
  }
}

/** agentskills.io name rules (strict — for user-created skills) */
export function isValidSkillName(name: string): boolean {
  if (!name || name.length > SKILL_NAME_MAX) return false
  if (name.startsWith('-') || name.endsWith('-')) return false
  if (name.includes('--')) return false
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)
}

/**
 * Normalize ecosystem skill names (`ckm:write`, `CK:Plan`) to kebab-case for `$` tags.
 */
export function normalizeSkillName(raw: string, fallback = ''): string {
  const source = (raw || fallback || '').trim().toLowerCase()
  const normalized = source
    .replace(/[:_./\\]+/g, '-')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, SKILL_NAME_MAX)
  return normalized
}

/**
 * Parse agentskills.io-compatible SKILL.md (YAML frontmatter + markdown body).
 * Supports a minimal subset of YAML: `key: value` and simple nested `metadata:`.
 * Set `loose: true` for agent-folder skills with non-strict names (e.g. ckm:write).
 */
export function parseSkillMd(
  raw: string,
  options?: {
    id?: string
    source?: SkillSource
    enabled?: boolean
    loose?: boolean
    folderName?: string
    origin?: SkillPackage['origin']
    originPath?: string
  }
): SkillPackage {
  const text = raw.replace(/^\uFEFF/, '').trim()
  if (!text.startsWith('---')) {
    throw new SkillParseError('SKILL.md must start with YAML frontmatter (---)')
  }

  const end = text.indexOf('\n---', 3)
  if (end === -1) {
    throw new SkillParseError('SKILL.md frontmatter is not closed with ---')
  }

  const frontmatter = text.slice(3, end).trim()
  const instructions = text.slice(end + 4).replace(/^\n/, '')

  const fields = parseSimpleFrontmatter(frontmatter)
  const rawName = (fields.name || options?.folderName || '').trim()
  const displayName = rawName || options?.folderName || ''
  const name = options?.loose
    ? normalizeSkillName(rawName, options.folderName || 'skill')
    : rawName.toLowerCase()
  const description = (fields.description || '').trim()

  if (!name) {
    throw new SkillParseError('Frontmatter requires name')
  }
  if (!isValidSkillName(name)) {
    throw new SkillParseError(
      `Invalid skill name "${name}". Use lowercase letters, numbers, and single hyphens (max ${SKILL_NAME_MAX}).`
    )
  }
  if (!description) {
    throw new SkillParseError('Frontmatter requires description')
  }
  const clippedDescription =
    description.length > SKILL_DESCRIPTION_MAX ? `${description.slice(0, SKILL_DESCRIPTION_MAX - 1)}…` : description

  const source = options?.source ?? 'user'
  const id = options?.id ?? (source === 'builtin' ? `builtin:${name}` : `user:${name}`)

  return {
    id,
    name,
    description: clippedDescription,
    instructions: instructions.trim(),
    enabled: options?.enabled ?? true,
    source,
    version: fields.version || undefined,
    tags: fields.tags?.length ? fields.tags : undefined,
    updatedAt: Date.now(),
    origin: options?.origin,
    originPath: options?.originPath,
    displayName: displayName && displayName !== name ? displayName : undefined,
  }
}

export function serializeSkillMd(skill: SkillPackage): string {
  const lines = ['---', `name: ${skill.name}`, `description: ${escapeYamlScalar(skill.description)}`]
  if (skill.version) {
    lines.push(`version: ${escapeYamlScalar(skill.version)}`)
  }
  if (skill.tags?.length) {
    lines.push(`tags: ${skill.tags.join(', ')}`)
  }
  lines.push('---', '', skill.instructions.trim(), '')
  return lines.join('\n')
}

function escapeYamlScalar(value: string): string {
  if (/[:#\n"']/.test(value) || value.trim() !== value) {
    return JSON.stringify(value)
  }
  return value
}

function parseSimpleFrontmatter(frontmatter: string): {
  name?: string
  description?: string
  version?: string
  tags?: string[]
} {
  const result: { name?: string; description?: string; version?: string; tags?: string[] } = {}
  let currentKey: 'description' | null = null
  let descriptionLines: string[] = []

  for (const rawLine of frontmatter.split('\n')) {
    const line = rawLine.replace(/\r$/, '')
    // Skip nested metadata blocks for v1
    if (/^\s+/.test(line) && currentKey === 'description') {
      descriptionLines.push(line.trim())
      continue
    }
    if (currentKey === 'description' && descriptionLines.length) {
      result.description = descriptionLines.join(' ').trim()
      descriptionLines = []
      currentKey = null
    }

    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/)
    if (!match) continue
    const key = match[1].toLowerCase()
    let value = match[2].trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (key === 'name') {
      result.name = value
    } else if (key === 'description') {
      // Support folded/block YAML: description: >  or description: |
      if (!value || value === '>' || value === '|' || value === '>-' || value === '|-') {
        currentKey = 'description'
        descriptionLines = []
      } else {
        result.description = value
      }
    } else if (key === 'version') {
      result.version = value
    } else if (key === 'tags') {
      result.tags = value
        .split(/[,\s]+/)
        .map((t) => t.trim())
        .filter(Boolean)
    }
  }

  if (currentKey === 'description' && descriptionLines.length) {
    result.description = descriptionLines.join(' ').trim()
  }

  return result
}
