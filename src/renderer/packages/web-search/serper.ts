import type { SearchResult } from '@shared/types'
import WebSearch, { type WebSearchOptions } from './base'

interface SerperResultItem {
  title?: string
  link?: string
  snippet?: string
}

interface SerperResponse {
  organic?: SerperResultItem[]
  news?: SerperResultItem[]
}

export class SerperSearch extends WebSearch {
  private readonly SERPER_SEARCH_URL = 'https://google.serper.dev/search'
  private readonly apiKey: string

  constructor(apiKey: string) {
    super()
    this.apiKey = apiKey
  }

  async search(query: string, options?: WebSearchOptions, signal?: AbortSignal): Promise<SearchResult> {
    try {
      const response = (await this.fetch(this.SERPER_SEARCH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': this.apiKey,
        },
        body: {
          q: this.applyQueryFilters(query, options),
          num: Math.min(options?.maxResults || 10, 10),
        },
        signal,
      })) as SerperResponse

      const items = this.finalizeItems(this.extractItems(response), options)
      return { items }
    } catch (error) {
      console.error('Serper search error:', error)
      return { items: [] }
    }
  }

  private extractItems(response: SerperResponse) {
    const mergedItems = [...(response.organic || []), ...(response.news || [])]
    return mergedItems
      .filter((item) => Boolean(item.title && item.link))
      .slice(0, 10)
      .map((item) => ({
        title: item.title || '',
        link: item.link || '',
        snippet: item.snippet || '',
      }))
  }
}
