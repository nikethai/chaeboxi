import { describe, expect, it } from 'vitest'
import { isWebSearchConfigured } from './is-configured'

describe('isWebSearchConfigured', () => {
  it('returns true for free providers without API keys', () => {
    expect(isWebSearchConfigured({ provider: 'bing' } as never)).toBe(true)
    expect(isWebSearchConfigured({ provider: 'duckduckgo' } as never)).toBe(true)
    expect(isWebSearchConfigured({ provider: 'build-in' } as never)).toBe(true)
  })

  it('requires credentials for paid providers', () => {
    expect(isWebSearchConfigured({ provider: 'serper' } as never)).toBe(false)
    expect(isWebSearchConfigured({ provider: 'serper', serperApiKey: '  ' } as never)).toBe(false)
    expect(isWebSearchConfigured({ provider: 'serper', serperApiKey: 'sk-test' } as never)).toBe(true)

    expect(isWebSearchConfigured({ provider: 'tavily' } as never)).toBe(false)
    expect(isWebSearchConfigured({ provider: 'tavily', tavilyApiKey: 'tvly' } as never)).toBe(true)

    expect(isWebSearchConfigured({ provider: 'exa' } as never)).toBe(false)
    expect(isWebSearchConfigured({ provider: 'exa', exaApiKey: 'exa' } as never)).toBe(true)

    expect(isWebSearchConfigured({ provider: 'google', googleApiKey: 'k' } as never)).toBe(false)
    expect(
      isWebSearchConfigured({ provider: 'google', googleApiKey: 'k', googleCseId: 'cse' } as never)
    ).toBe(true)
  })
})
