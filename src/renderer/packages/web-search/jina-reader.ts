import { ofetch } from 'ofetch'

export async function scrapePage(url: string, signal?: AbortSignal): Promise<string> {
  return await ofetch(`https://r.jina.ai/${url}`, {
    headers: {
      Accept: 'text/markdown',
    },
    responseType: 'text',
    signal,
  })
}
