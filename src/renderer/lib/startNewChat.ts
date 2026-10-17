import { getDefaultStore } from 'jotai'
import { router } from '@/router'
import { currentSessionIdAtom } from '@/stores/atoms'

/** Open a genuinely new conversation at `/new`; never restores the previous session. */
export function startNewChat(search?: { scopeId?: string; prefill?: string }): void {
  getDefaultStore().set(currentSessionIdAtom, null)
  void router.navigate({ to: '/new', search: search ?? {} })
}
