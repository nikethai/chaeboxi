import { describe, expect, it } from 'vitest'
import { normalizeSiteUrl } from './jira-test-connection'

describe('normalizeSiteUrl', () => {
  it('strips trailing slashes', () => {
    expect(normalizeSiteUrl('https://acme.atlassian.net/')).toBe('https://acme.atlassian.net')
  })

  it('adds https when missing', () => {
    expect(normalizeSiteUrl('acme.atlassian.net')).toBe('https://acme.atlassian.net')
  })
})
