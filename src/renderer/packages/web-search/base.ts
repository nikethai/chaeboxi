import { CapacitorHttp } from '@capacitor/core'
import type { SearchResult } from '@shared/types'
import { type FetchOptions, ofetch } from 'ofetch'
import { isCapacitorMobile } from '@/platform'

export interface WebSearchOptions {
  includeDomains?: string[]
  excludeDomains?: string[]
  maxResults?: number
}

abstract class WebSearch {
  abstract search(query: string, options?: WebSearchOptions, signal?: AbortSignal): Promise<SearchResult>

  protected applyQueryFilters(query: string, options?: WebSearchOptions): string {
    let nextQuery = query.trim()

    if (options?.includeDomains?.length) {
      const includeClause = options.includeDomains.map((domain) => `site:${domain}`).join(' OR ')
      nextQuery = `${nextQuery} (${includeClause})`
    }

    if (options?.excludeDomains?.length) {
      const excludeClause = options.excludeDomains.map((domain) => `-site:${domain}`).join(' ')
      nextQuery = `${nextQuery} ${excludeClause}`
    }

    return nextQuery.trim()
  }

  protected finalizeItems<T extends { link?: string }>(items: T[], options?: WebSearchOptions): T[] {
    let filtered = items

    if (options?.includeDomains?.length) {
      filtered = filtered.filter((item) => this.matchesAnyDomain(item.link, options.includeDomains))
    }

    if (options?.excludeDomains?.length) {
      filtered = filtered.filter((item) => !this.matchesAnyDomain(item.link, options.excludeDomains))
    }

    if (options?.maxResults && options.maxResults > 0) {
      filtered = filtered.slice(0, options.maxResults)
    }

    return filtered
  }

  private matchesAnyDomain(link: string | undefined, domains: string[]): boolean {
    if (!link) return false

    try {
      const hostname = new URL(link).hostname.toLowerCase()
      return domains.some((domain) => {
        const normalizedDomain = domain.trim().toLowerCase()
        return hostname === normalizedDomain || hostname.endsWith(`.${normalizedDomain}`)
      })
    } catch {
      return false
    }
  }

  async fetch(url: string, options: FetchOptions) {
    const { origin } = new URL(url)
    if (isCapacitorMobile) {
      const { data } = await CapacitorHttp.request({
        url,
        method: options.method,
        headers: {
          ...(options.headers || ({} as any)),
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3',
          origin,
          referer: origin,
        },
        params: options.query,
        data: options.body,
      })

      return data
    } else {
      return ofetch(url, options)
    }
  }
}

export default WebSearch
