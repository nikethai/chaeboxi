import * as Sentry from '@sentry/react'
import { getModel } from '@shared/models'
import { AIProviderNoImplementedPaintError, ApiError, BaseError, NetworkError, OCRError } from '@shared/models/errors'
import type { OnResultChangeWithCancel } from '@shared/models/types'
import {
  COPILOT_MAX_STEPS_DEFAULT,
  type CompactionPoint,
  type CopilotHook,
  type CopilotToolAccess,
  createMessage,
  type Message,
  type MessageImagePart,
  type MessagePicture,
  ModelProviderEnum,
  type PlanPhase,
  type Session,
  type SessionSettings,
  type SessionType,
  type Settings,
} from '@shared/types'
import { cloneMessage, getMessageText, mergeMessages } from '@shared/utils/message'
import type { ToolSet } from 'ai'
import { getDefaultStore } from 'jotai'
import { createModelDependencies } from '@/adapters'
import { getAgentDetailById } from '@/packages/agents'
import * as appleAppStore from '@/packages/apple_app_store'
import { buildContextForAI } from '@/packages/context-management'
import {
  buildAttachmentWrapperPrefix,
  buildAttachmentWrapperSuffix,
  buildVideoAttachmentWrapper,
  MAX_INLINE_FILE_LINES,
  PREVIEW_LINES,
} from '@/packages/context-management/attachment-payload'
import { generateImage, streamText } from '@/packages/model-calls'
import { getModelDisplayName } from '@/packages/model-setting-utils'
import { buildSkillContextBlocks, resolveSkillActivations, selectCatalogForInject } from '@/packages/skills'
import { estimateTokensFromMessages } from '@/packages/token'
import { getVideoLimits } from '@/packages/video'
import platform from '@/platform'
import storage from '@/storage'
import { StorageKeyGenerator } from '@/storage/StoreStorage'
import { mergeSkillsList, refreshAgentSkills, userSkillsAtom } from '@/stores/skillsStore'
import { flushSessionTasks } from '@/stores/taskStore'
import { trackEvent } from '@/utils/track'
import { CHATBOX_BUILD_PLATFORM } from '@/variables'
import * as chatStore from '../chatStore'
import { settingsStore } from '../settingsStore'
import { uiStore } from '../uiStore'
import { createNewFork, findMessageLocation } from './forks'
import { messageQueueStore } from './messageQueue'
import { insertMessageAfter, modifyMessage, submitNewUserMessage } from './messages'
import { getSessionWebBrowsing } from './session-web-browsing'

export { getSessionWebBrowsing }

import {
  COMFYUI_AGENT_DEFAULT_NORMALIZATION_PROMPT,
  COMFYUI_AGENT_DEFAULT_RESEARCH_DOMAINS,
} from '@shared/providers/definitions/comfyui'
import type { MessagePlanPart, MessageToolCallPart } from '@shared/types'
import { runCompactionWithUIState } from '@/packages/context-management'

// Agent-only modules (toolsets, copilot hooks, agentImageFlow) are loaded
// dynamically inside the corresponding agent-mode code paths so they can be
// tree-shaken from the Android bundle. CHATBOX_BUILD_PLATFORM === 'android'
// gates ensure the dynamic imports never execute on mobile.
const isAgentEnabled = CHATBOX_BUILD_PLATFORM !== 'android'
const planDecisionInFlight = new Set<string>()

function getMessageFromSession(session: Session, messageId: string): Message | null {
  const location = findMessageLocation(session, messageId)
  return location ? location.list[location.index] : null
}

function getPlanPart(message: Message): MessagePlanPart | null {
  return message.contentParts.find((part): part is MessagePlanPart => part.type === 'plan') ?? null
}

function withPlanPart(
  contentParts: Message['contentParts'],
  planPart: MessagePlanPart | undefined
): Message['contentParts'] {
  if (!planPart) return contentParts
  const withoutPlan = contentParts.filter((part) => part.type !== 'plan')
  return [...withoutPlan, planPart]
}

function withPlanStatus(message: Message, status: MessagePlanPart['status']): Message {
  let found = false
  const contentParts = message.contentParts.map((part) => {
    if (part.type !== 'plan') return part
    found = true
    return { ...part, status }
  })
  if (!found) {
    throw new Error('The proposed plan is no longer available.')
  }
  return { ...message, contentParts }
}

async function updatePendingPlanStatus(
  sessionId: string,
  messageId: string,
  status: Extract<MessagePlanPart['status'], 'approved' | 'rejected'>
): Promise<{ message: Message; plan: MessagePlanPart }> {
  const session = await chatStore.getSession(sessionId)
  if (!session) {
    throw new Error('The session is no longer available.')
  }
  const message = getMessageFromSession(session, messageId)
  if (!message || message.generating) {
    throw new Error('The proposed plan is no longer available.')
  }
  const plan = getPlanPart(message)
  if (!plan || plan.status !== 'pending') {
    throw new Error('This plan has already been decided.')
  }
  const updatedMessage = withPlanStatus(message, status)
  await modifyMessage(sessionId, updatedMessage, true)
  return { message: updatedMessage, plan }
}

export async function approveAndExecutePlan(sessionId: string, messageId: string) {
  const key = `${sessionId}:${messageId}`
  if (planDecisionInFlight.has(key)) return
  planDecisionInFlight.add(key)
  try {
    await updatePendingPlanStatus(sessionId, messageId, 'approved')
    await chatStore.updateSession(sessionId, { planPhase: 'executing' })

    const session = await chatStore.getSession(sessionId)
    const message = session ? getMessageFromSession(session, messageId) : null
    if (!session || !message) {
      throw new Error('The approved plan could not be resumed.')
    }
    await generate(sessionId, message, { operationType: 'send_message', prefetchedSession: session })
  } finally {
    planDecisionInFlight.delete(key)
  }
}

export async function rejectPlan(sessionId: string, messageId: string) {
  const key = `${sessionId}:${messageId}`
  if (planDecisionInFlight.has(key)) return
  planDecisionInFlight.add(key)
  try {
    await updatePendingPlanStatus(sessionId, messageId, 'rejected')
    await chatStore.updateSession(sessionId, { planPhase: undefined })
  } finally {
    planDecisionInFlight.delete(key)
  }
}

export async function requestPlanChanges(sessionId: string, messageId: string, feedback: string) {
  const trimmedFeedback = feedback.trim()
  if (!trimmedFeedback) {
    throw new Error('Describe the changes you want before requesting a revision.')
  }

  const key = `${sessionId}:${messageId}`
  if (planDecisionInFlight.has(key)) return
  planDecisionInFlight.add(key)
  try {
    const { plan } = await updatePendingPlanStatus(sessionId, messageId, 'rejected')
    await chatStore.updateSession(sessionId, { planPhase: 'planning' })
    await submitNewUserMessage(sessionId, {
      newUserMsg: createMessage(
        'user',
        `Please revise the proposed plan based on this feedback. Do not execute the task yet.\n\n## Previous plan\n${plan.planText}\n\n## Feedback\n${trimmedFeedback}`
      ),
      needGenerating: true,
    })
  } finally {
    planDecisionInFlight.delete(key)
  }
}

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
    const { startComfyUIAgentGeneration } = await import('@/packages/model-calls/toolsets/generate-image')
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
You have access to **read-only** tools only:
- web_search / parse_link (when browsing is enabled)
- read_file / search_file_content for **uploaded chat attachments** (fileKey) when present
- knowledge_base search when a knowledge base is selected

You do **NOT** have create_file, edit_file, delete_file, or terminal in planning mode.
After the user approves the plan, execution will use workspace write + terminal tools (desktop, when a workspace folder is set).

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

  // Attachment read tools only (no create/edit/delete) — honest for planning
  const attachmentTools =
    fileToolSetModule.attachmentFileTools ?? fileToolSetModule.attachmentFileToolSet?.tools ?? fileToolSet?.tools
  if (attachmentTools?.read_file) {
    tools.read_file = attachmentTools.read_file
  }
  if (attachmentTools?.search_file_content) {
    tools.search_file_content = attachmentTools.search_file_content
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

  // Build instructions string — attachment description only (never workspace write docs)
  if (websearchToolSet?.description) {
    instructions += '\n\n' + websearchToolSet.description
  }
  const attachmentDescription =
    fileToolSetModule.attachmentFileToolSetDescription ??
    fileToolSetModule.attachmentFileToolSet?.description ??
    fileToolSet?.description
  if (attachmentDescription) {
    instructions += '\n\n' + attachmentDescription
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
 * Retrieve agent model-settings overrides (built-in, local custom, remote catalog).
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
  const detail = getAgentDetailById(copilotId)
  if (!detail) return null
  return { ...detail.modelSettings, maxSteps: detail.maxSteps, toolAccess: detail.toolAccess, hooks: detail.hooks }
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
    /** Explicit speaker persona (multi-agent room or @ single agent) */
    speakerAgentId?: string
    /** Inject Slack-style room protocol; tools forced off when true */
    roomMulti?: boolean
    /** Multi-agent turn kind: short discussion vs final synthesis */
    roomRole?: 'turn' | 'synthesis'
    /** Display names of all room participants for protocol text */
    participantNames?: string[]
    /** Skip processing message queue after this turn (intermediate multi-agent turns) */
    skipQueuedMessages?: boolean
  }
) {
  let shouldProcessQueuedMessages = false
  let activeExecutionPlan: MessagePlanPart | undefined
  let managesPlanPhase = false
  // Get dependent data — use pre-fetched values when available to avoid redundant async lookups
  const session = options?.prefetchedSession ?? (await chatStore.getSession(sessionId))
  const settings = options?.prefetchedSettings ?? (await chatStore.getSessionSettings(sessionId))
  const globalSettings = settingsStore.getState().getSettings()
  const configs = await platform.getConfig()
  if (!session || !settings) {
    return
  }

  // Overlay agent/copilot model settings. Prefer explicit speaker → message.agentId → room primary.
  const speakerAgentId = options?.speakerAgentId ?? targetMsg.agentId ?? session.agentIds?.[0] ?? session.copilotId
  const copilotOverrides = getCopilotSettings(speakerAgentId)
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

  // Re-fetch session after insert/modify so multi-agent turns always see the new message.
  // Using the pre-modify snapshot can miss just-inserted assistant rows (silent empty turns).
  const sessionForMessages = (await chatStore.getSession(sessionId)) ?? session
  let messages = sessionForMessages.messages
  let targetMsgIx = messages.findIndex((m) => m.id === targetMsg.id)
  if (targetMsgIx < 0) {
    if (sessionForMessages.threads) {
      for (const t of sessionForMessages.threads) {
        messages = t.messages
        targetMsgIx = messages.findIndex((m) => m.id === targetMsg.id)
        if (targetMsgIx >= 0) {
          break
        }
      }
    }
    if (targetMsgIx < 0) {
      targetMsg = {
        ...targetMsg,
        generating: false,
        cancel: undefined,
        error: 'Failed to locate assistant message in session',
      }
      await modifyMessage(sessionId, targetMsg, true)
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
    authReadySettings = await refreshGeminiAntigravityAuthIfNeeded(authReadySettings, effectiveSettings.provider)
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
    // Multi-agent room discussion: no tool loops (v1)
    const roomMulti = Boolean(options?.roomMulti)
    const maxSteps =
      !roomMulti && isAgentEnabled && session.agentMode
        ? (copilotOverrides?.maxSteps ?? COPILOT_MAX_STEPS_DEFAULT)
        : undefined
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

        // Per-speaker agent system prompt (persona + optional room protocol)
        // Uses same catalog as @ picker (built-in + local + remote)
        if (speakerAgentId && effectiveSettings.provider !== ModelProviderEnum.OpenClaw) {
          const agentDetail = getAgentDetailById(speakerAgentId)
          const speakerName = agentDetail?.name || targetMsg.name || speakerAgentId
          const names = options?.participantNames?.length ? options.participantNames : [speakerName]
          const roomRole = options?.roomRole ?? targetMsg.roomRole
          if (agentDetail?.prompt || roomMulti) {
            const { buildRoomProtocol, buildSynthesisProtocol } = await import('@shared/agent-room')
            let protocol = ''
            if (roomMulti) {
              protocol =
                roomRole === 'synthesis'
                  ? buildSynthesisProtocol(speakerName, names)
                  : buildRoomProtocol(speakerName, names)
            }
            const persona = agentDetail?.prompt?.trim() || `You are "${speakerName}", a helpful AI participant.`
            const systemText = protocol ? `${persona}\n\n${protocol}` : persona
            // Replace leading session system message with this speaker's persona
            if (promptMsgs[0]?.role === 'system') {
              promptMsgs = [createMessage('system', systemText), ...promptMsgs.slice(1)]
            } else {
              promptMsgs = [createMessage('system', systemText), ...promptMsgs]
            }
            // Label history assistants with catalog names for multi-agent context
            promptMsgs = promptMsgs.map((m) => {
              if (m.role === 'assistant' && m.agentId && !m.name) {
                const named = getAgentDetailById(m.agentId)
                return named ? { ...m, name: named.name } : m
              }
              return m
            })
          }

          // Multi-agent: history often ends on assistant after prior speakers. Providers
          // (esp. Gemini) frequently return empty completions unless the last message is user.
          if (roomMulti) {
            const lastPrompt = promptMsgs[promptMsgs.length - 1]
            if (lastPrompt?.role === 'assistant') {
              const { buildRoomContinuePrompt } = await import('@shared/agent-room')
              promptMsgs = [
                ...promptMsgs,
                createMessage(
                  'user',
                  buildRoomContinuePrompt(speakerName, roomRole === 'synthesis' ? 'synthesis' : 'turn')
                ),
              ]
            }
          }
        }

        // Execute pre-turn hooks and prepend context to messages (skip in multi-agent room for cost/noise)
        const preHookContext =
          !roomMulti && isAgentEnabled && copilotOverrides?.hooks?.preTurn
            ? await (await import('@/packages/copilot-hooks')).executePreHooks(copilotOverrides.hooks.preTurn)
            : ''
        if (preHookContext) {
          promptMsgs.unshift(createMessage('system', preHookContext))
        }

        // Check for existing plan in targetMsg (for 2-phase execution)
        const existingPlanPart = targetMsg.contentParts.find((part): part is MessagePlanPart => part.type === 'plan')
        const isExecutionPhase = existingPlanPart?.status === 'approved'
        activeExecutionPlan = isExecutionPhase ? existingPlanPart : undefined

        // If we have an approved plan, inject it into the prompt for context
        if (isExecutionPhase && existingPlanPart) {
          const workspaceHint = session.workspaceRoot
            ? `Workspace root: ${session.workspaceRoot}. Use create_file / edit_file / terminal under this root.`
            : 'No workspace folder is set — filesystem write and terminal tools are unavailable until the user sets one.'
          const planInjection = createMessage(
            'system',
            `## APPROVED EXECUTION PLAN\n\n${existingPlanPart.planText}\n\nProceed with executing this plan using all available tools.\n\n${workspaceHint}`
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
            contentParts: updated.contentParts
              ? withPlanPart(updated.contentParts, activeExecutionPlan)
              : targetMsg.contentParts,
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
        // Room multi-agent: tools off (discussion-only)
        const isPlanMode = Boolean(!roomMulti && isAgentEnabled && session.agentMode && effectiveSettings.planMode)
        const isPendingPlan = existingPlanPart?.status === 'pending'
        managesPlanPhase = isPlanMode

        // Determine which tools to use based on phase
        let toolsToUse: ToolSet | undefined
        let planningToolsInstructions = ''
        const executionAgentImageFlowInstructions =
          roomMulti || !(!isPlanMode || isExecutionPhase) ? undefined : agentImageFlowInstructions

        if (isPlanMode && !isExecutionPhase) {
          // Planning phase: use read-only tools
          const readonlyTools = await getReadOnlyToolsForPlanning(
            knowledgeBase ? { id: knowledgeBase.id, name: knowledgeBase.name } : undefined
          )
          toolsToUse = readonlyTools.tools
          planningToolsInstructions = readonlyTools.instructions
        }
        // Room multi: hard-disable tools. Passing `undefined` still lets streamText
        // attach MCP + web_search (useCustomTools=false). Empty object = no tools.
        if (roomMulti) {
          toolsToUse = {}
        }

        // Inject planning tools instructions into system prompt if in planning phase
        if (planningToolsInstructions) {
          const planningSystemMsg = createMessage('system', planningToolsInstructions)
          promptMsgs.unshift(planningSystemMsg)
        }

        // Skills: progressive catalog + activated bodies (explicit $ / pin / auto)
        // Ensure agent folders have been scanned at least once this session.
        try {
          await refreshAgentSkills()
        } catch {
          // non-fatal — builtins + user skills still work
        }
        const priorUserMsg = [...messages.slice(0, targetMsgIx)].reverse().find((m) => m.role === 'user')
        const storedUserSkills = getDefaultStore().get(userSkillsAtom)
        const skillPackages = mergeSkillsList(Array.isArray(storedUserSkills) ? storedUserSkills : [])
        const skillActivations = resolveSkillActivations({
          skills: skillPackages,
          explicitSkillIds: priorUserMsg?.skillIds,
          pinnedSkillIds: session.pinnedSkillIds,
          userText: priorUserMsg ? getMessageText(priorUserMsg) : '',
          autoSkills: session.autoSkills,
        })
        const skillById = new Map(skillPackages.map((s) => [s.id, s]))
        const skillCatalog = selectCatalogForInject(skillPackages, skillActivations)
        const skillContext = buildSkillContextBlocks(skillCatalog, skillActivations, skillById)
        if (skillContext) {
          promptMsgs.unshift(createMessage('system', skillContext))
        }
        // Show skill chips only on normal replies or room synthesis (not every discussion turn)
        const showSkillChips =
          skillActivations.length > 0 &&
          (!roomMulti || options?.roomRole === 'synthesis' || !options?.roomRole)
        if (showSkillChips) {
          targetMsg = { ...targetMsg, skillActivations }
          await modifyMessage(sessionId, targetMsg, false, true)
        }

        // Agent coding tools (workspace write + terminal) only on execute turns, not plan-only
        const isAgentExecuteTurn =
          !roomMulti && isAgentEnabled && Boolean(session.agentMode) && (!isPlanMode || isExecutionPhase)

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
          // Discussion/synthesis: pure chat only — no KB, web, or tool loops
          knowledgeBase: roomMulti ? undefined : knowledgeBase,
          webBrowsing: roomMulti ? false : webBrowsing,
          nativeWebSearch: roomMulti ? undefined : useGeminiGrounding ? 'gemini-grounding' : undefined,
          agentImageFlowInstructions: executionAgentImageFlowInstructions,
          agentCoding: {
            enabled: isAgentExecuteTurn,
            workspaceRoot: session.workspaceRoot,
          },
          maxSteps: roomMulti ? 1 : maxSteps,
          tools: toolsToUse,
          toolAccess: copilotOverrides?.toolAccess,
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
        let finalContentParts: Message['contentParts'] = targetMsg.contentParts.filter((part) => part.type !== 'plan')
        // Backfill from result.text when streaming left contentParts empty (common on some providers)
        const hasTextPart = finalContentParts.some((p) => p.type === 'text' && p.text?.trim())
        if (!hasTextPart && result.text?.trim()) {
          finalContentParts = [{ type: 'text', text: result.text }, ...finalContentParts]
        }
        // Room multi: strip model-echoed "**Name:**" prefixes (UI already shows speaker header)
        if (roomMulti && (targetMsg.name || speakerAgentId)) {
          const speakerLabel = targetMsg.name || speakerAgentId || ''
          const prefixRe = new RegExp(
            `^\\*\\*\\s*${speakerLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*\\*\\*\\s*`,
            'i'
          )
          finalContentParts = finalContentParts.map((part) => {
            if (part.type !== 'text' || !part.text) return part
            return { ...part, text: part.text.replace(prefixRe, '') }
          })
        }
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
            targetMsg.tokensUsed ?? result.usage?.totalTokens ?? estimateTokensFromMessages([...promptMsgs, targetMsg]),
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
        await flushSessionTasks(sessionId)

        if (isExecutionPhase) {
          await chatStore.updateSession(sessionId, { planPhase: undefined })
        }

        // Execute post-turn hooks after generation (only in execution phase or non-plan mode)
        if (!roomMulti && isAgentEnabled && copilotOverrides?.hooks?.postTurn) {
          const outputText = result.text ?? ''
          const { executePostHooks } = await import('@/packages/copilot-hooks')
          await executePostHooks(copilotOverrides.hooks.postTurn, outputText)
        }

        // In plan mode with pending plan, don't process queued messages yet - wait for approval
        if (isPlanMode && !isExecutionPhase && !isPendingPlan) {
          // Planning phase just completed with pending plan - wait for user approval
          await chatStore.updateSession(sessionId, { planPhase: 'awaiting_approval' })
          return
        }

        shouldProcessQueuedMessages = !options?.skipQueuedMessages
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
      contentParts: withPlanPart(targetMsg.contentParts, activeExecutionPlan),
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
    if (managesPlanPhase) {
      await chatStore.updateSession(sessionId, { planPhase: undefined })
    }
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
  // Skip video blobs (large binary data URLs) — videos only need metadata tags
  const allStorageKeys = new Set<string>()
  for (const msg of contextMessages) {
    if (msg.files) {
      for (const file of msg.files) {
        if (file.storageKey && file.mediaKind !== 'video') {
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
      const videoLimits = getVideoLimits(platform.formFactor === 'desktop' ? 'desktop' : 'mobile')
      for (const file of msg.files) {
        if (!file.storageKey) {
          continue
        }

        // Video attachments: metadata only (frames already in contentParts as images)
        if (file.mediaKind === 'video') {
          msg = cloneMessage(msg)
          const attachment = buildVideoAttachmentWrapper({
            attachmentIndex: attachmentIndex++,
            fileName: file.name,
            fileKey: file.storageKey,
            durationSec: file.durationSec,
            byteLength: file.byteLength,
            width: file.width,
            height: file.height,
            sampledFrameCount: file.sampledFrameKeys?.length ?? 0,
            maxFramesPerTurn: videoLimits.maxFramesPerVideoPerTurn,
            toolEnabled: modelSupportToolUseForFile,
          })
          msg = mergeMessages(msg, createMessage(msg.role, attachment))
          continue
        }

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
