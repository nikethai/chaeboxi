/**
 * @vitest-environment jsdom
 */
import type { ReviewEntry } from '@shared/types/review'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import type { ComponentType } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLastCheckedAt, useReviewEntries, useReviewRenderer, useReviewWaitingCount } from './hooks'
import type { ReviewRendererProps } from './registry'
import { registerReviewRenderer } from './registry'
import { reviewStore, setLastCheckedAt, setReviewStorageForTests } from './store'

const KEY = 'review-entries'
let data: Record<string, any>

const row = (over: Partial<ReviewEntry> = {}): ReviewEntry => ({
  id: 'r1',
  kind: 'change',
  scopeId: 's',
  text: 't',
  ref: { type: 'change', id: 'c1' },
  state: 'open',
  createdAt: 1000,
  ...over,
})

beforeEach(() => {
  data = {}
  setReviewStorageForTests({
    getItem: async <T,>(k: string, fb: T) => (k in data ? (JSON.parse(JSON.stringify(data[k])) as T) : fb),
    setItemNow: vi.fn(async (k: string, v: unknown) => {
      data[k] = JSON.parse(JSON.stringify(v))
    }),
  })
  reviewStore.setState({ entries: [], lastCheckedAt: undefined, loaded: false })
})
afterEach(() => {
  cleanup()
  setReviewStorageForTests(null)
})

describe('review hooks', () => {
  it('useReviewEntries loads on mount and again on focus', async () => {
    data[KEY] = { entries: [row()] }
    const { result } = renderHook(() => useReviewEntries())
    await waitFor(() => expect(result.current).toHaveLength(1))
    data[KEY].entries.push(row({ id: 'r2', ref: { type: 'change', id: 'c2' } }))
    act(() => {
      window.dispatchEvent(new Event('focus'))
    })
    await waitFor(() => expect(result.current).toHaveLength(2))
  })

  it('useReviewEntries reloads when the document becomes visible', async () => {
    const { result } = renderHook(() => useReviewEntries())
    await waitFor(() => expect(reviewStore.getState().loaded).toBe(true))
    data[KEY] = { entries: [row()] }
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await waitFor(() => expect(result.current).toHaveLength(1))
  })

  it('useReviewWaitingCount loads saved rows by itself and counts open waiting kinds only', async () => {
    data[KEY] = {
      entries: [
        row({ id: '1', kind: 'proposal', ref: { type: 'proposal', id: '1' } }),
        row({ id: '2', kind: 'needs-you', ref: { type: 'question', id: '2' } }),
        row({ id: '3', kind: 'conflict', ref: { type: 'conflict', id: '3' } }),
        row({ id: '4', kind: 'change', ref: { type: 'change', id: '4' } }),
        row({ id: '5', kind: 'proposal', state: 'done', ref: { type: 'proposal', id: '5' } }),
      ],
    }
    const { result } = renderHook(() => useReviewWaitingCount())
    await waitFor(() => expect(result.current).toBe(3))
  })

  it('useLastCheckedAt loads the saved value by itself', async () => {
    data[KEY] = { entries: [], lastCheckedAt: 77 }
    const { result } = renderHook(() => useLastCheckedAt())
    await waitFor(() => expect(result.current).toBe(77))
  })

  it.each([
    ['useReviewEntries', useReviewEntries],
    ['useReviewWaitingCount', useReviewWaitingCount],
    ['useLastCheckedAt', useLastCheckedAt],
  ] as const)('%s removes its focus and visibility listeners on unmount', async (_name, hook) => {
    const winAdd = vi.spyOn(window, 'addEventListener')
    const winRemove = vi.spyOn(window, 'removeEventListener')
    const docAdd = vi.spyOn(document, 'addEventListener')
    const docRemove = vi.spyOn(document, 'removeEventListener')
    const { unmount } = renderHook(() => hook())
    await waitFor(() => expect(reviewStore.getState().loaded).toBe(true))
    const onFocus = winAdd.mock.calls.find(([type]) => type === 'focus')?.[1]
    const onVisible = docAdd.mock.calls.find(([type]) => type === 'visibilitychange')?.[1]
    expect(onFocus).toBeTypeOf('function')
    expect(onVisible).toBeTypeOf('function')
    unmount()
    expect(winRemove).toHaveBeenCalledWith('focus', onFocus)
    expect(docRemove).toHaveBeenCalledWith('visibilitychange', onVisible)
    vi.restoreAllMocks()
  })

  it('useLastCheckedAt follows setLastCheckedAt', async () => {
    const { result } = renderHook(() => useLastCheckedAt())
    expect(result.current).toBeUndefined()
    await act(async () => {
      await setLastCheckedAt(42)
    })
    expect(result.current).toBe(42)
  })

  it('useReviewRenderer updates when a renderer registers late', () => {
    const C = (() => null) as ComponentType<ReviewRendererProps>
    const { result } = renderHook(() => useReviewRenderer({ kind: 'conflict', ref: { type: 'conflict', id: 'x' } }))
    expect(result.current).toBeUndefined()
    let off = () => {}
    act(() => {
      off = registerReviewRenderer('conflict', C)
    })
    expect(result.current).toBe(C)
    act(() => off())
    expect(result.current).toBeUndefined()
  })
})
