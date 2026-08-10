import { tool } from 'ai'
import z from 'zod'
import * as remote from '@/packages/remote'
import {
  formatVideoUrlAttachmentContent,
  isSupportedVideoUrl,
  readVideoUrl,
  videoUrlAttachmentTitle,
} from '@/packages/video-url'
import { webSearchExecutor } from '@/packages/web-search'

const toolSetDescription = `
Use these tools to search the web and extract content from URLs.

## web_search
Search the web for current information. Use short, concise queries (English preferred).

## parse_link
Extract readable content from a normal webpage URL.
Do NOT use parse_link for YouTube, Vimeo, TikTok, or Facebook video links — use read_video_url instead.
`

export const webSearchTool = tool({
  description:
    'Search the web for current events and real-time information. Use short, concise queries (English preferred). Prefer includeDomains when the user requests specific sites.',
  inputSchema: z.object({
    query: z.string().describe('the search query'),
    includeDomains: z
      .array(z.string())
      .optional()
      .describe('Optional list of domains to include, e.g. ["danbooru.donmai.us", "pixiv.net"].'),
    excludeDomains: z.array(z.string()).optional().describe('Optional list of domains to exclude from results.'),
    maxResults: z.number().int().min(1).max(10).optional().describe('Optional maximum number of results to return.'),
  }),
  execute: async (
    input: { query: string; includeDomains?: string[]; excludeDomains?: string[]; maxResults?: number },
    { abortSignal }: { abortSignal?: AbortSignal } = {}
  ) => {
    return await webSearchExecutor(input, { abortSignal })
  },
})

const DEFAULT_PARSE_LINK_MAX_CHARS = 12_000

export const parseLinkTool = tool({
  description:
    'Parse readable content from a normal webpage. For YouTube/Vimeo/TikTok/Facebook video URLs, use read_video_url instead (this tool will auto-route video links if misused).',
  inputSchema: z.object({
    url: z.string().url().describe('The URL to parse. Always include the schema, e.g. https://example.com'),
    maxLength: z
      .number()
      .int()
      .min(500)
      .max(50_000)
      .optional()
      .describe('Optional maximum number of characters to return from the parsed content.'),
  }),
  execute: async (input: { url: string; maxLength?: number }, { abortSignal }: { abortSignal?: AbortSignal } = {}) => {
    const maxLength = input.maxLength ?? DEFAULT_PARSE_LINK_MAX_CHARS
    const normalizedMaxLength = Math.min(Math.max(maxLength, 500), 50_000)

    // Video platforms: route to local video-url reader (cloud link parser is disabled
    // and cannot extract captions from players).
    if (isSupportedVideoUrl(input.url)) {
      const result = await readVideoUrl({
        url: input.url,
        mode: 'auto',
        maxChars: normalizedMaxLength,
        abortSignal,
      })
      const content = formatVideoUrlAttachmentContent(result).slice(0, normalizedMaxLength)
      return {
        url: input.url,
        title: videoUrlAttachmentTitle(result, input.url),
        content,
        originalLength: content.length,
        truncated: Boolean(result.truncated),
        routedTo: 'read_video_url',
        platform: result.platform,
        transcriptSource: result.transcript?.source,
        errorCode: result.errorCode,
        warnings: result.warnings,
      }
    }

    const parsed = await remote.parseUserLinkFree({ url: input.url })
    const content = (parsed.text || '').trim()
    const truncatedContent = content.slice(0, normalizedMaxLength)

    return {
      url: input.url,
      title: parsed.title || input.url,
      content: truncatedContent,
      originalLength: content.length,
      truncated: content.length > truncatedContent.length,
    }
  },
})

export default {
  description: toolSetDescription,
  tools: {
    web_search: webSearchTool,
    parse_link: parseLinkTool,
  },
}
