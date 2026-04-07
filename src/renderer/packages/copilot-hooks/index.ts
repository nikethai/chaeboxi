/**
 * Copilot Hooks Module
 *
 * Pre-turn and post-turn hook actions for copilots.
 */

// ============================================================================
// Types
// ============================================================================

export type {
  CopilotHook,
  CopilotHooks,
  InjectContext,
  InjectDatetime,
  InjectSystemInfo,
  ValidateFormat,
  WebFetch,
} from './types'

export { CopilotHookSchema, CopilotHooksSchema } from './types'

// ============================================================================
// Executor
// ============================================================================

export { executePreHooks, executePostHooks } from './executor'
