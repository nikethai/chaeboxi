import { beforeEach, describe, expect, it } from 'vitest'
import { acquireBrowserLock, clearAllBrowserLocks, getBrowserLock, releaseBrowserLock } from './lock'

describe('browser lock', () => {
  beforeEach(() => {
    clearAllBrowserLocks()
  })

  it('acquires and releases', () => {
    expect(acquireBrowserLock('s1', 'run-a').ok).toBe(true)
    expect(getBrowserLock('s1')?.ownerRunId).toBe('run-a')
    releaseBrowserLock('s1', 'run-a')
    expect(getBrowserLock('s1')).toBeUndefined()
  })

  it('blocks concurrent different run', () => {
    acquireBrowserLock('s1', 'run-a')
    const second = acquireBrowserLock('s1', 'run-b')
    expect(second.ok).toBe(false)
    if (!second.ok) expect(second.error).toContain('BROWSER_BUSY')
  })

  it('same run re-acquire ok', () => {
    acquireBrowserLock('s1', 'run-a')
    expect(acquireBrowserLock('s1', 'run-a').ok).toBe(true)
  })
})
