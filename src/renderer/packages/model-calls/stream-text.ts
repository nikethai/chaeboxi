import { google } from '@ai-sdk/google'
import NiceModal from '@ebay/nice-modal-react'
import { getModel } from '@shared/models'
import { ProviderAPIError, OCRError } from '@shared/models/errors'
import type { ModelDependencies } from '@shared/types/adapters'
import { ToolRiskTier } from '@shared/types/mcp'
import { sequenceMessages } from '@shared/utils/message'
import { getModelSettings } from '@shared/utils/model_settings'
import { shouldPreserveReasoningInContext } from '@shared/utils/reasoning-replay'
import { searchResultsToCitations } from '@shared/utils/search'
import type { ModelMessage, ToolSet } from 'ai'
import { t } from 'i18next'
import { uniqueId } from 'lodash'
import { createModelDependencies } from '@/adapters'
import type { ToolApprovalModalResult } from '@/modals/ToolApproval'
import { hostPreSearchMemories } from '@/packages/memory/host-presearch'
import { isSessionMemoryToolRetainAllowed } from '@/packages/memory/session-policy'
import { getMemoryToolSet, MEMORY_TOOL_NAMES } from '@/packages/memory/tools'
import platform from '@/platform'
import { ensureMemoryStoreInit, memoryStore } from '@/stores/memoryStore'
import { getMessageText } from '@/utils/message'
import { settingsStore } from '@/stores/settingsStore'
import { formatActiveTaskContext, taskStore } from '@/stores/taskStore'
import { getToolApproval, toolApprovalStore } from '@/stores/toolApprovalStore'
import type {
  ModelInterface,
  OnResultChange,
  OnResultChangeWithCancel,
  OnStatusChange,
} from '../../../shared/models/types'
import type {
  CopilotToolAccess,
  KnowledgeBase,
  Message,
  MessageContentParts,
  MessageInfoPart,
  MessageToolCallPart,
  ProviderOptions,
  SearchResultItem,
  SessionSettings,
  StreamTextResult,
} from '../../../shared/types'
import { mcpController } from '../mcp/controller'
import { getToolRiskTier } from '../tools/risk-engine'
import { convertToModelMessages, injectModelSystemPrompt } from './message-utils'
import { imageOCR } from './preprocess'
import {
  combinedSearchByPromptEngineering,
  constructMessagesWithKnowledgeBaseResults,
  constructMessagesWithSearchResults,
  knowledgeBaseSearchByPromptEngineering,
  searchByPromptEngineering,
} from './tools'
import { attachmentFileToolSet, createWorkspaceFileToolSet } from './toolsets/file'
import generateImageToolSet, { generateImageTool } from './toolsets/generate-image'
import { getToolSet } from './toolsets/knowledge-base'
import taskTrackingToolSet from './toolsets/task-tracking'
import { createTerminalToolSet } from './toolsets/terminal'
import videoToolSet, { initVideoToolBudget, resetVideoToolBudget } from './toolsets/video'
import websearchToolSet, { parseLinkTool, webSearchTool } from './toolsets/web-search'

/** Agent coding context: enables workspace write + terminal tools when set. */
export type AgentCodingOptions = {
  /** True when agent mode is active and this turn may execute (not plan-only). */
  enabled: boolean
  /** Absolute workspace root; required for write/terminal tools. */
  workspaceRoot?: string
}

const TASK_TRACKING_TOOL_NAMES = ['create_task', 'update_task', 'list_tasks'] as const

function areTaskToolsAllowed(toolAccess?: CopilotToolAccess): boolean {
  if (!toolAccess?.tools?.length) return true
  const accessSet = new Set(toolAccess.tools)
  if (toolAccess.mode === 'allowlist') {
    return TASK_TRACKING_TOOL_NAMES.every((name) => accessSet.has(name))
  }
  return TASK_TRACKING_TOOL_NAMES.every((name) => !accessSet.has(name))
}

function extractSearchMetadataFromToolCalls(result: StreamTextResult): Partial<StreamTextResult> {
  if (result.citations?.length) {
    return {}
  }

  const webSearchToolCallParts = result.contentParts.filter(
    (part): part is MessageToolCallPart<{ query?: string }, { query?: string; searchResults?: SearchResultItem[] }> =>
      part.type === 'tool-call' && part.toolName === 'web_search' && part.state === 'result'
  )
  const latestWebSearchCall = webSearchToolCallParts.at(-1)
  const searchResults = webSearchToolCallParts
    .flatMap((part) => part.result?.searchResults || [])
    .filter((result, index, results) => results.findIndex((candidate) => candidate.link === result.link) === index)

  if (!searchResults.length) {
    return {}
  }

  return {
    citations: searchResultsToCitations(searchResults, 'builtin'),
    searchQuery: latestWebSearchCall?.result?.query || latestWebSearchCall?.args?.query,
    searchProvider: settingsStore.getState().extension.webSearch.provider,
  }
}

function withSearchMetadata(result: StreamTextResult): StreamTextResult {
  return {
    ...result,
    ...extractSearchMetadataFromToolCalls(result),
  }
}

/**
 * (legacy comment removed)
 */
async function handleSearchResult(
  result: { query: string; searchResults: any[]; type?: 'knowledge_base' | 'web' | 'none' },
  toolName: string,
  model: ModelInterface,
  messages: Message[],
  coreMessages: ModelMessage[],
  controller: AbortController,
  onResultChange: OnResultChange,
  params: {
    providerOptions?: ProviderOptions
    onStatusChange?: OnStatusChange
    maxSteps?: number
    includeAssistantReasoning?: boolean
  },
  dependencies?: ModelDependencies
) {
  if (!result?.searchResults?.length || result.type === 'none') {
    const chatResult = await model.chat(coreMessages, {
      signal: controller.signal,
      onResultChange,
      onStatusChange: params.onStatusChange,
      maxSteps: params.maxSteps,
    })
    return { result: withSearchMetadata(chatResult), coreMessages }
  }

  const toolCallPart: MessageToolCallPart = {
    type: 'tool-call',
    state: 'result',
    toolCallId: `${result.type || toolName.replace('_', '')}_search_${uniqueId()}`,
    toolName,
    args: { query: result.query },
    result,
  }
  onResultChange({ contentParts: [toolCallPart] })

  const messagesWithResults =
    result.type === 'knowledge_base' || toolName === 'query_knowledge_base'
      ? constructMessagesWithKnowledgeBaseResults(messages, result.searchResults)
      : constructMessagesWithSearchResults(messages, result.searchResults)

  const chatResult = await model.chat(
    await convertToModelMessages(messagesWithResults, {
      modelSupportVision: true,
      dependencies,
      includeAssistantReasoning: params.includeAssistantReasoning,
    }),
    {
      signal: controller.signal,
      onResultChange: (data) => {
        if (data.contentParts) {
          onResultChange({ ...data, contentParts: [toolCallPart, ...data.contentParts] })
        } else {
          onResultChange(data)
        }
      },
      onStatusChange: params.onStatusChange,
      providerOptions: params.providerOptions,
      maxSteps: params.maxSteps,
    }
  )
  return { result: withSearchMetadata(chatResult), coreMessages }
}

async function ocrMessages(messages: Message[], dependencies: ModelDependencies) {
  const settings = settingsStore.getState().getSettings()
  const hasUserOcrModel = settings.ocrModel?.provider && settings.ocrModel?.model

  if (!hasUserOcrModel) {
    // OCR now only uses user-configured models in this build.
    throw ProviderAPIError.fromCodeName('model_not_support_image_2', 'model_not_support_image_2')
  }

  const ocrModelSetting = settings.ocrModel
  if (!ocrModelSetting) {
    throw ProviderAPIError.fromCodeName('model_not_support_image_2', 'model_not_support_image_2')
  }
  const ocrProviderName = ocrModelSetting.provider
  try {
    const modelSettings = getModelSettings(settings, ocrModelSetting.provider, ocrModelSetting.model)
    const ocrModel = getModel(modelSettings, settings, { uuid: '123' }, dependencies)
    await imageOCR(ocrModel, messages)
  } catch (err) {
    throw new OCRError(ocrProviderName, err instanceof Error ? err : new Error(`${err}`))
  }
}

function createToolDeniedResult(toolName: string, riskTier: ToolRiskTier) {
  return {
    denied: true,
    toolName,
    riskTier,
    message: t('Tool execution denied by user.'),
  }
}

function wrapMCPToolsWithApproval(sessionId: string | undefined, tools: ToolSet): ToolSet {
  if (!sessionId) {
    return tools
  }

  return Object.fromEntries(
    Object.entries(tools).map(([toolName, definition]) => {
      const riskTier = getToolRiskTier(toolName, definition?.description)

      return [
        toolName,
        {
          ...definition,
          execute: async (args: unknown, context) => {
            const existingApproval = getToolApproval(sessionId, toolName)
            const canAutoApprove =
              existingApproval?.scope === 'session' &&
              existingApproval.riskTier === riskTier &&
              riskTier !== ToolRiskTier.HIGH

            if (canAutoApprove) {
              toolApprovalStore.getState().addAuditEntry({
                sessionId,
                toolName,
                riskTier,
                scope: existingApproval.scope,
                decision: 'auto-approve',
                timestamp: Date.now(),
                args,
              })
              return definition.execute?.(args, context)
            }

            const decision = (await NiceModal.show('tool-approval', {
              toolName,
              description: definition?.description,
              riskTier,
              parameters: args,
            })) as ToolApprovalModalResult | undefined

            if (!decision || decision === 'deny') {
              toolApprovalStore.getState().addAuditEntry({
                sessionId,
                toolName,
                riskTier,
                scope: 'none',
                decision: 'deny',
                timestamp: Date.now(),
                args,
              })
              return createToolDeniedResult(toolName, riskTier)
            }

            const approval = {
              toolName,
              riskTier,
              scope: decision,
              timestamp: Date.now(),
            }
            toolApprovalStore.getState().addApproval(sessionId, approval)
            toolApprovalStore.getState().addAuditEntry({
              sessionId,
              toolName,
              riskTier,
              scope: decision,
              decision: 'allow',
              timestamp: approval.timestamp,
              args,
            })

            try {
              return await definition.execute?.(args, context)
            } finally {
              if (decision === 'once') {
                toolApprovalStore.getState().removeApproval(sessionId, toolName)
              }
            }
          },
        },
      ]
    })
  ) as ToolSet
}

const MCP_TOOL_PREFIX = 'mcp__'

/**
 * Filter tools based on copilot's toolAccess configuration.
 * - allowlist: only include tools whose names are in the tools array
 * - denylist: exclude tools whose names are in the tools array
 * - includeMcp: when false, excludes all MCP tools regardless of allowlist/denylist
 */
function filterToolsByAccess(tools: ToolSet, toolAccess?: CopilotToolAccess): ToolSet {
  if (!toolAccess) {
    return tools
  }

  const { mode, tools: accessTools, includeMcp = true } = toolAccess

  // If includeMcp is false, filter out all MCP tools first
  let filteredTools = tools
  if (includeMcp === false) {
    filteredTools = Object.fromEntries(Object.entries(tools).filter(([name]) => !name.startsWith(MCP_TOOL_PREFIX)))
  }

  // If no access tools specified, return filtered tools as-is
  if (!accessTools || accessTools.length === 0) {
    return filteredTools
  }

  const accessSet = new Set(accessTools)

  if (mode === 'allowlist') {
    // Only include tools that are in the access list
    return Object.fromEntries(Object.entries(filteredTools).filter(([name]) => accessSet.has(name)))
  } else {
    // denylist: exclude tools that are in the access list
    return Object.fromEntries(Object.entries(filteredTools).filter(([name]) => !accessSet.has(name)))
  }
}

/**
 * (legacy comment removed)
 */
export async function streamText(
  model: ModelInterface,
  params: {
    sessionId?: string
    messages: Message[]
    sessionSettings?: Partial<SessionSettings>
    onResultChangeWithCancel: OnResultChangeWithCancel
    onStatusChange?: OnStatusChange
    providerOptions?: ProviderOptions
    knowledgeBase?: Pick<KnowledgeBase, 'id' | 'name'>
    webBrowsing?: boolean
    nativeWebSearch?: 'gemini-grounding'
    agentImageFlowInstructions?: string
    /** Desktop agent coding: workspace file write + terminal (not gated on attachments). */
    agentCoding?: AgentCodingOptions
    tools?: ToolSet
    maxSteps?: number
    toolAccess?: CopilotToolAccess
    allowedTools?: string[]
    /** Long-term memory inject context (agent scope + inject options) */
    memory?: {
      agentId?: string
      agentName?: string
      forceHybridFallback?: boolean
      userQuery?: string
    }
  },
  signal?: AbortSignal
): Promise<{ result: StreamTextResult; coreMessages: ModelMessage[] }> {
  const {
    knowledgeBase,
    webBrowsing,
    sessionId,
    sessionSettings,
    nativeWebSearch,
    toolAccess,
    allowedTools,
    agentImageFlowInstructions,
    agentCoding,
    tools: customTools,
    memory: memoryContext,
  } = params
  const globalSettings = settingsStore.getState().getSettings()
  const hasDocumentFileOrLink = params.messages.some(
    (m) => m.links?.length || m.files?.some((f) => f.mediaKind !== 'video')
  )
  const hasVideoAttachment = params.messages.some((m) => m.files?.some((f) => f.mediaKind === 'video'))

  const controller = new AbortController()
  const cancel = () => controller.abort()
  if (signal) {
    signal.addEventListener('abort', cancel, { once: true })
  }

  let result: StreamTextResult = {
    contentParts: [],
  }
  let coreMessages: ModelMessage[] = []

  // Create dependencies once for the entire pipeline
  const dependencies = await createModelDependencies()

  // for model not support tool use, use prompt engineering to handle knowledge base and web search
  // Attachment tools (fileKey) only when user uploaded files/links
  const needAttachmentFileToolSet = hasDocumentFileOrLink && model.isSupportToolUse()
  const workspaceRoot = agentCoding?.workspaceRoot?.trim() || ''
  const needWorkspaceCodingTools =
    Boolean(agentCoding?.enabled) && Boolean(workspaceRoot) && platform.type === 'desktop' && model.isSupportToolUse()
  const needVideoToolSet = hasVideoAttachment && model.isSupportToolUse() && model.isSupportVision()
  const kbNotSupported = knowledgeBase && !model.isSupportToolUse('knowledge-base')
  const webNotSupported = webBrowsing && !model.isSupportToolUse('web-browsing')
  const workspaceFileToolSet = needWorkspaceCodingTools ? createWorkspaceFileToolSet(workspaceRoot) : null
  const terminalToolSet = needWorkspaceCodingTools ? createTerminalToolSet(workspaceRoot) : null

  // Seed video frame budget with auto-sampled frames already attached
  if (needVideoToolSet) {
    const preUsed = new Map<string, number>()
    for (const m of params.messages) {
      for (const f of m.files || []) {
        if (f.mediaKind === 'video' && f.storageKey && f.sampledFrameKeys?.length) {
          preUsed.set(f.storageKey, (preUsed.get(f.storageKey) ?? 0) + f.sampledFrameKeys.length)
        }
      }
    }
    initVideoToolBudget(platform.formFactor === 'desktop' ? 'desktop' : 'mobile', preUsed)
  } else {
    resetVideoToolBudget()
  }

  // 1. inject system prompt for tool use
  let toolSetInstructions = ''
  // (legacy comment removed)
  let kbToolSet = null
  if (knowledgeBase) {
    try {
      kbToolSet = await getToolSet(knowledgeBase.id, knowledgeBase.name)
    } catch (err) {
      console.error('Failed to load knowledge base toolset:', err)
    }
  }
  const mcpTools = wrapMCPToolsWithApproval(sessionId, mcpController.getAvailableTools())
  // Task tools must be decided before grounding: Gemini forbids mixing provider tools
  // (google.tools.googleSearch) with function tools. Counting tasks too late caused
  // grounding + create_task together → INVALID_ARGUMENT / hung tool loops.
  const taskToolsAvailable =
    model.isSupportToolUse() &&
    !customTools &&
    areTaskToolsAllowed(toolAccess) &&
    (!allowedTools ||
      allowedTools.length === 0 ||
      TASK_TRACKING_TOOL_NAMES.every((name) => allowedTools.includes(name)))
  try {
    await ensureMemoryStoreInit()
    if (memoryContext?.agentId) {
      await memoryStore.getState().ensureAgentBank(memoryContext.agentId)
    }
  } catch {
    // non-fatal in tests / degraded storage
  }
  const memorySettings = memoryStore.getState().settings
  const memoryToolsAvailable =
    memorySettings.enabled &&
    model.isSupportToolUse() &&
    !customTools &&
    (!allowedTools || allowedTools.length === 0 || MEMORY_TOOL_NAMES.some((name) => allowedTools.includes(name)))
  const needGenerateImageTool = Boolean(agentImageFlowInstructions) && model.isSupportToolUse()
  const hasFunctionTools =
    Object.keys(mcpTools).length > 0 ||
    Boolean(kbToolSet) ||
    Boolean(needAttachmentFileToolSet) ||
    Boolean(needWorkspaceCodingTools) ||
    Boolean(needVideoToolSet) ||
    taskToolsAvailable ||
    memoryToolsAvailable ||
    needGenerateImageTool
  // Native Gemini grounding only when there are no function tools at all.
  const useGeminiGrounding = nativeWebSearch === 'gemini-grounding' && webBrowsing && !hasFunctionTools

  if (taskToolsAvailable && sessionId) {
    await taskStore.getState().hydrateSessionTasks(sessionId)
  }

  if (kbToolSet && !kbNotSupported) {
    toolSetInstructions += kbToolSet.description
  }
  if (needAttachmentFileToolSet) {
    toolSetInstructions += attachmentFileToolSet.description
  }
  if (workspaceFileToolSet) {
    toolSetInstructions += workspaceFileToolSet.description
  }
  if (terminalToolSet) {
    toolSetInstructions += terminalToolSet.description
  }
  if (agentCoding?.enabled && !needWorkspaceCodingTools) {
    toolSetInstructions += `
# Local coding tools unavailable

You do NOT currently have filesystem write or terminal tools for this session.
${platform.type !== 'desktop' ? '- Coding tools require the desktop app.' : ''}
${!workspaceRoot ? '- No session workspace folder is set. Ask the user to set a workspace folder before scaffolding or writing project files on disk.' : ''}
- You may still use task checklist tools and answer with code in chat when local write/terminal is unavailable.
`
  }
  if (needVideoToolSet) {
    toolSetInstructions += videoToolSet.description
  }
  // Memory tools + priority instructions BEFORE web search so models see recall first.
  let memoryToolSet: ReturnType<typeof getMemoryToolSet> | null = null
  if (memoryToolsAvailable) {
    memoryToolSet = getMemoryToolSet({
      settings: memorySettings,
      getGlobalBank: () => memoryStore.getState().globalBank,
      setGlobalBank: async (bank) => {
        await memoryStore.getState().replaceGlobalBank(bank)
      },
      getAgentBank: () =>
        memoryContext?.agentId ? (memoryStore.getState().agentBanks[memoryContext.agentId] ?? null) : null,
      setAgentBank: async (bank) => {
        if (memoryContext?.agentId) {
          await memoryStore.getState().replaceAgentBank(memoryContext.agentId, bank)
        }
      },
      agentId: memoryContext?.agentId,
      agentName: memoryContext?.agentName,
      sessionId,
      allowRetain: isSessionMemoryToolRetainAllowed(memorySettings, sessionSettings),
      scheduleConsolidate: (scope) => {
        if (!memorySettings.autoConsolidate) return
        void memoryStore
          .getState()
          .rebuildProfile(scope, scope === 'agent' ? memoryContext?.agentId : undefined, true)
          .catch(() => {})
      },
    })
    toolSetInstructions += memoryToolSet.description
    if (
      memorySettings.retrievalMode === 'hybrid' ||
      memorySettings.retrievalMode === 'on_demand' ||
      !memorySettings.retrievalMode
    ) {
      toolSetInstructions += `
# Tool priority (memory-first)

A host Memory lookup already ran for the latest user message (system Memory section).
1. Use any Memory lookup hits before calling other tools.
2. If the question may involve the user's projects, stack, or prefs and lookup is empty, call memory_recall once with keywords from the user message.
3. Only then use web search for public/external documentation (SDKs, APIs, blogs).
Do not open with repeated web searches when personal memory may apply.
`
    }
  }

  if (webBrowsing && !webNotSupported && !useGeminiGrounding) {
    toolSetInstructions += websearchToolSet.description
  }

  if (taskToolsAvailable) {
    toolSetInstructions += taskTrackingToolSet.description
    if (sessionId) {
      toolSetInstructions += formatActiveTaskContext(taskStore.getState().getSessionTasks(sessionId))
    }
  }
  if (needGenerateImageTool) {
    toolSetInstructions += generateImageToolSet.description
    toolSetInstructions += `\n\n${agentImageFlowInstructions}`
  }

  const memoryForceHybridFallback =
    memorySettings.enabled && memorySettings.retrievalMode === 'on_demand' && !model.isSupportToolUse()

  params.messages = injectModelSystemPrompt(
    model.modelId,
    params.messages,
    // (legacy comment removed)
    toolSetInstructions,
    model.isSupportSystemMessage() ? 'system' : 'user',
    {
      ...memoryContext,
      forceHybridFallback: memoryForceHybridFallback || memoryContext?.forceHybridFallback,
    }
  )

  if (!model.isSupportSystemMessage()) {
    params.messages = params.messages.map((m) => ({ ...m, role: m.role === 'system' ? 'user' : m.role }))
  }

  // 2. sequence messages to fix the order, prevent model API 400 errors
  const messages = sequenceMessages(params.messages)
  /** Prefix parts shown before model stream (info + host memory_lookup tool card) */
  const prefixParts: MessageContentParts = []
  try {
    params.onResultChangeWithCancel({ cancel }) // cancel
    const onResultChange: OnResultChange = (data) => {
      if (data.contentParts) {
        result = { ...result, ...data, contentParts: [...prefixParts, ...data.contentParts] }
      } else {
        result = { ...result, ...data }
      }
      params.onResultChangeWithCancel({ ...result, cancel })
    }

    // Host memory lookup first — visible tool step + already injected into system prompt
    {
      const mode = memorySettings.retrievalMode ?? 'hybrid'
      const hostLookupOn =
        memorySettings.enabled &&
        memorySettings.hostPreSearchEnabled !== false &&
        (mode === 'hybrid' || mode === 'on_demand')
      if (hostLookupOn) {
        let userQuery = memoryContext?.userQuery?.trim() || ''
        if (!userQuery) {
          for (let i = params.messages.length - 1; i >= 0; i--) {
            const m = params.messages[i]
            if (m.role === 'user') {
              userQuery = getMessageText(m, false, false).trim()
              if (userQuery) break
            }
          }
        }
        if (userQuery) {
          const agentBank = memoryContext?.agentId
            ? (memoryStore.getState().agentBanks[memoryContext.agentId] ?? null)
            : null
          const { getMemoryRepository } = await import('@/packages/memory/repository')
          const repo = getMemoryRepository()
          const hits = hostPreSearchMemories({
            query: userQuery,
            globalBank: memoryStore.getState().globalBank,
            agentBank,
            globalIndex: repo.getGlobalIndex(),
            agentIndex: memoryContext?.agentId ? repo.getAgentIndex(memoryContext.agentId) : null,
            settings: memorySettings,
            limit: memorySettings.hostPreSearchLimit ?? 5,
          })
          const memoryLookupPart: MessageToolCallPart = {
            type: 'tool-call',
            state: 'result',
            toolCallId: `memory_lookup_${uniqueId()}`,
            toolName: 'memory_lookup',
            args: { query: userQuery },
            result: {
              matchCount: hits.length,
              matches: hits.map((h) => ({
                id: h.id,
                scope: h.scope,
                content: h.content,
                score: h.score,
              })),
              note:
                hits.length > 0
                  ? 'Host keyword lookup ran before model tools; matches are also in the system Memory section.'
                  : 'Host keyword lookup ran before model tools; no matches. Model may call memory_recall for a deeper search.',
            },
          }
          prefixParts.push(memoryLookupPart)
          // Surface immediately so UI shows Memory lookup before web search starts
          onResultChange({ contentParts: [] })
        }
      }
    }

    if (
      !model.isSupportVision() &&
      messages.some((m) => m.contentParts.some((c) => c.type === 'image' && !c.ocrResult))
    ) {
      await ocrMessages(messages, dependencies)
      prefixParts.push({
        type: 'info',
        text: t('Current model {{modelName}} does not support image input, using OCR to process images', {
          modelName: model.modelId,
        }),
      })
    }

    const includeAssistantReasoning = shouldPreserveReasoningInContext(sessionSettings, globalSettings)

    coreMessages = await convertToModelMessages(messages, {
      modelSupportVision: model.isSupportVision(),
      dependencies,
      includeAssistantReasoning,
    })

    // 3. handle model not support tool use scenarios
    if (kbNotSupported || webNotSupported) {
      // (legacy comment removed)
      if (kbNotSupported && webNotSupported) {
        // infoParts.push({
        //   type: 'info',
        //   text: t(
        //     'Current model {{modelName}} does not support tool use, using prompt for knowledge base and web search',
        //     {
        //       modelName: model.modelId,
        //     }
        //   ),
        // })

        const callResult = await combinedSearchByPromptEngineering(
          model,
          params.messages,
          knowledgeBase.id,
          controller.signal
        )
        const toolName = callResult.type === 'knowledge_base' ? 'query_knowledge_base' : 'web_search'
        return handleSearchResult(
          callResult,
          toolName,
          model,
          messages,
          coreMessages,
          controller,
          onResultChange,
          { ...params, includeAssistantReasoning },
          dependencies
        )
      }
      // (legacy comment removed)
      else if (kbNotSupported) {
        // infoParts.push({
        //   type: 'info',
        //   text: t('Current model {{modelName}} does not support tool use, using prompt for knowledge base', {
        //     modelName: model.modelId,
        //   }),
        // })

        const callResult = await knowledgeBaseSearchByPromptEngineering(model, params.messages, knowledgeBase.id)

        return handleSearchResult(
          callResult || { query: '', searchResults: [] },
          'query_knowledge_base',
          model,
          messages,
          coreMessages,
          controller,
          onResultChange,
          { ...params, includeAssistantReasoning },
          dependencies
        )
      }
      // (legacy comment removed)
      else if (webNotSupported) {
        // infoParts.push({
        //   type: 'info',
        //   text: t('Current model {{modelName}} does not support tool use, using prompt for web search', {
        //     modelName: model.modelId,
        //   }),
        // })

        const callResult = await searchByPromptEngineering(model, params.messages, controller.signal)
        return handleSearchResult(
          callResult || { query: '', searchResults: [] },
          'web_search',
          model,
          messages,
          coreMessages,
          controller,
          onResultChange,
          { ...params, includeAssistantReasoning },
          dependencies
        )
      }
    }

    // 4. construct tool set
    const useCustomTools = Boolean(customTools)
    let tools: ToolSet = useCustomTools ? { ...customTools } : { ...mcpTools }
    if (!useCustomTools) {
      if (useGeminiGrounding) {
        tools.google_search = google.tools.googleSearch({
          mode: 'MODE_DYNAMIC',
          dynamicThreshold: 0.3,
        })
      } else if (webBrowsing) {
        tools.web_search = webSearchTool
        tools.parse_link = parseLinkTool
      }
      if (kbToolSet) {
        tools = {
          ...tools,
          ...kbToolSet.tools,
        }
      }

      if (needAttachmentFileToolSet) {
        const wrappedAttachmentTools = wrapMCPToolsWithApproval(sessionId, attachmentFileToolSet.tools)
        tools = {
          ...tools,
          ...wrappedAttachmentTools,
        }
      }

      if (workspaceFileToolSet) {
        const wrappedWorkspaceTools = wrapMCPToolsWithApproval(sessionId, workspaceFileToolSet.tools)
        tools = {
          ...tools,
          ...wrappedWorkspaceTools,
        }
      }

      if (terminalToolSet) {
        const wrappedTerminalTools = wrapMCPToolsWithApproval(sessionId, terminalToolSet.tools)
        tools = {
          ...tools,
          ...wrappedTerminalTools,
        }
      }

      if (needVideoToolSet) {
        const wrappedVideoTools = wrapMCPToolsWithApproval(sessionId, videoToolSet.tools as ToolSet)
        tools = {
          ...tools,
          ...wrappedVideoTools,
        }
      }

      if (needGenerateImageTool) {
        const generateImageTools = wrapMCPToolsWithApproval(sessionId, {
          generate_image: generateImageTool,
        })
        tools = {
          ...tools,
          ...generateImageTools,
        }
      }

      if (taskToolsAvailable) {
        tools = {
          ...tools,
          ...taskTrackingToolSet.tools,
        }
      }

      if (memoryToolSet) {
        tools = {
          ...tools,
          ...memoryToolSet.tools,
        }
      }
    }

    // Apply copilot tool access filtering
    tools = filterToolsByAccess(tools, toolAccess)

    // Apply allowedTools filtering (for planning phase - only allow specific tools)
    if (allowedTools && allowedTools.length > 0) {
      const allowedSet = new Set(allowedTools)
      tools = Object.fromEntries(Object.entries(tools).filter(([name]) => allowedSet.has(name)))
    }

    // Global PreToolUse / PostToolUse around every tool execute (after approval + access filters)
    const toolHookWorkspace = workspaceRoot || agentCoding?.workspaceRoot || null
    try {
      const { refreshAgentHooks } = await import('@/stores/hooksStore')
      await refreshAgentHooks({ workspaceRoot: toolHookWorkspace })
    } catch {
      // non-fatal — hooks cache may already be warm from PreTurn
    }
    const { wrapToolsWithLifecycleHooks } = await import('@/packages/hooks')
    tools = wrapToolsWithLifecycleHooks(tools, {
      sessionId,
      workspaceRoot: toolHookWorkspace,
    })

    console.debug('tools', tools)

    result = withSearchMetadata(
      await model.chat(coreMessages, {
        sessionId,
        signal: controller.signal,
        onResultChange,
        onStatusChange: params.onStatusChange,
        providerOptions: params.providerOptions,
        tools,
        maxSteps: params.maxSteps,
      })
    )

    return { result, coreMessages }
  } catch (err) {
    console.error(err)
    // if a cancellation is performed, do not throw an exception, otherwise the content will be overwritten.
    if (controller.signal.aborted) {
      return { result, coreMessages }
    }
    throw err
  } finally {
    resetVideoToolBudget()
  }
}
