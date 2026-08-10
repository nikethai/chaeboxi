/**
 * Map provider errors / response bodies to quota-related classifications.
 */

export type QuotaErrorKind = 'exhausted' | 'rate_limit' | 'none'

export type ClassifiedQuotaError = {
  kind: QuotaErrorKind
  confidence: 'high' | 'medium' | 'low'
  detail?: string
}

const EXHAUSTED_PATTERNS: RegExp[] = [
  /quota.?exceeded/i,
  /insufficient.?quota/i,
  /token.?quota/i,
  /billing.?hard.?limit/i,
  /exceeded.?your.?current.?quota/i,
  /you.?have.?exceeded.?your/i,
  /usage.?limit.?reached/i,
  /plan.?limit/i,
  /credit.?balance.?is.?too.?low/i,
  /out.?of.?credits/i,
  /monthly.?limit/i,
  /subscription.?limit/i,
  /resource.?exhausted/i,
  /quota.?exhausted/i,
  /no.?remaining.?quota/i,
  /limit.?on.?usage/i,
]

const RATE_LIMIT_PATTERNS: RegExp[] = [
  /rate.?limit/i,
  /too.?many.?requests/i,
  /requests.?per.?min/i,
  /tpm|rpm/i,
  /slow.?down/i,
  /try.?again.?later/i,
]

export function classifyQuotaError(input: {
  message?: string | null
  responseBody?: string | null
  status?: number | null
  errorCode?: number | null
}): ClassifiedQuotaError {
  const text = [input.message, input.responseBody].filter(Boolean).join('\n')
  const lower = text.toLowerCase()

  // ChatboxAI / shared error codes
  if (input.errorCode === 10004) {
    return { kind: 'exhausted', confidence: 'high', detail: 'token_quota_exhausted' }
  }
  if (input.errorCode === 20005) {
    return { kind: 'rate_limit', confidence: 'high', detail: 'rate_limit_exceeded' }
  }

  if (input.status === 429) {
    // 429 can be either rate limit or quota — prefer exhausted when body says so
    if (EXHAUSTED_PATTERNS.some((re) => re.test(text))) {
      return { kind: 'exhausted', confidence: 'high', detail: text.slice(0, 200) }
    }
    return { kind: 'rate_limit', confidence: 'medium', detail: text.slice(0, 200) || 'HTTP 429' }
  }

  if (input.status === 402 || input.status === 403) {
    if (EXHAUSTED_PATTERNS.some((re) => re.test(text))) {
      return { kind: 'exhausted', confidence: 'high', detail: text.slice(0, 200) }
    }
  }

  for (const re of EXHAUSTED_PATTERNS) {
    if (re.test(text)) {
      return { kind: 'exhausted', confidence: 'high', detail: text.slice(0, 200) }
    }
  }

  for (const re of RATE_LIMIT_PATTERNS) {
    if (re.test(text)) {
      // Avoid false positive on empty "tpm" alone in unrelated text
      if (re.source === 'tpm|rpm' && !/\b(tpm|rpm)\b/i.test(lower)) continue
      return { kind: 'rate_limit', confidence: 'medium', detail: text.slice(0, 200) }
    }
  }

  return { kind: 'none', confidence: 'low' }
}
