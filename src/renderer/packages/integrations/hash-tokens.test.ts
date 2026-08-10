import { describe, expect, it } from 'vitest'
import {
  extractCredentialSlugsFromText,
  getActiveCredentialHashQuery,
  matchCredentialBySlug,
  replaceActiveCredentialHashWithToken,
  slugifyCredentialLabel,
  stripCredentialHashTokens,
} from './hash-tokens'

describe('hash-tokens', () => {
  it('slugifies labels', () => {
    expect(slugifyCredentialLabel('Work Jira')).toBe('work-jira')
    expect(slugifyCredentialLabel('  Personal Gmail!! ')).toBe('personal-gmail')
  })

  it('extracts #slugs not currency-like', () => {
    expect(extractCredentialSlugsFromText('use #work-jira and #personal')).toEqual(['work-jira', 'personal'])
  })

  it('strips tokens from text', () => {
    expect(stripCredentialHashTokens('check #work-jira please')).toBe('check please')
  })

  it('detects active # query', () => {
    expect(getActiveCredentialHashQuery('hello #wo')).toBe('wo')
    expect(getActiveCredentialHashQuery('hello #')).toBe('')
    expect(getActiveCredentialHashQuery('hello @agent')).toBe(null)
  })

  it('matches by label slug', () => {
    const acc = matchCredentialBySlug(
      [{ id: '1', label: 'Work Jira', connectorId: 'jira', connectorName: 'Jira' }],
      'work-jira'
    )
    expect(acc?.id).toBe('1')
  })

  it('replaces active partial with completed #token', () => {
    expect(replaceActiveCredentialHashWithToken('use #wo', 'work-jira')).toBe('use #work-jira ')
    expect(replaceActiveCredentialHashWithToken('#', 'Personal Gmail')).toBe('#personal-gmail ')
  })
})
