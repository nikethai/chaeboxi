import { describe, expect, it, vi } from 'vitest'

vi.mock('@/platform', () => ({
  default: {
    type: 'web',
  },
}))

import { BingSearch } from './bing'
import { GoogleSearch } from './google'

describe('web search providers', () => {
  it('uses native siteSearch for Google when a single include domain is provided', async () => {
    const provider = new GoogleSearch('api-key', 'cse-id')
    const fetchMock = vi.spyOn(provider, 'fetch').mockResolvedValue({
      items: [
        {
          title: 'Pixiv result',
          link: 'https://www.pixiv.net/en/artworks/123',
          snippet: 'pixiv snippet',
        },
        {
          title: 'Other result',
          link: 'https://example.com/post',
          snippet: 'other snippet',
        },
      ],
    })

    const result = await provider.search('trending anime art', {
      includeDomains: ['pixiv.net'],
      maxResults: 5,
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://customsearch.googleapis.com/customsearch/v1',
      expect.objectContaining({
        query: expect.objectContaining({
          q: 'trending anime art',
          siteSearch: 'pixiv.net',
          siteSearchFilter: 'i',
          num: 5,
        }),
      })
    )
    expect(result.items).toEqual([
      {
        title: 'Pixiv result',
        link: 'https://www.pixiv.net/en/artworks/123',
        snippet: 'pixiv snippet',
      },
    ])
  })

  it('falls back to site: query rewriting for Bing and filters the results', async () => {
    const provider = new BingSearch()
    const fetchMock = vi.spyOn(provider, 'fetch').mockResolvedValue('<html></html>')
    ;(provider as any).extractItems = vi.fn(() => [
      {
        title: 'Danbooru result',
        link: 'https://danbooru.donmai.us/posts/1',
        snippet: 'danbooru snippet',
      },
      {
        title: 'Excluded result',
        link: 'https://example.com/post',
        snippet: 'example snippet',
      },
    ])

    const result = await provider.search('best anime style', {
      includeDomains: ['danbooru.donmai.us', 'pixiv.net'],
      excludeDomains: ['example.com'],
      maxResults: 2,
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://www.bing.com/search',
      expect.objectContaining({
        query: expect.objectContaining({
          q: expect.stringContaining('(site:danbooru.donmai.us OR site:pixiv.net)'),
        }),
      })
    )
    expect(fetchMock).toHaveBeenCalledWith(
      'https://www.bing.com/search',
      expect.objectContaining({
        query: expect.objectContaining({
          q: expect.stringContaining('-site:example.com'),
        }),
      })
    )
    expect(result.items).toEqual([
      {
        title: 'Danbooru result',
        link: 'https://danbooru.donmai.us/posts/1',
        snippet: 'danbooru snippet',
      },
    ])
  })
})
