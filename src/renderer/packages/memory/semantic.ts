import { tokenizeForIndex } from './query-index'

/**
 * Local semantic layer (S5) without external embedding APIs.
 * Feature-hashed token bag → dense-ish vector; cosine for paraphrase-ish match.
 * Real model embeddings can later replace buildVector / store without changing fusion API.
 */

const DIM = 64

export type SemanticVectors = Map<string, Float32Array>

function hashToken(token: string): number {
  let h = 2166136261
  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Feature-hashed bag-of-tokens vector (unit-normalized). */
export function buildTokenVector(text: string): Float32Array {
  const vec = new Float32Array(DIM)
  const tokens = tokenizeForIndex(text)
  if (!tokens.length) return vec
  for (const t of tokens) {
    const h = hashToken(t)
    const idx = h % DIM
    const sign = h & 1 ? 1 : -1
    vec[idx] += sign
    // bigram-ish: mix adjacent char for slight fuzzy
    if (t.length >= 4) {
      const h2 = hashToken(t.slice(0, 4))
      vec[h2 % DIM] += 0.5 * (h2 & 1 ? 1 : -1)
    }
  }
  let norm = 0
  for (let i = 0; i < DIM; i++) norm += vec[i] * vec[i]
  norm = Math.sqrt(norm) || 1
  for (let i = 0; i < DIM; i++) vec[i] /= norm
  return vec
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let s = 0
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) s += a[i] * b[i]
  return s
}

export function buildSemanticVectors(
  entries: { id: string; content: string; tags?: string[] }[]
): SemanticVectors {
  const map: SemanticVectors = new Map()
  for (const e of entries) {
    map.set(e.id, buildTokenVector(`${e.content} ${(e.tags ?? []).join(' ')}`))
  }
  return map
}

/**
 * Semantic boost 0..1-ish from query tokens vs stored entry vector.
 */
export function semanticBoost(
  entryId: string,
  queryTokens: string[],
  vectors: SemanticVectors
): number {
  if (!queryTokens.length) return 0
  const entryVec = vectors.get(entryId)
  if (!entryVec) return 0
  const qVec = buildTokenVector(queryTokens.join(' '))
  const sim = cosineSimilarity(qVec, entryVec)
  // map cosine [-1,1] roughly to [0,1] useful boost
  return Math.max(0, sim)
}

/** Rebuild vectors for a bank's entries. */
export function rebuildSemanticForBank(
  entries: { id: string; content: string; tags?: string[] }[]
): SemanticVectors {
  return buildSemanticVectors(entries)
}
