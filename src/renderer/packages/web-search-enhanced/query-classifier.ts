interface ClassificationResult {
  needsSearch: boolean
  category: 'time-sensitive' | 'factual' | 'current-events' | 'technical' | 'general' | 'none'
  confidence: number
}

const TIME_PATTERNS = [
  /\b(latest|newest|recent|current|today|yesterday|this week|this month|this year)\b/i,
  /\b(202[4-9]|203\d)\b/,
  /\b(right now|just now|breaking|update[ds]?)\b/i,
]

const FACTUAL_PATTERNS = [
  /\b(who is|who are|who was|what is|what are|what was)\b/i,
  /\b(how many|how much|how old|how long|how far)\b/i,
  /\b(when did|when was|when is|where is|where was)\b/i,
  /\b(define|definition of|meaning of)\b/i,
]

const CURRENT_EVENTS_PATTERNS = [
  /\b(news about|news on|headlines|announcement)\b/i,
  /\b(stock price|market|election|weather)\b/i,
  /\b(score|game|match|tournament|championship)\b/i,
  /\b(released|launched|announced|unveiled)\b/i,
]

const TECHNICAL_PATTERNS = [
  /\b(how to|how do I|tutorial|guide|example)\b/i,
  /\b(documentation|docs|api|sdk|library|framework)\b/i,
  /\b(error|bug|fix|issue|troubleshoot|debug)\b/i,
  /\b(install|setup|configure|deploy|migrate)\b/i,
]

/**
 * Lightweight query classifier for auto-search detection.
 * Uses keyword/pattern matching — no LLM calls.
 */
export function classifyQuery(query: string): ClassificationResult {
  const trimmed = query.trim()

  if (!trimmed || trimmed.length < 5) {
    return { needsSearch: false, category: 'none', confidence: 1.0 }
  }

  let bestCategory: ClassificationResult['category'] = 'none'
  let bestScore = 0

  // Check time-sensitive patterns (highest priority)
  const timeScore = countMatches(trimmed, TIME_PATTERNS)
  if (timeScore > bestScore) {
    bestScore = timeScore
    bestCategory = 'time-sensitive'
  }

  // Check current events
  const eventsScore = countMatches(trimmed, CURRENT_EVENTS_PATTERNS)
  if (eventsScore > bestScore) {
    bestScore = eventsScore
    bestCategory = 'current-events'
  }

  // Check factual lookups
  const factualScore = countMatches(trimmed, FACTUAL_PATTERNS)
  if (factualScore > bestScore) {
    bestScore = factualScore
    bestCategory = 'factual'
  }

  // Check technical queries
  const technicalScore = countMatches(trimmed, TECHNICAL_PATTERNS)
  if (technicalScore > bestScore) {
    bestScore = technicalScore
    bestCategory = 'technical'
  }

  if (bestScore === 0) {
    // Heuristic: questions are more likely to need search
    const isQuestion = /\?$/.test(trimmed) || /^(who|what|when|where|why|how|is|are|was|were|do|does|did|can|could|will|would|should)\b/i.test(trimmed)
    if (isQuestion) {
      return { needsSearch: true, category: 'general', confidence: 0.4 }
    }
    return { needsSearch: false, category: 'none', confidence: 0.8 }
  }

  const confidence = Math.min(0.5 + bestScore * 0.2, 0.95)
  return { needsSearch: true, category: bestCategory, confidence }
}

function countMatches(text: string, patterns: RegExp[]): number {
  let count = 0
  for (const pattern of patterns) {
    if (pattern.test(text)) {
      count++
    }
  }
  return count
}

/**
 * Quick check: should we auto-enable search for this query?
 * Returns true when confidence is above threshold.
 */
export function shouldAutoSearch(query: string, threshold = 0.5): boolean {
  const result = classifyQuery(query)
  return result.needsSearch && result.confidence >= threshold
}
