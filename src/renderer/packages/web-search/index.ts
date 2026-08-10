import { cachified } from '@epic-web/cachified'
import type { SearchResultItem } from '@shared/types'
import { truncate } from 'lodash'
import { getExtensionSettings, getLanguage } from '@/stores/settingActions'
import { ProviderAPIError } from '../../../shared/models/errors'
import type WebSearch from './base'
import { BingSearch } from './bing'
import { BingNewsSearch } from './bing-news'
import type { WebSearchOptions } from './base'
import { DuckDuckGoSearch } from './duckduckgo'
import { ExaSearch } from './exa'
import { GoogleSearch } from './google'
import { scrapePage } from './jina-reader'
import { SerperSearch } from './serper'
import { TavilySearch } from './tavily'

const MAX_CONTEXT_ITEMS = 10
const SCRAPE_RESULT_COUNT = 3

// (legacy comment removed)
function getSearchProviders() {
  const settings = getExtensionSettings()

  const selectedProviders: WebSearch[] = []
  const provider = settings.webSearch.provider
  const language = getLanguage()
  const addBingProviders = () => {
    selectedProviders.push(new BingSearch())
    if (language !== 'zh-Hans') {
      selectedProviders.push(new BingNewsSearch()) // (legacy)
    }
  }

  switch (provider) {
    case 'build-in':
      // Paid first-party search is disabled in this build.
      // Fallback to free Bing search for legacy settings values.
      addBingProviders()
      break
    case 'bing':
      addBingProviders()
      break
    case 'duckduckgo':
      selectedProviders.push(new DuckDuckGoSearch())
      break
    case 'serper':
      if (!settings.webSearch.serperApiKey?.trim()) {
        throw ProviderAPIError.fromCodeName('serper_api_key_required', 'serper_api_key_required')
      }
      selectedProviders.push(new SerperSearch(settings.webSearch.serperApiKey.trim()))
      break
    case 'google':
      if (!settings.webSearch.googleApiKey?.trim() || !settings.webSearch.googleCseId?.trim()) {
        throw ProviderAPIError.fromCodeName('google_search_credentials_required', 'google_search_credentials_required')
      }
      selectedProviders.push(
        new GoogleSearch(settings.webSearch.googleApiKey.trim(), settings.webSearch.googleCseId.trim())
      )
      break
    case 'tavily':
      if (!settings.webSearch.tavilyApiKey?.trim()) {
        throw ProviderAPIError.fromCodeName('tavily_api_key_required', 'tavily_api_key_required')
      }
      selectedProviders.push(
        new TavilySearch(
          settings.webSearch.tavilyApiKey.trim(),
          settings.webSearch.tavilySearchDepth,
          settings.webSearch.tavilyMaxResults,
          settings.webSearch.tavilyTimeRange,
          settings.webSearch.tavilyIncludeRawContent
        )
      )
      break
    case 'exa':
      if (!settings.webSearch.exaApiKey?.trim()) {
        throw ProviderAPIError.fromCodeName('exa_api_key_required', 'exa_api_key_required')
      }
      selectedProviders.push(new ExaSearch(settings.webSearch.exaApiKey.trim()))
      break
    default:
      throw new Error(`Unsupported search provider: ${provider}`)
  }

  return selectedProviders
}

async function _searchRelatedResults(query: string, options?: WebSearchOptions, signal?: AbortSignal) {
  const settings = getExtensionSettings()
  const providers = getSearchProviders()
  const resultLimit = Math.min(options?.maxResults || MAX_CONTEXT_ITEMS, MAX_CONTEXT_ITEMS)
  const results = await Promise.all(
    providers.map(async (provider) => {
      try {
        const result = await provider.search(query, options, signal)
        console.debug(`web search result for "${query}":`, result.items)
        return result
      } catch (err) {
        console.error(err)
        return { items: [] }
      }
    })
  )

  const items: SearchResultItem[] = []

  // add items in turn
  let i = 0
  let hasMore = false
  do {
    hasMore = false
    for (const result of results) {
      const item = result.items[i]
      if (item) {
        hasMore = true
        items.push(item)
      } else {
      }
    }
    i++
  } while (hasMore && items.length < resultLimit)

  console.debug('web search items', items)

  const normalizedItems = items.map((item) => ({
    title: item.title,
    snippet: truncate(item.snippet, { length: 150 }),
    link: item.link,
    rawContent: item.rawContent,
  }))

  if (settings.webSearch.scrapeTopResults) {
    await Promise.all(
      normalizedItems.slice(0, SCRAPE_RESULT_COUNT).map(async (item) => {
        if (item.rawContent || !item.link) {
          return
        }

        try {
          item.rawContent = await scrapePage(item.link, signal)
        } catch (error) {
          console.debug(`Failed to scrape ${item.link} with Jina Reader`, error)
        }
      })
    )
  }

  return normalizedItems
}

const cache = new Map()

export const webSearchExecutor = async (
  {
    query,
    includeDomains,
    excludeDomains,
    maxResults,
  }: { query: string; includeDomains?: string[]; excludeDomains?: string[]; maxResults?: number },
  { abortSignal }: { abortSignal?: AbortSignal }
) => {
  const { webSearch } = getExtensionSettings()
  const options = {
    includeDomains,
    excludeDomains,
    maxResults,
  }
  const cacheSettings = {
    provider: webSearch.provider,
    tavilySearchDepth: webSearch.tavilySearchDepth,
    tavilyMaxResults: webSearch.tavilyMaxResults,
    tavilyTimeRange: webSearch.tavilyTimeRange,
    tavilyIncludeRawContent: webSearch.tavilyIncludeRawContent,
    scrapeTopResults: webSearch.scrapeTopResults,
    includeDomains: includeDomains ? [...includeDomains].sort() : undefined,
    excludeDomains: excludeDomains ? [...excludeDomains].sort() : undefined,
    maxResults,
  }
  const searchResults = await cachified({
    cache,
    key: `search-context:${query}:${JSON.stringify(cacheSettings)}`,
    ttl: 1000 * 60 * 5,
    getFreshValue: () => _searchRelatedResults(query, options, abortSignal),
  })
  return { query, searchResults, includeDomains, excludeDomains, maxResults }
}

export type { SearchResultItem }
