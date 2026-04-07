/**
 * Copilot Hooks Types
 *
 * Zod schemas for pre-turn and post-turn hook actions.
 */

import { z } from 'zod'

// ============================================================================
// Hook Schemas
// ============================================================================

/**
 * Inject static context string into the prompt
 */
export const InjectContextSchema = z.object({
  type: z.literal('inject-context'),
  content: z.string(),
})

/**
 * Inject current datetime into the prompt
 */
export const InjectDatetimeSchema = z.object({
  type: z.literal('inject-datetime'),
})

/**
 * Inject system info (OS, platform, etc.) into the prompt
 */
export const InjectSystemInfoSchema = z.object({
  type: z.literal('inject-system-info'),
})

/**
 * Fetch content from a URL and inject it
 */
export const WebFetchSchema = z.object({
  type: z.literal('web-fetch'),
  url: z.string().url(),
  extractAs: z.enum(['text', 'json']),
})

/**
 * Validate output format after generation
 */
export const ValidateFormatSchema = z.object({
  type: z.literal('validate-format'),
  format: z.enum(['markdown', 'json', 'code']),
})

// ============================================================================
// Union Schema
// ============================================================================

export const CopilotHookSchema = z.discriminatedUnion('type', [
  InjectContextSchema,
  InjectDatetimeSchema,
  WebFetchSchema,
  ValidateFormatSchema,
])

export type InjectContext = z.infer<typeof InjectContextSchema>
export type InjectDatetime = z.infer<typeof InjectDatetimeSchema>
export type InjectSystemInfo = z.infer<typeof InjectSystemInfoSchema>
export type WebFetch = z.infer<typeof WebFetchSchema>
export type ValidateFormat = z.infer<typeof ValidateFormatSchema>
export type CopilotHook = z.infer<typeof CopilotHookSchema>

// ============================================================================
// Hooks Container Schema
// ============================================================================

export const CopilotHooksSchema = z.object({
  preTurn: z.array(CopilotHookSchema).optional().catch(undefined),
  postTurn: z.array(CopilotHookSchema).optional().catch(undefined),
})

export type CopilotHooks = z.infer<typeof CopilotHooksSchema>
