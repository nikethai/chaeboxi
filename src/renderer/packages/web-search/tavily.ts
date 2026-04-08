import type { SearchResult } from '@shared/types'
import { ofetch } from 'ofetch'
import WebSearch, { type WebSearchOptions } from './base'

export class TavilySearch extends WebSearch {
  private readonly TAVILY_SEARCH_URL = 'https://api.tavily.com/search'

  private apiKey: string
  private searchDepth: string
  private maxResults: number
  private timeRange: string | null
  private includeRawContent: string | null

  constructor(
    apiKey: string,
    searchDepth: string = 'basic',
    maxResults: number = 5,
    timeRange: string | null = null,
    includeRawContent: string | null = null
  ) {
    super()
    this.apiKey = apiKey
    this.searchDepth = searchDepth
    this.maxResults = maxResults
    this.timeRange = timeRange === 'none' ? null : timeRange
    this.includeRawContent = includeRawContent === 'none' ? null : includeRawContent
  }

  async search(query: string, options?: WebSearchOptions, signal?: AbortSignal): Promise<SearchResult> {
    try {
      const requestBody = this.buildRequestBody(query, options)
      const response = await ofetch(this.TAVILY_SEARCH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: requestBody,
        signal,
      })

      // Tavily handles include/exclude domains natively via the API —
      // only apply maxResults slicing as a safety net.
      const maxResultsOnly: WebSearchOptions | undefined = options?.maxResults
        ? { maxResults: options.maxResults }
        : undefined
      const items = this.finalizeItems(
        (response.results || []).map((result: any) => ({
          title: result.title,
          link: result.url,
          snippet: result.content,
          rawContent: result.raw_content,
        })),
        maxResultsOnly
      )

      return { items }
    } catch (error) {
      console.error('Tavily search error:', error)
      return { items: [] }
    }
  }

  private buildRequestBody(query: string, options?: WebSearchOptions): any {
    const requestBody: any = {
      query,
      search_depth: this.searchDepth,
      max_results: options?.maxResults || this.maxResults,
      include_domains: options?.includeDomains || [],
      exclude_domains: options?.excludeDomains || [],
    }

    if (!this.isNullOrNone(this.timeRange)) {
      requestBody.time_range = this.timeRange
    }

    if (!this.isNullOrNone(this.includeRawContent)) {
      requestBody.include_raw_content = this.includeRawContent
    }

    return requestBody
  }

  private isNullOrNone(value: string | null): boolean {
    return value === null || value === 'none'
  }
}
