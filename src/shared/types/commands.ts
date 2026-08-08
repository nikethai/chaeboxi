import { z } from 'zod'

/** Command name rules mirror skills (lowercase kebab-case) */
export const COMMAND_NAME_MAX = 64
export const COMMAND_DESCRIPTION_MAX = 1024
/** Max commands tagged per message via / chips */
export const COMMAND_EXPLICIT_MAX = 5

export const CommandSourceSchema = z.enum(['user', 'import', 'agent'])
export type CommandSource = z.infer<typeof CommandSourceSchema>

/** Which agent harness folder a filesystem command came from */
export const CommandOriginSchema = z.enum([
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
export type CommandOrigin = z.infer<typeof CommandOriginSchema>

export const CommandPackageSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(COMMAND_NAME_MAX),
  description: z.string().min(1).max(COMMAND_DESCRIPTION_MAX),
  instructions: z.string(),
  enabled: z.boolean(),
  source: CommandSourceSchema,
  version: z.string().optional(),
  tags: z.array(z.string()).optional(),
  updatedAt: z.number().optional(),
  origin: CommandOriginSchema.optional(),
  originPath: z.string().optional(),
  displayName: z.string().optional(),
})
export type CommandPackage = z.infer<typeof CommandPackageSchema>

export const CommandActivationSchema = z.object({
  commandId: z.string(),
  name: z.string(),
  mode: z.literal('explicit'),
})
export type CommandActivation = z.infer<typeof CommandActivationSchema>
