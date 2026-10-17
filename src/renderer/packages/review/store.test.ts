import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReviewEntry, ReviewEntryInput } from '@shared/types/review'
import {
  addReviewEntry,
  listReviewEntries,
  loadReviewEntries,
  reviewStore,
  setLastCheckedAt,
  setReviewEntryState,
  setReviewStorageForTests,
  subscribeReviewEntries,
  updateReviewEntry,
  waitingCount,
} from './store'

const KEY = 'review-entries'
let data: Record<string, any>
let setItemNow: ReturnType<typeof vi.fn<(k: string, v: unknown) => Promise<void>>>

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
const input = (over: Partial<ReviewEntryInput> = {}): ReviewEntryInput => ({
  kind: 'change',
  scopeId: 's',
  text: 't',
  ref: { type: 'change', id: 'x' + Math.random() },
  ...over,
})
const stored = (): ReviewEntry[] => data[KEY]?.entries ?? []

beforeEach(() => {
  data = {}
  setItemNow = vi.fn<(k: string, v: unknown) => Promise<void>>(async (k: string, v: unknown) => {
    data[k] = JSON.parse(JSON.stringify(v))
  })
  setReviewStorageForTests({
    getItem: async <T>(k: string, fb: T) => (k in data ? (JSON.parse(JSON.stringify(data[k])) as T) : fb),
    setItemNow,
  })
  reviewStore.setState({ entries: [], lastCheckedAt: undefined, loaded: false })
})

describe('review store', () => {
  it('add before load keeps saved rows', async () => {
    data[KEY] = { entries: [row()] }
    await addReviewEntry(input())
    expect(stored()).toHaveLength(2)
  })

  it('concurrent adds both persist', async () => {
    await Promise.all([addReviewEntry(input({ text: 'a' })), addReviewEntry(input({ text: 'b' }))])
    expect(
      stored()
        .map((e) => e.text)
        .sort()
    ).toEqual(['a', 'b'])
  })

  it("another window's write is not lost", async () => {
    data[KEY] = { entries: [row()] }
    await loadReviewEntries()
    await addReviewEntry(input())
    data[KEY].entries.push(row({ id: 'other', ref: { type: 'change', id: 'o' } }))
    await updateReviewEntry('r1', { text: 'x' })
    expect(stored()).toHaveLength(3)
    expect(stored().find((e) => e.id === 'r1')?.text).toBe('x')
  })

  it('same open ref merges', async () => {
    const ref = { type: 'proposal', id: 'p1' } as const
    const a = await addReviewEntry(input({ kind: 'proposal', ref, text: 'one' }))
    const b = await addReviewEntry(input({ kind: 'proposal', ref, text: 'two' }))
    expect(stored()).toHaveLength(1)
    expect(b.id).toBe(a.id)
    expect(b.createdAt).toBe(a.createdAt)
    expect(stored()[0].text).toBe('two')
    await setReviewEntryState({ ref }, 'done')
    await addReviewEntry(input({ kind: 'proposal', ref, text: 'three' }))
    expect(stored()).toHaveLength(2)
  })

  it('state changes stamp resolvedAt', async () => {
    const e = await addReviewEntry(input({ undoUntil: 5 }))
    const d = await setReviewEntryState({ id: e.id }, 'dismissed')
    expect(Math.abs((d?.resolvedAt ?? 0) - Date.now())).toBeLessThan(2000)
    const o = await setReviewEntryState({ id: e.id }, 'open')
    expect(o?.resolvedAt).toBeUndefined()
    expect(o?.undoUntil).toBeUndefined()
    expect(await setReviewEntryState({ id: 'nope' }, 'done')).toBeUndefined()
  })

  it('load drops bad and old rows', async () => {
    const day = 24 * 60 * 60 * 1000
    const { ref: _r, ...noRef } = row({ id: 'bad' })
    data[KEY] = {
      entries: [
        noRef,
        row({ id: 'old', state: 'dismissed', resolvedAt: Date.now() - 31 * day }),
        row({ id: 'keep', createdAt: Date.now() - 90 * day }),
      ],
    }
    await loadReviewEntries()
    expect(reviewStore.getState().entries.map((e) => e.id)).toEqual(['keep'])
    expect(reviewStore.getState().loaded).toBe(true)
  })

  it('writes immediately under review-entries', async () => {
    await addReviewEntry(input())
    expect(setItemNow).toHaveBeenCalledWith(KEY, expect.anything())
  })

  it('subscribe', async () => {
    const cb = vi.fn()
    const off = subscribeReviewEntries(cb)
    await addReviewEntry(input())
    expect(cb).toHaveBeenCalled()
    expect(cb.mock.calls.at(-1)?.[0]).toHaveLength(1)
    off()
    cb.mockClear()
    await addReviewEntry(input())
    expect(cb).not.toHaveBeenCalled()
  })

  it('last checked persists', async () => {
    await setLastCheckedAt(123)
    reviewStore.setState({ entries: [], lastCheckedAt: undefined, loaded: false })
    await loadReviewEntries()
    expect(reviewStore.getState().lastCheckedAt).toBe(123)
  })

  it('waitingCount', () => {
    const open = (kind: ReviewEntry['kind']) => row({ kind })
    expect(waitingCount([open('needs-you'), open('proposal'), open('conflict')])).toBe(3)
    expect(waitingCount([open('change'), open('re-check'), row({ kind: 'proposal', state: 'done' })])).toBe(0)
  })

  it('listReviewEntries is newest first and filters', () => {
    reviewStore.setState({
      entries: [
        row({ id: 'a', createdAt: 1, scopeId: 'x' }),
        row({ id: 'b', createdAt: 3, scopeId: 'y', state: 'done' }),
        row({ id: 'c', createdAt: 2, scopeId: 'x' }),
      ],
    })
    expect(listReviewEntries().map((e) => e.id)).toEqual(['b', 'c', 'a'])
    expect(listReviewEntries({ scopeId: 'x' }).map((e) => e.id)).toEqual(['c', 'a'])
    expect(listReviewEntries({ states: ['done'] }).map((e) => e.id)).toEqual(['b'])
  })
})
