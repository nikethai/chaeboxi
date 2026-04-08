import type { SearchResult } from '@shared/types'
import WebSearch, { type WebSearchOptions } from './base'

export class BingSearch extends WebSearch {
  async search(query: string, options?: WebSearchOptions, signal?: AbortSignal): Promise<SearchResult> {
    const html = await this.fetchSerp(this.applyQueryFilters(query, options), signal)
    const items = this.finalizeItems(this.extractItems(html), options)
    return { items }
  }

  private async fetchSerp(query: string, signal?: AbortSignal) {
    const html = await this.fetch('https://www.bing.com/search', {
      method: 'GET',
      query: { q: query },
      signal,
    })
    return html as string
  }

  private extractItems(html: string) {
    // TODO: .zci-wrapper
    const dom = new DOMParser().parseFromString(html, 'text/html')
    const nodes = dom.querySelectorAll('#b_results>li.b_algo')
    return Array.from(nodes)
      .slice(0, 10)
      .map((node) => {
        const nodeA = node.querySelector('h2>a')!
        const link = nodeA.getAttribute('href')!
        const title = nodeA.textContent || ''
        const nodeAbstract = node.querySelector('p[class^="b_lineclamp"]')
        const snippet = nodeAbstract?.textContent || ''
        return { title, link, snippet }
      })
  }
}
