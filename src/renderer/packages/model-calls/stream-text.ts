import { inputBoxKnowledgeBaseAtom, inputBoxWebBrowsingModeAtom } from '@/stores/atoms'
import { ToolSet } from 'ai'
import { getDefaultStore } from 'jotai'
import { uniqueId } from 'lodash'
import { sequenceMessages } from 'src/shared/utils/message'
import { ModelInterface, OnResultChange, onResultChangeWithCancel } from '../../../shared/models/types'
import { Message, MessageToolCallPart, ProviderOptions, StreamTextResult } from '../../../shared/types'
import { getToolSet } from '../knowledge-base/tools'
import { mcpController } from '../mcp/controller'
import { convertToCoreMessages, injectModelSystemPrompt } from './message-utils'
import { constructMessagesWithSearchResults, searchByPromptEngineering, webSearchTool } from './tools'

export async function streamText(
  model: ModelInterface,
  params: {
    messages: Message[]
    onResultChangeWithCancel: onResultChangeWithCancel
    providerOptions?: ProviderOptions
  },
  signal?: AbortSignal
) {
  const store = getDefaultStore()
  const knowledgeBase = store.get(inputBoxKnowledgeBaseAtom)
  const webBrowsing = store.get(inputBoxWebBrowsingModeAtom)

  const controller = new AbortController()
  const cancel = () => controller.abort()
  if (signal) {
    signal.addEventListener('abort', cancel, { once: true })
  }

  let result: StreamTextResult = {
    contentParts: [],
  }

  params.messages = injectModelSystemPrompt(
    model.modelId,
    params.messages,
    // 在系统提示中添加知识库名称，方便模型理解
    knowledgeBase ? `Knowledge base is available to help you answer questions: ${knowledgeBase.name}` : '',
    model.isSupportSystemMessage() ? 'system' : 'user'
  )

  if (!model.isSupportSystemMessage()) {
    params.messages = params.messages.map((m) => ({ ...m, role: m.role === 'system' ? 'user' : m.role }))
  }

  const messages = sequenceMessages(params.messages)
  const coreMessages = await convertToCoreMessages(messages)

  try {
    params.onResultChangeWithCancel({ cancel }) // 这里先传递 cancel 方法
    const onResultChange: OnResultChange = (data) => {
      result = { ...result, ...data }
      params.onResultChangeWithCancel({ ...data, cancel })
    }

    // 不支持工具调用的模型，则使用prompt engineering的方式进行联网搜索
    if (webBrowsing && !model.isSupportToolUse('web-browsing')) {
      const callResult = await searchByPromptEngineering(model, params.messages, controller.signal)
      // 模型判断不需要搜索，或没有搜索结果，让模型正常回答
      if (!callResult?.searchResults?.length) {
        return model.chat(coreMessages, { signal: controller.signal, onResultChange })
      }
      const toolCallPart: MessageToolCallPart = {
        type: 'tool-call',
        state: 'result',
        toolCallId: `web_search_${uniqueId()}`,
        toolName: 'web_search',
        args: { query: callResult.query },
        result: callResult,
      }
      onResultChange({ contentParts: [toolCallPart] })
      return model.chat(
        await convertToCoreMessages(constructMessagesWithSearchResults(messages, callResult.searchResults)),
        {
          signal: controller.signal,
          onResultChange: (data) => {
            if (data.contentParts) {
              onResultChange({ contentParts: [toolCallPart, ...data.contentParts] })
            } else {
              onResultChange(data)
            }
          },
          providerOptions: params.providerOptions,
        }
      )
    }

    let tools: ToolSet = {
      ...mcpController.getAvailableTools(),
    }
    if (webBrowsing) {
      tools.web_search = webSearchTool
    }
    if (knowledgeBase) {
      tools = {
        ...tools,
        ...getToolSet(knowledgeBase.id),
      }
    }
    console.debug('tools', tools)

    result = await model.chat(coreMessages, {
      signal: controller.signal,
      onResultChange,
      providerOptions: params.providerOptions,
      tools,
    })

    return result
  } catch (err) {
    console.error(err)
    // if a cancellation is performed, do not throw an exception, otherwise the content will be overwritten.
    if (controller.signal.aborted) {
      return result
    }
    throw err
  }
}
