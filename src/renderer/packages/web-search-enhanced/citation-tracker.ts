import type { GroundingMetadata, SearchCitation, SearchResultItem } from '@shared/types'
import { groundingMetadataToCitations, searchResultsToCitations } from '@shared/utils/search'

/**
 * Unified citation tracking across all search sources.
 * Normalizes citations from built-in search, Gemini grounding,
 * OpenClaw agent results, and MCP tools into SearchCitation[].
 */
export class CitationTracker {
  private citations: Map<string, SearchCitation> = new Map()
  private nextIndex = 1

  addFromSearchResults(results: SearchResultItem[], source: SearchCitation['source'] = 'builtin'): void {
    const newCitations = searchResultsToCitations(results, source)
    for (const citation of newCitations) {
      const key = citation.url
      if (!this.citations.has(key)) {
        this.citations.set(key, { ...citation, index: this.nextIndex++ })
      }
    }
  }

  addFromGrounding(metadata: GroundingMetadata): void {
    const newCitations = groundingMetadataToCitations(metadata)
    for (const citation of newCitations) {
      const key = citation.url
      if (!this.citations.has(key)) {
        this.citations.set(key, { ...citation, index: this.nextIndex++ })
      }
    }
  }

  addFromMCP(results: Array<{ url: string; title?: string; snippet?: string }>): void {
    for (const result of results) {
      if (!result.url || this.citations.has(result.url)) {
        continue
      }
      this.citations.set(result.url, {
        index: this.nextIndex++,
        url: result.url,
        title: result.title ?? result.url,
        snippet: result.snippet,
        source: 'mcp',
        accessedAt: Date.now(),
      })
    }
  }

  addFromOpenClaw(results: Array<{ url: string; title?: string; snippet?: string }>): void {
    for (const result of results) {
      if (!result.url || this.citations.has(result.url)) {
        continue
      }
      this.citations.set(result.url, {
        index: this.nextIndex++,
        url: result.url,
        title: result.title ?? result.url,
        snippet: result.snippet,
        source: 'openclaw',
        accessedAt: Date.now(),
      })
    }
  }

  /**
   * Inject [N] markers into text based on citation URLs found in the text.
   * Useful for annotating model output that mentions source URLs without markers.
   */
  annotateText(text: string): string {
    if (/\[\d+\]/.test(text)) {
      return text // Already annotated
    }
    let result = text
    for (const [url, citation] of this.citations) {
      const urlIndex = result.indexOf(url)
      if (urlIndex !== -1) {
        const insertAt = urlIndex + url.length
        result = `${result.slice(0, insertAt)} [${citation.index}]${result.slice(insertAt)}`
      }
    }
    return result
  }

  getCitations(): SearchCitation[] {
    return Array.from(this.citations.values()).sort((a, b) => a.index - b.index)
  }

  getCitationByIndex(index: number): SearchCitation | undefined {
    for (const citation of this.citations.values()) {
      if (citation.index === index) {
        return citation
      }
    }
    return undefined
  }

  get count(): number {
    return this.citations.size
  }

  clear(): void {
    this.citations.clear()
    this.nextIndex = 1
  }
}
