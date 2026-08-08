import { describe, expect, test } from 'vitest'
import { getSessionRouteState } from './sessionRouteState'

describe('getSessionRouteState', () => {
  test('identifies an initial pending session query as loading', () => {
    expect(getSessionRouteState({ session: undefined, isPending: true, isError: false })).toBe('loading')
  })

  test('identifies a failed session query as an error', () => {
    expect(getSessionRouteState({ session: undefined, isPending: false, isError: true })).toBe('error')
  })

  test('identifies a successful null session result as not found', () => {
    expect(getSessionRouteState({ session: null, isPending: false, isError: false })).toBe('not-found')
  })

  test('preserves an available session while a background request is pending or failed', () => {
    const session = { id: 'session-1' }

    expect(getSessionRouteState({ session, isPending: true, isError: false })).toBe('loaded')
    expect(getSessionRouteState({ session, isPending: false, isError: true })).toBe('loaded')
  })
})
