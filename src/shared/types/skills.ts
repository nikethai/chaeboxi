import { z } from 'zod'

/** agentskills.io-compatible skill name: lowercase, digits, hyphens */
export const SKILL_NAME_MAX = 64
export const SKILL_DESCRIPTION_MAX = 1024
export const SKILL_EXPLICIT_MAX = 5
export const SKILL_AUTO_MAX = 2

export const SkillSourceSchema = z.enum(['builtin', 'user', 'import', 'agent'])
export type SkillSource = z.infer<typeof SkillSourceSchema>

/** Which agent harness folder a filesystem skill came from */
export const SkillOriginSchema = z.enum([
  'claude',
  'codex',
  'cursor',
  'agents',
  'grok',
  'gemini',
  'opencode',
  'project',
  'unknown',
])
export type SkillOrigin = z.infer<typeof SkillOriginSchema>

export const SkillActivationModeSchema = z.enum(['explicit', 'session', 'auto'])
export type SkillActivationMode = z.infer<typeof SkillActivationModeSchema>

export const SkillPackageSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(SKILL_NAME_MAX),
  description: z.string().min(1).max(SKILL_DESCRIPTION_MAX),
  instructions: z.string(),
  enabled: z.boolean(),
  source: SkillSourceSchema,
  version: z.string().optional(),
  tags: z.array(z.string()).optional(),
  updatedAt: z.number().optional(),
  /** Filesystem origin harness (agent-scanned skills) */
  origin: SkillOriginSchema.optional(),
  /** Absolute path to SKILL.md when loaded from disk */
  originPath: z.string().optional(),
  /** Display name from frontmatter before kebab normalization */
  displayName: z.string().optional(),
})
export type SkillPackage = z.infer<typeof SkillPackageSchema>

/** Max skills listed in always-on system catalog (L1) to protect context */
export const SKILL_CATALOG_MAX = 24

export const SkillActivationSchema = z.object({
  skillId: z.string(),
  name: z.string(),
  mode: SkillActivationModeSchema,
})
export type SkillActivation = z.infer<typeof SkillActivationSchema>

/** Lightweight catalog entry (L1 progressive disclosure) */
export type SkillCatalogEntry = Pick<SkillPackage, 'id' | 'name' | 'description' | 'enabled'>
