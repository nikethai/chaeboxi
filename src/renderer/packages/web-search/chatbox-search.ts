import WebSearch, { SearchResult } from './base'
import { webBrowsing } from '@/packages/remote'

export class ChatboxSearch extends WebSearch {
  private licenseKey: string

  constructor(licenseKey: string) {
    super()
    this.licenseKey = licenseKey
  }

  async search(query: string): Promise<SearchResult> {
    if (this.licenseKey) {
      const res = await webBrowsing({
        licenseKey: this.licenseKey,
        query,
      })

      return {
        items: res.links.map((link) => ({
          title: link.title,
          link: link.url,
          abstract: link.content,
        })),
      }
    } else {
      return {
        items: [],
      }
    }
  }
}
