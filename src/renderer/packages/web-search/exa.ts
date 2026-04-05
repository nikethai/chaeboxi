import type { SearchResult } from '@shared/types'
import WebSearch from './base'

interface ExaResultItem {
  title?: string
  url?: string
  text?: string
}

interface ExaResponse {
  results?: ExaResultItem[]
}

export class ExaSearch extends WebSearch {
  private readonly EXA_SEARCH_URL = 'https://api.exa.ai/search'

  constructor(private readonly apiKey: string) {
    super()
  }

  async search(query: string, signal?: AbortSignal): Promise<SearchResult> {
    try {
      const response = (await this.fetch(this.EXA_SEARCH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
        },
        body: {
          query,
          type: 'neural',
          useAutoprompt: true,
          numResults: 8,
          contents: {
            text: {
              maxCharacters: 2000,
            },
          },
        },
        signal,
      })) as ExaResponse

      return {
        items: (response.results || [])
          .filter((result) => Boolean(result.url))
          .map((result) => ({
            title: result.title || result.url || '',
            link: result.url || '',
            snippet: result.text || '',
            rawContent: result.text || null,
          })),
      }
    } catch (error) {
      console.error('Exa search error:', error)
      return { items: [] }
    }
  }
}
