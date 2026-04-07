import { z } from 'zod'

// Zod schemas for CopilotHook types

export const InjectContextHookSchema = z.object({
  type: z.literal('inject-context'),
  content: z.string(),
})

export const InjectDatetimeHookSchema = z.object({
  type: z.literal('inject-datetime'),
})

export const InjectSystemInfoHookSchema = z.object({
  type: z.literal('inject-system-info'),
})

export const WebFetchHookSchema = z.object({
  type: z.literal('web-fetch'),
  url: z.string(),
  extractAs: z.enum(['text', 'json']),
})

export const ValidateFormatHookSchema = z.object({
  type: z.literal('validate-format'),
  format: z.enum(['markdown', 'json', 'code']),
})

export const CopilotHookSchema: z.ZodType<
  | { type: 'inject-context'; content: string }
  | { type: 'inject-datetime' }
  | { type: 'inject-system-info' }
  | { type: 'web-fetch'; url: string; extractAs: 'text' | 'json' }
  | { type: 'validate-format'; format: 'markdown' | 'json' | 'code' }
> = z.union([
  InjectContextHookSchema,
  InjectDatetimeHookSchema,
  InjectSystemInfoHookSchema,
  WebFetchHookSchema,
  ValidateFormatHookSchema,
])

export const CopilotHooksSchema = z.object({
  preTurn: z.array(CopilotHookSchema).optional().catch(undefined),
  postTurn: z.array(CopilotHookSchema).optional().catch(undefined),
})

export type InjectContextHook = z.infer<typeof InjectContextHookSchema>
export type InjectDatetimeHook = z.infer<typeof InjectDatetimeHookSchema>
export type InjectSystemInfoHook = z.infer<typeof InjectSystemInfoHookSchema>
export type WebFetchHook = z.infer<typeof WebFetchHookSchema>
export type ValidateFormatHook = z.infer<typeof ValidateFormatHookSchema>
