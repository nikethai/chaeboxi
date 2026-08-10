import { describe, expect, it } from 'vitest'
import { classifyQuotaError } from './classify-quota-error'

describe('classifyQuotaError', () => {
  it('detects token_quota_exhausted code', () => {
    expect(classifyQuotaError({ errorCode: 10004 }).kind).toBe('exhausted')
  })

  it('detects rate_limit_exceeded code', () => {
    expect(classifyQuotaError({ errorCode: 20005 }).kind).toBe('rate_limit')
  })

  it('detects insufficient_quota in body', () => {
    const r = classifyQuotaError({
      message: 'API Error',
      responseBody: JSON.stringify({ error: { code: 'insufficient_quota' } }),
    })
    expect(r.kind).toBe('exhausted')
  })

  it('treats 429 without quota language as rate_limit', () => {
    const r = classifyQuotaError({ status: 429, message: 'Too Many Requests' })
    expect(r.kind).toBe('rate_limit')
  })

  it('treats 429 with quota language as exhausted', () => {
    const r = classifyQuotaError({ status: 429, message: 'You exceeded your current quota' })
    expect(r.kind).toBe('exhausted')
  })

  it('returns none for unrelated errors', () => {
    expect(classifyQuotaError({ message: 'model not found' }).kind).toBe('none')
  })
})
