import { tool } from 'ai'
import { last } from 'lodash'
import type { Message } from 'src/shared/types'
import { z } from 'zod'
import * as promptFormat from '@/packages/prompts'
import platform from '@/platform'
import * as settingActions from '@/stores/settingActions'
import { getMessageText, sequenceMessages } from '@/utils/message'
import type { ModelInterface } from '../../../shared/models/types'
import { webSearchExecutor } from '../web-search'
import { generateText } from '.'

export const webSearchTool = tool({
  description:
    'a search engine. useful for when you need to answer questions about current events. input should be a search query. prefer English query. query should be short and concise',
  parameters: z.object({
    query: z.string().describe('the search query'),
  }),
  execute: async (args, { abortSignal }) => {
    return webSearchExecutor({ query: args.query }, { abortSignal })
  },
})

export async function searchByPromptEngineering(model: ModelInterface, messages: Message[], signal?: AbortSignal) {
  const language = settingActions.getLanguage()
  const systemPrompt = promptFormat.contructSearchAction(language)
  const result = await generateText(
    model,
    sequenceMessages([
      {
        id: '',
        role: 'system',
        contentParts: [{ type: 'text', text: systemPrompt }],
      },
      ...messages,
    ])
  )
  // extract json from response
  const regex = /{(?:[^{}]|{(?:[^{}]|{[^{}]*})*})*}/g
  const textPart = result.contentParts.find((part) => part.type === 'text')
  if (!textPart) {
    return { query: '', searchResults: [] }
  }
  const match = textPart.text.match(regex)
  if (match) {
    for (const jsonString of match) {
      try {
        const jsonObject = JSON.parse(jsonString) as {
          action: 'search' | 'proceed'
          query: string
        }
        if (jsonObject.action === 'search') {
          const { searchResults } = await webSearchExecutor({ query: jsonObject.query }, { abortSignal: signal })
          return { query: jsonObject.query, searchResults }
        }
      } catch (error) {
        console.warn('Failed to parse JSON string:', jsonString, error)
      }
    }
  }
}

export async function knowledgeBaseSearchByPromptEngineering(
  model: ModelInterface,
  messages: Message[],
  knowledgeBaseId: number
) {
  const language = settingActions.getLanguage()
  const systemPrompt = promptFormat.constructKnowledgeBaseSearchAction(language)
  const result = await generateText(
    model,
    sequenceMessages([
      {
        id: '',
        role: 'system',
        contentParts: [{ type: 'text', text: systemPrompt }],
      },
      ...messages,
    ])
  )
  // extract json from response
  const regex = /{(?:[^{}]|{(?:[^{}]|{[^{}]*})*})*}/g
  const textPart = result.contentParts.find((part) => part.type === 'text')
  if (!textPart) {
    return { query: '', searchResults: [] }
  }
  const match = textPart.text.match(regex)
  if (match) {
    for (const jsonString of match) {
      try {
        const jsonObject = JSON.parse(jsonString) as {
          action: 'search' | 'proceed'
          query: string
        }
        if (jsonObject.action === 'search') {
          const knowledgeBaseController = platform.getKnowledgeBaseController()
          const searchResults = await knowledgeBaseController.search(knowledgeBaseId, jsonObject.query)
          return { query: jsonObject.query, searchResults }
        }
      } catch (error) {
        console.warn('Failed to parse JSON string:', jsonString, error)
      }
    }
  }
}

export async function combinedSearchByPromptEngineering(
  model: ModelInterface,
  messages: Message[],
  knowledgeBaseId?: number,
  signal?: AbortSignal
) {
  const language = settingActions.getLanguage()
  const systemPrompt = promptFormat.constructCombinedSearchAction(language, !!knowledgeBaseId)
  const result = await generateText(
    model,
    sequenceMessages([
      {
        id: '',
        role: 'system',
        contentParts: [{ type: 'text', text: systemPrompt }],
      },
      ...messages,
    ])
  )
  // extract json from response
  const regex = /{(?:[^{}]|{(?:[^{}]|{[^{}]*})*})*}/g
  const textPart = result.contentParts.find((part) => part.type === 'text')
  if (!textPart) {
    return { query: '', searchResults: [], type: 'none' as const }
  }
  const match = textPart.text.match(regex)
  if (match) {
    for (const jsonString of match) {
      try {
        const jsonObject = JSON.parse(jsonString) as {
          action: 'search_knowledge_base' | 'search_web' | 'proceed'
          query: string
        }
        if (jsonObject.action === 'search_knowledge_base' && knowledgeBaseId) {
          const knowledgeBaseController = platform.getKnowledgeBaseController()
          const searchResults = await knowledgeBaseController.search(knowledgeBaseId, jsonObject.query)
          return { query: jsonObject.query, searchResults, type: 'knowledge_base' as const }
        }
        if (jsonObject.action === 'search_web') {
          const { searchResults } = await webSearchExecutor({ query: jsonObject.query }, { abortSignal: signal })
          return { query: jsonObject.query, searchResults, type: 'web' as const }
        }
      } catch (error) {
        console.warn('Failed to parse JSON string:', jsonString, error)
      }
    }
  }
  return { query: '', searchResults: [], type: 'none' as const }
}

export function constructMessagesWithSearchResults(
  messages: Message[],
  searchResults: { title: string; snippet: string; link: string }[]
) {
  const systemPrompt = promptFormat.answerWithSearchResults()
  const formattedSearchResults = searchResults
    .map((it, i) => {
      return `[webpage ${i + 1} begin]
Title: ${it.title}
URL: ${it.link}
Content: ${it.snippet}
[webpage ${i + 1} end]`
    })
    .join('\n')

  return sequenceMessages([
    {
      id: '',
      role: 'system',
      contentParts: [{ type: 'text', text: systemPrompt }],
    },
    ...messages.slice(0, -1), // 最新一条用户消息和搜索结果放在一起了
    {
      id: '',
      role: 'user',
      contentParts: [
        {
          type: 'text',
          text: `${formattedSearchResults}\nUser Message:\n${getMessageText(last(messages) ?? { id: '', role: 'user', contentParts: [{ type: 'text', text: '' }] })}`,
        },
      ],
    },
  ])
}

export function constructMessagesWithKnowledgeBaseResults(
  messages: Message[],
  searchResults: Array<{
    id: number
    score: number
    text: string
    fileId: number
    filename: string
    mimeType: string
    chunkIndex: number
  }>
) {
  const systemPrompt = promptFormat.answerWithKnowledgeBaseResults()
  const formattedSearchResults = searchResults
    .map((it, i) => {
      return `[document ${i + 1} begin]
File: ${it.filename}
Content: ${it.text}
[document ${i + 1} end]`
    })
    .join('\n')

  return sequenceMessages([
    {
      id: '',
      role: 'system',
      contentParts: [{ type: 'text', text: systemPrompt }],
    },
    ...messages.slice(0, -1), // 最新一条用户消息和搜索结果放在一起了
    {
      id: '',
      role: 'user',
      contentParts: [
        {
          type: 'text',
          text: `${formattedSearchResults}\nUser Message:\n${getMessageText(last(messages) ?? { id: '', role: 'user', contentParts: [{ type: 'text', text: '' }] })}`,
        },
      ],
    },
  ])
}
