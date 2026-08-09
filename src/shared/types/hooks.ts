import { z } from 'zod'

export const HookEventSchema = z.enum([
  'SessionStart',
  'PreTurn',
  'PostTurn',
  'PreToolUse',
  'PostToolUse',
  'Stop',
])
export type HookEvent = z.infer<typeof HookEventSchema>

export const HookKindSchema = z.enum(['declarative', 'command'])
export type HookKind = z.infer<typeof HookKindSchema>

export const HookOriginSchema = z.enum([
  'claude',
  'cursor',
  'project',
  'user',
  'builtin',
  'unknown',
])
export type HookOrigin = z.infer<typeof HookOriginSchema>

/** Declarative payload (mirrors copilot-hooks subset) */
export const DeclarativeHookPayloadSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('inject-context'), content: z.string() }),
  z.object({ type: z.literal('inject-datetime') }),
  z.object({ type: z.literal('inject-system-info') }),
  z.object({
    type: z.literal('web-fetch'),
    url: z.string(),
    extractAs: z.enum(['text', 'json']).default('text'),
  }),
  z.object({
    type: z.literal('validate-format'),
    format: z.enum(['markdown', 'json', 'code']),
  }),
  z.object({ type: z.literal('inject-stdout'), content: z.string() }),
])
export type DeclarativeHookPayload = z.infer<typeof DeclarativeHookPayloadSchema>

export const HookDefinitionSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  event: HookEventSchema,
  enabled: z.boolean(),
  origin: HookOriginSchema,
  originPath: z.string().optional(),
  kind: HookKindSchema,
  /** Tool name matcher regex for Pre/PostToolUse */
  matcher: z.string().optional(),
  /** Shell command (kind=command) */
  command: z.string().optional(),
  timeoutMs: z.number().optional(),
  /** Declarative payload (kind=declarative) */
  payload: DeclarativeHookPayloadSchema.optional(),
})
export type HookDefinition = z.infer<typeof HookDefinitionSchema>

/** Persisted user overrides for imported/builtin hooks */
export const HookOverridesSchema = z.object({
  /** Master switch for shell hooks — default off */
  shellHooksEnabled: z.boolean().default(false),
  /** id → enabled */
  enabledById: z.record(z.string(), z.boolean()).default({}),
})
export type HookOverrides = z.infer<typeof HookOverridesSchema>

export const HookRunRecordSchema = z.object({
  id: z.string(),
  hookId: z.string(),
  event: HookEventSchema,
  at: z.number(),
  exitCode: z.number().optional(),
  blocked: z.boolean().optional(),
  outputPreview: z.string().optional(),
  error: z.string().optional(),
})
export type HookRunRecord = z.infer<typeof HookRunRecordSchema>
