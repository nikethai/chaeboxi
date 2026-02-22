import type { SearchResult } from '@shared/types'
import WebSearch from './base'

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

  async search(query: string, signal?: AbortSignal): Promise<SearchResult> {
    try {
      const response = (await this.fetch(this.GOOGLE_SEARCH_URL, {
        method: 'GET',
        query: {
          q: query,
          key: this.apiKey,
          cx: this.cseId,
          num: 10,
        },
        signal,
      })) as GoogleSearchResponse

      const items = (response.items || []).map((item) => ({
        title: item.title || '',
        link: item.link || '',
        snippet: item.snippet || '',
      }))

      return { items }
    } catch (error) {
      console.error('Google search error:', error)
      return { items: [] }
    }
  }
}
