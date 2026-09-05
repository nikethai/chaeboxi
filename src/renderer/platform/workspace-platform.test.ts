import { describe, expect, it } from 'vitest'
import { createPlatformCapabilities } from './capabilities'
import TestPlatform from './test_platform'

describe('privileged workspace fail-closed platforms', () => {
  it('web platform source rejects privileged workspace APIs', async () => {
    const { readFileSync } = await import('node:fs')
    const src = readFileSync(new URL('./web_platform.ts', import.meta.url), 'utf8')
    expect(src).toMatch(/UNSUPPORTED_PLATFORM/)
    expect(src).toMatch(/pickAndBindProject/)
    expect(src).toMatch(/readWorkspaceFile/)
  })

  it('test platform rejects privileged bind/read/mutate', async () => {
    const test = new TestPlatform()
    await expect(test.pickAndBindProject('p1')).rejects.toThrow(/UNSUPPORTED_PLATFORM/)
    await expect(test.readWorkspaceFile('cap', 'a.txt')).rejects.toThrow(/UNSUPPORTED_PLATFORM/)
    await expect(test.createWorkspaceFile()).rejects.toThrow(/UNSUPPORTED_PLATFORM/)
    await expect(test.readFileByPath('/tmp/x')).rejects.toThrow(/UNSUPPORTED_PLATFORM/)
    await expect(test.applyWorkspaceChangeSet()).rejects.toThrow(/UNSUPPORTED_PLATFORM/)
    await expect(test.beginWorkspaceChangeSet()).rejects.toThrow(/UNSUPPORTED_PLATFORM/)
    await expect(test.prepareWorkspaceExport()).rejects.toThrow(/UNSUPPORTED_PLATFORM/)
    await expect(test.getSourceControlStatus()).rejects.toThrow(/UNSUPPORTED_PLATFORM/)
    await expect(test.getLocalExecutionStatus()).rejects.toThrow(/UNSUPPORTED_PLATFORM/)
  })

  it('desktop adapter never grants native mutation from renderer flags', async () => {
    const { readFileSync } = await import('node:fs')
    const src = readFileSync(new URL('./desktop_platform.ts', import.meta.url), 'utf8')
    expect(src).toMatch(/revokeNativeMutationIfHidden/)
    expect(src).not.toMatch(/workspace:set-mutation',\s*true/)
    expect(src).toMatch(/createWorkspaceFile/)
    expect(src).toMatch(/MUTATION_DISABLED/)
  })

  it('Quick/mobile do not get project workspace capability', () => {
    const mobile = createPlatformCapabilities({ type: 'mobile', formFactor: 'mobile', buildPlatform: 'ios' })
    expect(mobile.supportsProjectWorkspace).toBe(false)
    const android = createPlatformCapabilities({ type: 'desktop', formFactor: 'mobile', buildPlatform: 'android' })
    expect(android.supportsProjectWorkspace).toBe(false)
  })
})
