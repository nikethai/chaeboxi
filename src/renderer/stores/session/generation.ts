import * as Sentry from '@sentry/react'
import { getDefaultStore } from 'jotai'
import { getModel } from '@shared/models'
import { AIProviderNoImplementedPaintError, ApiError, BaseError, NetworkError, OCRError } from '@shared/models/errors'
import type { ToolSet } from 'ai'
import type { OnResultChangeWithCancel } from '@shared/models/types'
import {
  COPILOT_MAX_STEPS_DEFAULT,
  type CopilotToolAccess,
  type CompactionPoint,
  type CopilotHook,
  createMessage,
  type Message,
  type MessageImagePart,
  type MessagePicture,
  type PlanPhase,
  ModelProviderEnum,
  type Session,
  type SessionSettings,
  type SessionType,
  type Settings,
} from '@shared/types'
import { cloneMessage, getMessageText, mergeMessages } from '@shared/utils/message'
import { createModelDependencies } from '@/adapters'
import * as appleAppStore from '@/packages/apple_app_store'
import { getBuiltInCopilotById, myCopilotsAtom } from '@/hooks/useCopilots'
import { buildContextForAI } from '@/packages/context-management'
import {
  buildAttachmentWrapperPrefix,
  buildAttachmentWrapperSuffix,
  MAX_INLINE_FILE_LINES,
  PREVIEW_LINES,
} from '@/packages/context-management/attachment-payload'
import { generateImage, streamText } from '@/packages/model-calls'
import { getModelDisplayName } from '@/packages/model-setting-utils'
import { estimateTokensFromMessages } from '@/packages/token'
import platform from '@/platform'
import storage from '@/storage'
import { StorageKeyGenerator } from '@/storage/StoreStorage'
import { trackEvent } from '@/utils/track'
import { CHATBOX_BUILD_PLATFORM } from '@/variables'
import * as chatStore from '../chatStore'
import { settingsStore } from '../settingsStore'
import { uiStore } from '../uiStore'
import { createNewFork, findMessageLocation } from './forks'
import { insertMessageAfter, modifyMessage, submitNewUserMessage } from './messages'
import { messageQueueStore } from './messageQueue'
import { runCompactionWithUIState } from '@/packages/context-management'
import type { MessagePlanPart, MessageToolCallPart } from '@shared/types'
import {
  COMFYUI_AGENT_DEFAULT_RESEARCH_DOMAINS,
  COMFYUI_AGENT_DEFAULT_NORMALIZATION_PROMPT,
} from '@shared/providers/definitions/comfyui'

// Agent-only modules (toolsets, copilot hooks, agentImageFlow) are loaded
// dynamically inside the corresponding agent-mode code paths so they can be
// tree-shaken from the Android bundle. CHATBOX_BUILD_PLATFORM === 'android'
// gates ensure the dynamic imports never execute on mobile.
const isAgentEnabled = CHATBOX_BUILD_PLATFORM !== 'android'

function buildAgentImageFlowInstruction(settings: Settings): string | undefined {
  const comfyuiSettings = settings.providers?.[ModelProviderEnum.ComfyUI]
  if (!comfyuiSettings?.agentImageFlowEnabled) {
    return undefined
  }

  const domains = comfyuiSettings.agentImageResearchDomains?.length
    ? comfyuiSettings.agentImageResearchDomains
    : COMFYUI_AGENT_DEFAULT_RESEARCH_DOMAINS
  const normalizationPrompt =
    comfyuiSettings.agentImageNormalizationPrompt || COMFYUI_AGENT_DEFAULT_NORMALIZATION_PROMPT

  return [
    '## COMFYUI AGENT IMAGE FLOW',
    'You are allowed to perform a research-to-image workflow for anime art references.',
    `Research only these domains: ${domains.join(', ')}.`,
    'Always call `web_search` with `includeDomains` set to exactly that list. Use concise English search queries focused on current or trending anime art styles.',
    'When promising results are found, use `parse_link` on the strongest links. If parsing fails or content is sparse, fall back to the available snippets.',
    'Extract only reusable visual traits. Do not keep character names, franchise names, artist names, copyrighted identifiers, or body-specific traits.',
    `Normalization rules: ${normalizationPrompt}`,
    'When you are ready, call `generate_image` with the final normalized comma-separated tags. Do not ask the user for confirmation.',
  ].join('\n')
}

function getTextFromContentParts(contentParts: Message['contentParts']): string {
  return contentParts
    .filter((part): part is Extract<Message['contentParts'][number], { type: 'text' }> => part.type === 'text')
    .map((part) => part.text)
    .join('\n')
    .trim()
}

function hasGenerateImageToolCall(contentParts: Message['contentParts']): boolean {
  return contentParts.some((part) => part.type === 'tool-call' && part.toolName === 'generate_image')
}

async function maybeAutoStartAgentImageFlow(
  contentParts: Message['contentParts']
): Promise<MessageToolCallPart | null> {
  if (hasGenerateImageToolCall(contentParts)) {
    return null
  }
  if (!isAgentEnabled) {
    return null
  }

  const { extractDanbooruTagListFromText } = await import('./agentImageFlow')
  const inferredPrompt = extractDanbooruTagListFromText(getTextFromContentParts(contentParts))
  if (!inferredPrompt) {
    return null
  }

  const toolCallId = `generate_image_fallback_${Date.now()}`

  try {
    const { startComfyUIAgentGeneration } = await import(
      '@/packages/model-calls/toolsets/generate-image'
    )
    const generationResult = await startComfyUIAgentGeneration({
      prompt: inferredPrompt,
    })

    return {
      type: 'tool-call',
      state: 'result',
      toolCallId,
      toolName: 'generate_image',
      args: {
        prompt: inferredPrompt,
      },
      result: generationResult,
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(`${error}`)
    return {
      type: 'tool-call',
      state: 'error',
      toolCallId,
      toolName: 'generate_image',
      args: {
        prompt: inferredPrompt,
      },
      result: {
        name: err.name,
        message: err.message,
        stack: err.stack,
      },
    }
  }
}

// Planning phase system prompt instruction
const PLANNING_SYSTEM_PROMPT = `
You are in PLANNING MODE. Your task is to analyze the user's request and create a structured execution plan.

## Your Output Format
You MUST output a MessagePlanPart with your plan. The plan should:
1. Break down the task into clear, actionable steps
2. Identify which tools will be needed for each step
3. Consider potential risks or issues
4. Be specific enough for execution

## Tools Available in Planning Mode
You have access to read-only tools: web_search, read_file, search_file_content, and knowledge_base search.
Use these to gather information needed for your plan.

## Important
- Do NOT execute the task - only create a plan
- Be thorough in your analysis
- Consider edge cases and error handling
- Output your plan in a structured format

When you have completed your plan, include it in your response as a plan part.
`

/**
 * Construct read-only tools for planning phase.
 * Only includes: web_search, read_file, search_file_content, and knowledge_base tools.
 * MCP tools are excluded from planning phase.
 */
async function getReadOnlyToolsForPlanning(
  knowledgeBase?: Pick<{ id: number; name: string }, 'id' | 'name'>
): Promise<{ tools: ToolSet; instructions: string }> {
  const tools: ToolSet = {}
  let instructions = PLANNING_SYSTEM_PROMPT

  // Plan mode is agent-only; on Android the toolsets aren't bundled.
  if (!isAgentEnabled) {
    return { tools, instructions }
  }

  // Lazy-load agent toolsets so they're tree-shaken on Android.
  const [websearchToolSetModule, fileToolSetModule, kbModule] = await Promise.all([
    import('@/packages/model-calls/toolsets/web-search'),
    import('@/packages/model-calls/toolsets/file'),
    import('@/packages/model-calls/toolsets/knowledge-base'),
  ])
  const websearchToolSet = websearchToolSetModule.default
  const fileToolSet = fileToolSetModule.default
  const { getToolSet } = kbModule

  // Add web search tools
  if (websearchToolSet?.tools) {
    if (websearchToolSet.tools.web_search) {
      tools.web_search = websearchToolSet.tools.web_search
    }
    if (websearchToolSet.tools.parse_link) {
      tools.parse_link = websearchToolSet.tools.parse_link
    }
  }

  // Add file tools
  if (fileToolSet?.tools) {
    if (fileToolSet.tools.read_file) {
      tools.read_file = fileToolSet.tools.read_file
    }
    if (fileToolSet.tools.search_file_content) {
      tools.search_file_content = fileToolSet.tools.search_file_content
    }
  }

  // Add knowledge base tools
  let kbInstructions = ''
  if (knowledgeBase) {
    try {
      const kbToolSet = await getToolSet(knowledgeBase.id, knowledgeBase.name)
      if (kbToolSet?.tools) {
        Object.assign(tools, kbToolSet.tools)
      }
      kbInstructions = kbToolSet?.description ?? ''
    } catch (err) {
      console.error('Failed to load knowledge base toolset for planning:', err)
    }
  }

  // Build instructions string
  if (websearchToolSet?.description) {
    instructions += '\n\n' + websearchToolSet.description
  }
  if (fileToolSet?.description) {
    instructions += '\n\n' + fileToolSet.description
  }
  if (kbInstructions) {
    instructions += '\n\n' + kbInstructions
  }

  return { tools, instructions }
}

/**
 * Run overflow handling and return truncateTokenLimit if applicable.
 * Used by regenerate flows to apply the same truncation as send-message.
 */
async function getOverflowTruncateLimit(sessionId: string): Promise<number | undefined> {
  const session = await chatStore.getSession(sessionId)
  if (!session || (session.type !== 'chat' && session.type !== undefined)) {
    return undefined
  }
  const compactionResult = await runCompactionWithUIState(sessionId)
  if (!compactionResult.success) {
    throw compactionResult.error ?? new Error('Compaction failed')
  }
  return compactionResult.truncateTokenLimit
}

/**
 * Retrieve copilot model-settings overrides from the live Jotai atom.
 *
 * Reading from `getDefaultStore().get(myCopilotsAtom)` gives us the value
 * that Jotai holds in memory right now, which is always up-to-date regardless
 * of whether the underlying debounced storage write has flushed yet.  This
 * avoids the race condition where a user edits copilot settings and immediately
 * sends a message before the debounced write completes.
 */
function getCopilotSettings(copilotId: string | undefined): {
  temperature?: number
  topP?: number
  maxTokens?: number
  maxSteps?: number
  toolAccess?: CopilotToolAccess
  hooks?: { preTurn?: CopilotHook[]; postTurn?: CopilotHook[] }
} | null {
  if (!copilotId) return null
  try {
    const storedCopilots = getDefaultStore().get(myCopilotsAtom)
    const copilots = Array.isArray(storedCopilots) ? storedCopilots : []
    const copilot = copilots.find((c) => c.id === copilotId)
    const detail = copilot ?? getBuiltInCopilotById(copilotId)
    if (!detail) return null
    return { ...detail.modelSettings, maxSteps: detail.maxSteps, toolAccess: detail.toolAccess, hooks: detail.hooks }
  } catch {
    const detail = getBuiltInCopilotById(copilotId)
    if (!detail) return null
    return { ...detail.modelSettings, maxSteps: detail.maxSteps, toolAccess: detail.toolAccess, hooks: detail.hooks }
  }
}

/**
 * Get session-level web browsing setting
 * Returns user's explicit setting if set, otherwise returns default based on provider
 */
export function getSessionWebBrowsing(sessionId: string, _provider: string | undefined): boolean {
  const sessionValue = uiStore.getState().sessionWebBrowsingMap[sessionId]
  if (sessionValue !== undefined) {
    return sessionValue
  }
  // Default: disabled unless explicitly enabled by the user.
  return false
}

/**
 * Track generation event
 */
function trackGenerateEvent(
  sessionId: string,
  settings: SessionSettings,
  globalSettings: Settings,
  sessionType: SessionType | undefined,
  options?: { operationType?: 'send_message' | 'regenerate' }
) {
  // Get a more meaningful provider identifier
  let providerIdentifier = settings.provider
  if (settings.provider?.startsWith('custom-provider-')) {
    // For custom providers, use apiHost as identifier
    const providerSettings = globalSettings.providers?.[settings.provider]
    if (providerSettings?.apiHost) {
      try {
        const url = new URL(providerSettings.apiHost)
        providerIdentifier = `custom:${url.hostname}`
      } catch {
        providerIdentifier = `custom:${providerSettings.apiHost}`
      }
    } else {
      providerIdentifier = 'custom:unknown'
    }
  }

  const webBrowsing = getSessionWebBrowsing(sessionId, settings.provider)

  trackEvent('generate', {
    provider: providerIdentifier,
    model: settings.modelId || 'unknown',
    operation_type: options?.operationType || 'unknown',
    web_browsing_enabled: webBrowsing ? 'true' : 'false',
    session_type: sessionType || 'chat',
  })
}

/**
 * Create n empty picture messages (loading state, for placeholders)
 * @param n Number of empty messages
 * @returns
 */
export function createLoadingPictures(n: number): MessagePicture[] {
  const ret: MessagePicture[] = []
  for (let i = 0; i < n; i++) {
    ret.push({ loading: true })
  }
  return ret
}

/**
 * Execute message generation, will modify message state
 * @param sessionId
 * @param targetMsg
 * @returns
 */
export async function generate(
  sessionId: string,
  targetMsg: Message,
  options?: {
    operationType?: 'send_message' | 'regenerate'
    truncateTokenLimit?: number
    prefetchedSession?: Session
    prefetchedSettings?: SessionSettings
  }
) {
  let shouldProcessQueuedMessages = false
  // Get dependent data — use pre-fetched values when available to avoid redundant async lookups
  const session = options?.prefetchedSession ?? (await chatStore.getSession(sessionId))
  const settings = options?.prefetchedSettings ?? (await chatStore.getSessionSettings(sessionId))
  const globalSettings = settingsStore.getState().getSettings()
  const configs = await platform.getConfig()
  if (!session || !settings) {
    return
  }

  // Overlay copilot model settings (temperature, topP, maxTokens) if the
  // session has a linked copilot that defines overrides.
  const copilotOverrides = getCopilotSettings(session.copilotId)
  const effectiveSettings: SessionSettings = copilotOverrides
    ? {
        ...settings,
        temperature: copilotOverrides.temperature ?? settings.temperature,
        topP: copilotOverrides.topP ?? settings.topP,
        maxTokens: copilotOverrides.maxTokens ?? settings.maxTokens,
      }
    : settings

  // Track generation event
  trackGenerateEvent(sessionId, effectiveSettings, globalSettings, session.type, options)

  // Reset message state to initial state
  targetMsg = {
    ...targetMsg,
    // FIXME: For picture message generation, need to show placeholder
    // pictures: session.type === 'picture' ? createLoadingPictures(settings.imageGenerateNum) : targetMsg.pictures,
    cancel: undefined,
    aiProvider: effectiveSettings.provider,
    model: await getModelDisplayName(effectiveSettings, globalSettings, session.type || 'chat'),
    style: session.type === 'picture' ? effectiveSettings.dalleStyle : undefined,
    generating: true,
    errorCode: undefined,
    error: undefined,
    errorExtra: undefined,
    status: [],
    firstTokenLatency: undefined,
    // Set isStreamingMode once during Message initialization (constant property)
    isStreamingMode: effectiveSettings.stream !== false,
  }

  await modifyMessage(sessionId, targetMsg)
  // setTimeout(() => {
  //   scrollActions.scrollToMessage(targetMsg.id, 'end')
  // }, 50) // Wait for message render to complete before scrolling to bottom

  // Get the message list where target message is located (may be historical messages), get target message index
  let messages = session.messages
  let targetMsgIx = messages.findIndex((m) => m.id === targetMsg.id)
  if (targetMsgIx <= 0) {
    if (!session.threads) {
      return
    }
    for (const t of session.threads) {
      messages = t.messages
      targetMsgIx = messages.findIndex((m) => m.id === targetMsg.id)
      if (targetMsgIx > 0) {
        break
      }
    }
    if (targetMsgIx <= 0) {
      return
    }
  }

  try {
    const dependencies = await createModelDependencies()
    const { refreshXaiAuthIfNeeded } = await import('@/utils/xai-auth-refresh')
    const { refreshOpenAICodexAuthIfNeeded } = await import('@/utils/openai-codex-auth-refresh')
    const { refreshGeminiAntigravityAuthIfNeeded } = await import('@/utils/gemini-antigravity-auth-refresh')
    let authReadySettings = await refreshXaiAuthIfNeeded(globalSettings, effectiveSettings.provider)
    authReadySettings = await refreshOpenAICodexAuthIfNeeded(authReadySettings, effectiveSettings.provider)
    authReadySettings = await refreshGeminiAntigravityAuthIfNeeded(
      authReadySettings,
      effectiveSettings.provider
    )
    const model = getModel(effectiveSettings, authReadySettings, configs, dependencies)
    const sessionKnowledgeBaseMap = uiStore.getState().sessionKnowledgeBaseMap
    const knowledgeBase = sessionKnowledgeBaseMap[sessionId]
    const agentImageFlowInstructions =
      isAgentEnabled && session.agentMode ? buildAgentImageFlowInstruction(globalSettings) : undefined
    const webBrowsing =
      getSessionWebBrowsing(sessionId, effectiveSettings.provider) || Boolean(agentImageFlowInstructions)
    const useGeminiGrounding =
      webBrowsing &&
      effectiveSettings.provider === ModelProviderEnum.Gemini &&
      globalSettings.extension.webSearch.useGoogleGroundingForGemini !== false
    const maxSteps =
      isAgentEnabled && session.agentMode ? (copilotOverrides?.maxSteps ?? COPILOT_MAX_STEPS_DEFAULT) : undefined
    switch (session.type) {
      // Chat message generation
      case 'chat':
      case undefined: {
        const startTime = Date.now()
        let firstTokenLatency: number | undefined
        let lastTokenSpeed: number | undefined
        const persistInterval = 2000
        let lastPersistTimestamp = Date.now()
        let promptMsgs = await genMessageContext(
          effectiveSettings,
          messages.slice(0, targetMsgIx),
          model.isSupportToolUse('read-file'),
          { compactionPoints: session.compactionPoints, truncateTokenLimit: options?.truncateTokenLimit }
        )

        if (effectiveSettings.provider === ModelProviderEnum.OpenClaw) {
          // OpenClaw manages its own session prompt. Drop persisted chat-level system messages,
          // but keep runtime instructions injected below (pre-hooks, planning, tool prompts).
          promptMsgs = promptMsgs.filter((message) => message.role !== 'system')
        }

        // Execute pre-turn hooks and prepend context to messages
        const preHookContext =
          isAgentEnabled && copilotOverrides?.hooks?.preTurn
            ? await (await import('@/packages/copilot-hooks')).executePreHooks(copilotOverrides.hooks.preTurn)
            : ''
        if (preHookContext) {
          promptMsgs.unshift(createMessage('system', preHookContext))
        }

        // Check for existing plan in targetMsg (for 2-phase execution)
        const existingPlanPart = targetMsg.contentParts.find((part): part is MessagePlanPart => part.type === 'plan')
        const isExecutionPhase = existingPlanPart?.status === 'approved'

        // If we have an approved plan, inject it into the prompt for context
        if (isExecutionPhase && existingPlanPart) {
          const planInjection = createMessage(
            'system',
            `## APPROVED EXECUTION PLAN\n\n${existingPlanPart.planText}\n\nProceed with executing this plan using all available tools.`
          )
          promptMsgs.unshift(planInjection)
        }

        const modifyMessageCache: OnResultChangeWithCancel = async (updated) => {
          const textLength = getMessageText(targetMsg, true, true).length
          if (!firstTokenLatency && textLength > 0) {
            firstTokenLatency = Date.now() - startTime
          }
          if (updated.tokenSpeed !== undefined) {
            lastTokenSpeed = updated.tokenSpeed
          }
          // Direct field merge instead of pickBy(updated, identity) + spread.
          // pickBy with identity drops falsy values (0, false, '') which is a silent bug;
          // explicit assignment is both faster and more correct.
          targetMsg = {
            ...targetMsg,
            contentParts: updated.contentParts ?? targetMsg.contentParts,
            cancel: updated.cancel ?? targetMsg.cancel,
            status: textLength > 0 ? [] : targetMsg.status,
            firstTokenLatency,
            tokenSpeed: lastTokenSpeed,
          }
          // update cache on each chunk and persist to storage periodically
          const shouldPersist = Date.now() - lastPersistTimestamp >= persistInterval
          await modifyMessage(sessionId, targetMsg, false, !shouldPersist)
          if (shouldPersist) {
            lastPersistTimestamp = Date.now()
          }
        }

        // 2-phase execution: if planMode and not yet approved, generate plan first
        const isPlanMode = isAgentEnabled && session.agentMode && effectiveSettings.planMode
        const isPendingPlan = existingPlanPart?.status === 'pending'

        // Determine which tools to use based on phase
        let toolsToUse: ToolSet | undefined
        let planningToolsInstructions = ''
        const executionAgentImageFlowInstructions =
          !isPlanMode || isExecutionPhase ? agentImageFlowInstructions : undefined

        if (isPlanMode && !isExecutionPhase) {
          // Planning phase: use read-only tools
          const readonlyTools = await getReadOnlyToolsForPlanning(
            knowledgeBase ? { id: knowledgeBase.id, name: knowledgeBase.name } : undefined
          )
          toolsToUse = readonlyTools.tools
          planningToolsInstructions = readonlyTools.instructions
        }

        // Inject planning tools instructions into system prompt if in planning phase
        if (planningToolsInstructions) {
          const planningSystemMsg = createMessage('system', planningToolsInstructions)
          promptMsgs.unshift(planningSystemMsg)
        }

        const { result } = await streamText(model, {
          sessionId: session.id,
          messages: promptMsgs,
          sessionSettings: effectiveSettings,
          onResultChangeWithCancel: modifyMessageCache,
          onStatusChange: (status) => {
            targetMsg = {
              ...targetMsg,
              status: status ? [status] : [],
            }
            void modifyMessage(sessionId, targetMsg, false, true)
          },
          providerOptions: effectiveSettings.providerOptions,
          knowledgeBase,
          webBrowsing,
          nativeWebSearch: useGeminiGrounding ? 'gemini-grounding' : undefined,
          agentImageFlowInstructions: executionAgentImageFlowInstructions,
          maxSteps,
          tools: toolsToUse,
        })

        // Extract plan text from result if in planning phase
        const planTextFromResult = result.text ?? ''

        // Determine final plan status
        // If we already had an approved plan, keep it approved (execution phase)
        // If we just got a pending plan, mark it pending
        // If we're in execution phase with no existing plan, no plan part needed
        let finalPlanPart: MessagePlanPart | undefined
        if (isPlanMode) {
          if (isExecutionPhase) {
            // Keep existing approved plan
            finalPlanPart = existingPlanPart
          } else if (!isPendingPlan) {
            // New pending plan from this generation
            finalPlanPart = {
              type: 'plan',
              planText: planTextFromResult,
              status: 'pending',
            }
          } else {
            // This shouldn't happen - pending plan should already exist
            finalPlanPart = existingPlanPart
          }
        }

        // Build final content parts - remove any existing plan part and add the final one
        const finalContentParts: Message['contentParts'] = targetMsg.contentParts.filter((part) => part.type !== 'plan')
        if (finalPlanPart) {
          finalContentParts.push(finalPlanPart)
        }
        if (executionAgentImageFlowInstructions) {
          const fallbackGenerateImagePart = await maybeAutoStartAgentImageFlow(finalContentParts)
          if (fallbackGenerateImagePart) {
            finalContentParts.push(fallbackGenerateImagePart)
          }
        }

        targetMsg = {
          ...targetMsg,
          generating: false,
          cancel: undefined,
          contentParts: finalContentParts,
          tokensUsed:
            targetMsg.tokensUsed ??
            result.usage?.totalTokens ??
            estimateTokensFromMessages([...promptMsgs, targetMsg]),
          status: [],
          finishReason: result.finishReason,
          usage: result.usage,
          tokenSpeed: lastTokenSpeed ?? targetMsg.tokenSpeed,
          // Persist search citations extracted from tool calls or Gemini grounding
          citations: result.citations ?? targetMsg.citations,
          searchQuery: result.searchQuery ?? targetMsg.searchQuery,
          searchProvider: result.searchProvider ?? targetMsg.searchProvider,
          groundingMetadata: result.groundingMetadata ?? targetMsg.groundingMetadata,
        }
        await modifyMessage(sessionId, targetMsg, true)

        // Execute post-turn hooks after generation (only in execution phase or non-plan mode)
        if (isAgentEnabled && copilotOverrides?.hooks?.postTurn) {
          const outputText = result.text ?? ''
          const { executePostHooks } = await import('@/packages/copilot-hooks')
          await executePostHooks(copilotOverrides.hooks.postTurn, outputText)
        }

        // In plan mode with pending plan, don't process queued messages yet - wait for approval
        if (isPlanMode && !isExecutionPhase && !isPendingPlan) {
          // Planning phase just completed with pending plan - wait for user approval
          return
        }

        shouldProcessQueuedMessages = true
        break
      }
      // Picture message generation
      case 'picture': {
        // Take the most recent user message before the current message as prompt
        const userMessage = messages.slice(0, targetMsgIx).findLast((m) => m.role === 'user')
        if (!userMessage) {
          // Should not happen - user message not found
          throw new Error('No user message found')
        }

        const insertImage = async (image: MessageImagePart) => {
          targetMsg.contentParts.push(image)
          targetMsg.status = []
          await modifyMessage(sessionId, targetMsg, true)
        }
        await generateImage(
          model,
          {
            message: userMessage,
            num: effectiveSettings.imageGenerateNum || 1,
          },
          async (picBase64) => {
            const storageKey = StorageKeyGenerator.picture(`${session.id}:${targetMsg.id}`)
            // Image needs to be stored in indexedDB, if using OpenAI's image link directly, the link will expire over time
            await storage.setBlob(storageKey, picBase64)
            await insertImage({ type: 'image', storageKey })
          }
        )
        targetMsg = {
          ...targetMsg,
          generating: false,
          cancel: undefined,
          status: [],
        }
        await modifyMessage(sessionId, targetMsg, true)
        shouldProcessQueuedMessages = true
        break
      }
      default:
        throw new Error(`Unknown session type: ${session.type}, generate failed`)
    }
    appleAppStore.tickAfterMessageGenerated()
  } catch (err: unknown) {
    const error = !(err instanceof Error) ? new Error(`${err}`) : err
    const isExpectedOCRError = error instanceof OCRError && error.cause instanceof BaseError
    if (
      !(
        error instanceof ApiError ||
        error instanceof NetworkError ||
        error instanceof AIProviderNoImplementedPaintError ||
        isExpectedOCRError
      )
    ) {
      Sentry.captureException(error) // unexpected error should be reported
    }
    let errorCode: number | undefined
    if (err instanceof BaseError) {
      errorCode = err.code
    }
    const ocrError = error instanceof OCRError ? error : undefined
    const causeError = ocrError?.cause
    targetMsg = {
      ...targetMsg,
      generating: false,
      cancel: undefined,
      errorCode: ocrError ? (causeError instanceof BaseError ? causeError.code : errorCode) : errorCode,
      error: `${error.message}`,
      errorExtra: {
        aiProvider: ocrError ? ocrError.ocrProvider : effectiveSettings.provider,
        host:
          error instanceof NetworkError ? error.host : causeError instanceof NetworkError ? causeError.host : undefined,
        responseBody:
          error instanceof ApiError
            ? error.responseBody
            : causeError instanceof ApiError
              ? causeError.responseBody
              : undefined,
      },
      status: [],
    }
    await modifyMessage(sessionId, targetMsg, true)
    shouldProcessQueuedMessages = true
  }

  if (shouldProcessQueuedMessages) {
    // Run full compaction check in background after response is shown to user.
    // This handles modal prompts and summarization without blocking the send path.
    runCompactionWithUIState(sessionId).catch((err) => {
      console.warn('[generate] Post-response compaction failed:', err)
    })

    while (messageQueueStore.getState().getQueuedCount(sessionId) > 0) {
      const nextQueuedMessage = messageQueueStore.getState().dequeueMessage(sessionId)
      if (!nextQueuedMessage) {
        break
      }

      await submitNewUserMessage(sessionId, {
        newUserMsg: nextQueuedMessage.message,
        needGenerating: nextQueuedMessage.needGenerating,
      })

      if (nextQueuedMessage.needGenerating) {
        break
      }
    }
  }
}

/**
 * Insert and generate a new message below the target message
 * @param sessionId Session ID
 * @param msgId Message ID
 */
export async function generateMore(sessionId: string, msgId: string) {
  const newAssistantMsg = createMessage('assistant', '')
  newAssistantMsg.generating = true // prevent estimating token count before generating done
  await insertMessageAfter(sessionId, newAssistantMsg, msgId)
  const truncateTokenLimit = await getOverflowTruncateLimit(sessionId)
  await generate(sessionId, newAssistantMsg, { operationType: 'regenerate', truncateTokenLimit })
}

export async function generateMoreInNewFork(sessionId: string, msgId: string) {
  await createNewFork(sessionId, msgId)
  await generateMore(sessionId, msgId)
}

type GenerateMoreFn = (sessionId: string, msgId: string) => Promise<void>

export async function regenerateInNewFork(
  sessionId: string,
  msg: Message,
  options?: { runGenerateMore?: GenerateMoreFn }
) {
  const runGenerateMore = options?.runGenerateMore ?? generateMore
  const session = await chatStore.getSession(sessionId)
  if (!session) {
    return
  }
  const location = findMessageLocation(session, msg.id)
  if (!location) {
    const truncateTokenLimit = await getOverflowTruncateLimit(sessionId)
    await generate(sessionId, msg, { operationType: 'regenerate', truncateTokenLimit })
    return
  }
  const previousMessageIndex = location.index - 1
  if (previousMessageIndex < 0) {
    // If target message is the first message, regenerate directly
    const truncateTokenLimit = await getOverflowTruncateLimit(sessionId)
    await generate(sessionId, msg, { operationType: 'regenerate', truncateTokenLimit })
    return
  }
  const forkMessage = location.list[previousMessageIndex]
  await createNewFork(sessionId, forkMessage.id)
  return runGenerateMore(sessionId, forkMessage.id)
}

/**
 * Build message context for prompt
 * Process message list, including:
 * - Use buildContextForAI to build context based on compaction points (if provided)
 * - Limit context message count based on maxContextMessageCount
 * - Add ATTACHMENT_FILE tag for file attachments
 * - Add ATTACHMENT_FILE tag for link attachments
 *
 * @param settings Session settings
 * @param msgs Original message list
 * @param modelSupportToolUseForFile Whether model supports file reading tool (if supported, file content is not directly included)
 * @param options Optional configuration
 * @param options.storageAdapter Optional storage adapter for reading file content (defaults to storage.getBlob)
 * @param options.compactionPoints Optional compaction points for building context from compression point
 * @returns Processed message list
 */
export async function genMessageContext(
  settings: SessionSettings,
  msgs: Message[],
  modelSupportToolUseForFile: boolean,
  options?: {
    storageAdapter?: { getBlob: (key: string) => Promise<string> }
    compactionPoints?: CompactionPoint[]
    truncateTokenLimit?: number
  }
) {
  const storageAdapter = options?.storageAdapter
  const compactionPoints = options?.compactionPoints
  const truncateTokenLimit = options?.truncateTokenLimit
  const storageGetBlob = storageAdapter?.getBlob ?? ((key: string) => storage.getBlob(key).catch(() => ''))
  const {
    // openaiMaxContextTokens,
    maxContextMessageCount,
  } = settings
  if (msgs.length === 0) {
    throw new Error('No messages to replay')
  }
  if (maxContextMessageCount === undefined) {
    throw new Error('maxContextMessageCount is not set')
  }

  // Step 1: Apply compaction-based context building if compactionPoints are provided
  // This will return messages starting from the latest compaction point (with summary prepended)
  // and apply tool-call cleanup for older messages
  let contextMessages = msgs
  if (compactionPoints && compactionPoints.length > 0) {
    contextMessages = buildContextForAI({
      messages: msgs,
      compactionPoints,
      keepToolCallRounds: 2,
      sessionSettings: settings,
    })
  }

  // Pre-fetch all blob contents in parallel to avoid N+1 sequential fetches
  const allStorageKeys = new Set<string>()
  for (const msg of contextMessages) {
    if (msg.files) {
      for (const file of msg.files) {
        if (file.storageKey) {
          allStorageKeys.add(file.storageKey)
        }
      }
    }
    if (msg.links) {
      for (const link of msg.links) {
        if (link.storageKey) {
          allStorageKeys.add(link.storageKey)
        }
      }
    }
  }
  const blobContents = new Map<string, string>()
  if (allStorageKeys.size > 0) {
    const keys = Array.from(allStorageKeys)
    const contents = await Promise.all(keys.map((key) => storageGetBlob(key)))
    keys.forEach((key, index) => {
      const content = contents[index]
      if (content !== null) {
        blobContents.set(key, content)
      }
    })
  }

  const head = contextMessages[0]?.role === 'system' ? contextMessages[0] : undefined
  const workingMsgs = head ? contextMessages.slice(1) : contextMessages

  let _totalLen = head ? (head.tokenCount ?? estimateTokensFromMessages([head])) : 0
  const prompts: Message[] = []
  for (let i = workingMsgs.length - 1; i >= 0; i--) {
    let msg = workingMsgs[i]
    // Skip error messages
    if (msg.error || msg.errorCode) {
      continue
    }
    const baseSize = (msg.tokenCount ?? estimateTokensFromMessages([msg])) + 20 // 20 as estimated error compensation
    // When truncating, always add attachment payload estimates since msg.tokenCount
    // may be stale or text-only and not reflect freshly attached files/links.
    let attachmentTokens = 0
    if (truncateTokenLimit !== undefined) {
      if (msg.files) {
        for (const file of msg.files) {
          if (file.storageKey) {
            const content = blobContents.get(file.storageKey)
            if (content) {
              attachmentTokens += Math.ceil(content.length / 4) // rough ~4 chars per token
            }
          }
        }
      }
      if (msg.links) {
        for (const link of msg.links) {
          if (link.storageKey) {
            const content = blobContents.get(link.storageKey)
            if (content) {
              attachmentTokens += Math.ceil(content.length / 4)
            }
          }
        }
      }
    }
    const size = baseSize + attachmentTokens
    // Only OpenAI supports context tokens limit
    if (settings.provider === 'openai') {
      // if (size + totalLen > openaiMaxContextTokens) {
      //     break
      // }
    }
    if (
      maxContextMessageCount < Number.MAX_SAFE_INTEGER &&
      prompts.length >= maxContextMessageCount + 1 // +1 to keep user's last input message
    ) {
      break
    }
    // Token-budget truncation: stop adding older messages when we'd exceed the limit
    if (truncateTokenLimit !== undefined && prompts.length > 0 && _totalLen + size > truncateTokenLimit) {
      break
    }

    let attachmentIndex = 1
    if (msg.files && msg.files.length > 0) {
      for (const file of msg.files) {
        if (file.storageKey) {
          msg = cloneMessage(msg)
          const content = blobContents.get(file.storageKey) ?? ''
          if (content) {
            const fileLines = content.split('\n').length
            const shouldUseToolForThisFile = modelSupportToolUseForFile && fileLines > MAX_INLINE_FILE_LINES

            const prefix = buildAttachmentWrapperPrefix({
              attachmentIndex: attachmentIndex++,
              fileName: file.name,
              fileKey: file.storageKey,
              fileLines,
              fileSize: content.length,
            })

            let contentToAdd = content
            let isTruncated = false
            if (shouldUseToolForThisFile) {
              const lines = content.split('\n')
              contentToAdd = lines.slice(0, PREVIEW_LINES).join('\n')
              isTruncated = true
            }

            const suffix = buildAttachmentWrapperSuffix({
              isTruncated,
              previewLines: isTruncated ? PREVIEW_LINES : undefined,
              totalLines: isTruncated ? fileLines : undefined,
              fileKey: isTruncated ? file.storageKey : undefined,
            })

            const attachment = prefix + contentToAdd + '\n' + suffix
            msg = mergeMessages(msg, createMessage(msg.role, attachment))
          }
        }
      }
    }
    if (msg.links && msg.links.length > 0) {
      for (const link of msg.links) {
        if (link.storageKey) {
          msg = cloneMessage(msg)
          const content = blobContents.get(link.storageKey) ?? ''
          if (content) {
            const linkLines = content.split('\n').length
            const shouldUseToolForThisLink = modelSupportToolUseForFile && linkLines > MAX_INLINE_FILE_LINES

            const prefix = buildAttachmentWrapperPrefix({
              attachmentIndex: attachmentIndex++,
              fileName: link.title,
              fileKey: link.storageKey,
              fileLines: linkLines,
              fileSize: content.length,
            })

            let contentToAdd = content
            let isTruncated = false
            if (shouldUseToolForThisLink) {
              const lines = content.split('\n')
              contentToAdd = lines.slice(0, PREVIEW_LINES).join('\n')
              isTruncated = true
            }

            const suffix = buildAttachmentWrapperSuffix({
              isTruncated,
              previewLines: isTruncated ? PREVIEW_LINES : undefined,
              totalLines: isTruncated ? linkLines : undefined,
              fileKey: isTruncated ? link.storageKey : undefined,
            })

            const attachment = prefix + contentToAdd + '\n' + suffix
            msg = mergeMessages(msg, createMessage(msg.role, attachment))
          }
        }
      }
    }

    prompts.push(msg)
    _totalLen += size
  }
  prompts.reverse()
  if (head) {
    prompts.unshift(head)
  }
  return prompts
}

/**
 * Find the thread message list that a message belongs to
 * @param sessionId Session ID
 * @param messageId Message ID
 * @returns The thread message list containing the message
 */
export async function getMessageThreadContext(sessionId: string, messageId: string): Promise<Message[]> {
  const session = await chatStore.getSession(sessionId)
  if (!session) {
    return []
  }
  if (session.messages.find((m) => m.id === messageId)) {
    return session.messages
  }
  if (!session.threads) {
    return []
  }
  for (const t of session.threads) {
    if (t.messages.find((m) => m.id === messageId)) {
      return t.messages
    }
  }
  return []
}
