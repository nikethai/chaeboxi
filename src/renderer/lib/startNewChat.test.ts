import { getDefaultStore } from 'jotai'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { currentSessionIdAtom } from '@/stores/atoms'

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }))
vi.mock('@/router', () => ({ router: { navigate } }))

import { startNewChat } from './startNewChat'

describe('startNewChat', () => {
  beforeEach(() => {
    navigate.mockReset()
  })

  it('clears the current session and navigates to /new with the search', () => {
    const store = getDefaultStore()
    store.set(currentSessionIdAtom, 's1')
    startNewChat({ prefill: 'Which quote is current?', scopeId: 'p1' })
    expect(store.get(currentSessionIdAtom)).toBeNull()
    expect(navigate).toHaveBeenCalledWith({ to: '/new', search: { prefill: 'Which quote is current?', scopeId: 'p1' } })
  })

  it('passes an empty search by default', () => {
    startNewChat()
    expect(navigate).toHaveBeenCalledWith({ to: '/new', search: {} })
  })
})
