import { registerQuotaAdapter } from '@shared/providers/usage'
import { defaultQuotaAdapter } from './default'
import { geminiAntigravityQuotaAdapter } from './gemini-antigravity'
import { openaiCodexQuotaAdapter } from './openai-codex'
import { qwenPlanQuotaAdapter } from './qwen-plan'
import { xaiOAuthQuotaAdapter } from './xai-oauth'

let registered = false

/** Idempotent registration of all v1 quota adapters */
export function ensureQuotaAdaptersRegistered(): void {
  if (registered) return
  registerQuotaAdapter(openaiCodexQuotaAdapter)
  registerQuotaAdapter(geminiAntigravityQuotaAdapter)
  registerQuotaAdapter(qwenPlanQuotaAdapter)
  registerQuotaAdapter(xaiOAuthQuotaAdapter)
  registerQuotaAdapter(defaultQuotaAdapter)
  registered = true
}

export {
  defaultQuotaAdapter,
  geminiAntigravityQuotaAdapter,
  openaiCodexQuotaAdapter,
  qwenPlanQuotaAdapter,
  xaiOAuthQuotaAdapter,
}
