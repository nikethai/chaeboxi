import { toSessionAgentFieldsFromSelection } from '@shared/new-chat-agents'
import type { Session } from '@shared/types'
import { z } from 'zod'

/** Search params of `/new`. Kept free of router imports so routes/new.tsx can use it without a cycle. */
export const NewChatSearchSchema = z.object({
  copilotId: z.string().optional(),
  scopeId: z.string().optional(),
  prefill: z.string().optional(),
})

export type NewChatSearch = z.infer<typeof NewChatSearchSchema>

// Literal until slice 3 lands; then use its EVERYWHERE_SCOPE_ID constant.
const EVERYWHERE = 'everywhere'

/** Apply search params to a draft session. Absent params never clear what the user already picked. */
export function seedNewChatSession(session: Session, search: NewChatSearch): Session {
  let next = session
  if (search.copilotId) {
    next = { ...next, ...toSessionAgentFieldsFromSelection([search.copilotId]) }
  }
  if (search.scopeId && search.scopeId !== EVERYWHERE) {
    next = { ...next, projectId: search.scopeId }
  }
  return next
}
