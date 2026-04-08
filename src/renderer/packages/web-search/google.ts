import type { SearchResult } from '@shared/types'
import WebSearch, { type WebSearchOptions } from './base'

interface GoogleSearchItem {
  title?: string
  link?: string
  snippet?: string
}

interface GoogleSearchResponse {
  items?: GoogleSearchItem[]
}

export class GoogleSearch extends WebSearch {
  private readonly GOOGLE_SEARCH_URL = 'https://customsearch.googleapis.com/customsearch/v1'
  private readonly apiKey: string
  private readonly cseId: string

  constructor(apiKey: string, cseId: string) {
    super()
    this.apiKey = apiKey
    this.cseId = cseId
  }

  async search(query: string, options?: WebSearchOptions, signal?: AbortSignal): Promise<SearchResult> {
    try {
      const useNativeIncludeDomain = options?.includeDomains?.length === 1 && !options?.excludeDomains?.length
      const response = (await this.fetch(this.GOOGLE_SEARCH_URL, {
        method: 'GET',
        query: {
          q: useNativeIncludeDomain ? query : this.applyQueryFilters(query, options),
          key: this.apiKey,
          cx: this.cseId,
          num: Math.min(options?.maxResults || 10, 10),
          ...(useNativeIncludeDomain
            ? {
                siteSearch: options?.includeDomains?.[0],
                siteSearchFilter: 'i',
              }
            : {}),
        },
        signal,
      })) as GoogleSearchResponse

      const items = this.finalizeItems(
        (response.items || []).map((item) => ({
          title: item.title || '',
          link: item.link || '',
          snippet: item.snippet || '',
        })),
        options
      )

      return { items }
    } catch (error) {
      console.error('Google search error:', error)
      return { items: [] }
    }
  }
}
