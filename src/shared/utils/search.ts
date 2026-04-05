import type { GroundingMetadata, SearchCitation, SearchResultItem } from '../types'

function getGroundingChunkCitationIndexMap(groundingMetadata: GroundingMetadata): Map<number, number> {
  const citationIndexMap = new Map<number, number>()
  let nextCitationIndex = 1

  for (const [chunkIndex, chunk] of (groundingMetadata.groundingChunks || []).entries()) {
    if (!chunk.web?.uri) {
      continue
    }

    citationIndexMap.set(chunkIndex, nextCitationIndex)
    nextCitationIndex += 1
  }

  return citationIndexMap
}

export function getFaviconUrl(url: string): string | undefined {
  try {
    const hostname = new URL(url).hostname
    if (!hostname) {
      return undefined
    }

    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`
  } catch {
    return undefined
  }
}

export function searchResultsToCitations(
  searchResults: SearchResultItem[],
  source: SearchCitation['source'] = 'builtin',
  accessedAt: number = Date.now()
): SearchCitation[] {
  return searchResults
    .filter((result) => Boolean(result.link))
    .map((result, index) => ({
      index: index + 1,
      url: result.link,
      title: result.title || result.link,
      snippet: result.snippet || undefined,
      favicon: getFaviconUrl(result.link),
      source,
      accessedAt,
    }))
}

export function groundingMetadataToCitations(
  groundingMetadata: GroundingMetadata,
  accessedAt: number = Date.now()
): SearchCitation[] {
  const citationIndexMap = getGroundingChunkCitationIndexMap(groundingMetadata)
  const relevanceScores = new Map<number, number>()

  for (const support of groundingMetadata.groundingSupports || []) {
    const chunkIndices = support.groundingChunkIndices || []
    const confidenceScores = support.confidenceScores || []

    chunkIndices.forEach((chunkIndex, offset) => {
      const citationIndex = citationIndexMap.get(chunkIndex)
      if (!citationIndex) {
        return
      }

      const nextScore = confidenceScores[offset]
      const currentScore = relevanceScores.get(citationIndex) ?? 0

      if (typeof nextScore === 'number' && nextScore > currentScore) {
        relevanceScores.set(citationIndex, nextScore)
      }
    })
  }

  return (groundingMetadata.groundingChunks || []).flatMap((chunk, chunkIndex) => {
    const citationIndex = citationIndexMap.get(chunkIndex)
    if (!citationIndex || !chunk.web?.uri) {
      return []
    }

    return [
      {
        index: citationIndex,
        url: chunk.web.uri,
        title: chunk.web.title || chunk.web.uri,
        favicon: getFaviconUrl(chunk.web.uri),
        source: 'gemini-grounding' as const,
        accessedAt,
        relevanceScore: relevanceScores.get(citationIndex),
      },
    ]
  })
}

export function annotateTextWithGrounding(text: string, groundingMetadata?: GroundingMetadata | null): string {
  if (!groundingMetadata || !groundingMetadata.groundingSupports?.length || /\[\d+\]/.test(text)) {
    return text
  }

  const citationIndexMap = getGroundingChunkCitationIndexMap(groundingMetadata)
  const markersByEndIndex = new Map<number, number[]>()

  for (const support of groundingMetadata.groundingSupports) {
    const endIndex = support.segment?.endIndex
    if (typeof endIndex !== 'number') {
      continue
    }

    const citationIndices = Array.from(
      new Set(
        (support.groundingChunkIndices || [])
          .map((chunkIndex) => citationIndexMap.get(chunkIndex))
          .filter((citationIndex): citationIndex is number => typeof citationIndex === 'number')
      )
    ).sort((a, b) => a - b)

    if (citationIndices.length === 0) {
      continue
    }

    markersByEndIndex.set(endIndex, citationIndices)
  }

  if (markersByEndIndex.size === 0) {
    return text
  }

  let annotatedText = text
  const insertions = Array.from(markersByEndIndex.entries()).sort((a, b) => b[0] - a[0])

  for (const [endIndex, citationIndices] of insertions) {
    if (endIndex < 0 || endIndex > annotatedText.length) {
      continue
    }

    const markerText = ` ${citationIndices.map((citationIndex) => `[${citationIndex}]`).join('')}`
    annotatedText = `${annotatedText.slice(0, endIndex)}${markerText}${annotatedText.slice(endIndex)}`
  }

  return annotatedText
}
