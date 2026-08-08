import NiceModal from '@ebay/nice-modal-react'
import { ActionIcon, Box, Button, Flex, Stack, Text, Textarea, Tooltip, UnstyledButton } from '@mantine/core'
import { useViewportSize } from '@mantine/hooks'
import {
  getFileAcceptString,
  getUnsupportedFileI18nKey,
  isAiReadableImageFile,
  isAiReadableVideoFile,
  isSupportedFile,
} from '@shared/file-extensions'
import { getOrCreateGatewayClient } from '@shared/models/openclaw'
import { getModel } from '@shared/providers'
import {
  IconAlertCircle,
  IconArrowUp,
  IconChevronRight,
  IconFolder,
  IconLoader2,
  IconPlayerStopFilled,
} from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import _, { pick } from 'lodash'
import type React from 'react'
import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { createModelDependencies } from '@/adapters'
import { useMyCopilots, useRemoteCopilots } from '@/hooks/useCopilots'
import useInputBoxHistory from '@/hooks/useInputBoxHistory'
import { useKnowledgeBase } from '@/hooks/useKnowledgeBase'
import { useMessageInput } from '@/hooks/useMessageInput'
import { useProviders } from '@/hooks/useProviders'
import { useIsSmallScreen } from '@/hooks/useScreenChange'
import { cn } from '@/lib/utils'
import { navigateToSettings } from '@/modals/Settings'
import type { GatewayCommandInfo } from '@/openclaw/gateway'
import { getActiveAgentAtQuery, stripActiveAgentAtToken } from '@/packages/agents'
import {
  getContextMessageIds,
  isAutoCompactionEnabled,
  isCompactionInProgress,
  useContextTokens,
} from '@/packages/context-management'
import { trackingEvent } from '@/packages/event'
import { replacePromptTemplateVars } from '@/packages/model-calls/message-utils'
import { getModelContextWindowSync } from '@/packages/model-context'
import * as picUtils from '@/packages/pic_utils'
import { extractSkillNamesFromText, getActiveSkillDollarQuery, stripSkillDollarTokens } from '@/packages/skills'
import { formatBytesForDisplay, formatDurationForDisplay, getVideoLimits } from '@/packages/video'
import { isWebSearchConfigured } from '@/packages/web-search/is-configured'
import platform from '@/platform'
import storage from '@/storage'
import { StorageKeyGenerator } from '@/storage/StoreStorage'
import * as atoms from '@/stores/atoms'
import { compactionUIStateMapAtom } from '@/stores/atoms/compactionAtoms'
import { composerTokenMenuAtom } from '@/stores/atoms/uiAtoms'
import * as chatStore from '@/stores/chatStore'
import { useSession, useSessionSettings } from '@/stores/chatStore'
import { usePromptPresets } from '@/stores/promptPresetsStore'
import { settingsStore, useSettingsStore } from '@/stores/settingsStore'
import { useSkills } from '@/stores/skillsStore'
import { useUIStore } from '@/stores/uiStore'
import { delay } from '@/utils'
import { trackEvent } from '@/utils/track'
import { CHATBOX_BUILD_PLATFORM } from '@/variables'
import type { KnowledgeBase, Message, SessionType, ShortcutSendValue, SkillPackage } from '../../../shared/types'
import { type AgentDetail, MAX_ROOM_AGENTS, ModelProviderEnum, SKILL_EXPLICIT_MAX } from '../../../shared/types'
import * as dom from '../../hooks/dom'
import * as sessionHelpers from '../../stores/sessionHelpers'
import * as toastActions from '../../stores/toastActions'
import AgentRoomStrip from '../chat/AgentRoomStrip'
import TeamRoomActions from '../chat/TeamRoomActions'
import { CompactionStatus } from '../chat/CompactionStatus'
import { CompressionModal } from '../common/CompressionModal'
import { ScalableIcon } from '../common/ScalableIcon'
import ProviderImageIcon from '../icons/ProviderImageIcon'
import ModelSelector from '../ModelSelector'
import AgentPicker, { filterAgents } from './AgentPicker'
import { FileMiniCard, ImageMiniCard, LinkMiniCard } from './Attachments'
import ComposerToolsMenu from './ComposerToolsMenu'
import TeamModeSelect from './TeamModeSelect'
import { ImageUploadInput } from './ImageUploadInput'
import OpenClawCommandPicker, { filterOpenClawCommands, getCommandAlias } from './OpenClawCommandPicker'
import PresetPicker, { filterPresets } from './PresetPicker'
import {
  cleanupFile,
  cleanupLink,
  markFileProcessing,
  markLinkProcessing,
  onFileProcessed,
  onLinkProcessed,
  storeFilePromise,
  storeLinkPromise,
} from './preprocessState'
import QueuedMessageList from './QueuedMessageList'
import SkillPicker, { filterSkills } from './SkillPicker'

export type InputBoxPayload = {
  constructedMessage: Message
  needGenerating?: boolean
  onUserMessageReady?: () => void
}

export type InputBoxRef = {
  setQuote: (quote: string) => void
}

export type InputBoxProps = {
  sessionId?: string
  sessionType?: SessionType
  generating?: boolean
  model?: {
    provider: string
    modelId: string
  }
  fullWidth?: boolean
  onSelectModel?(provider: string, model: string): void
  onSubmit?(payload: InputBoxPayload): Promise<void>
  onStopGenerating?(): boolean
  onStartNewThread?(): boolean
  onRollbackThread?(): boolean
  onClickSessionSettings?(): boolean | Promise<boolean>
  agentMode?: boolean
  onToggleAgentMode?(enabled: boolean): void
  workspaceRoot?: string
  onWorkspaceRootChange?(workspaceRoot: string | undefined): void
  /** Prefill composer (e.g. empty-state starters). Remount with a new key when changing. */
  initialMessage?: string
  /**
   * Blank / new-chat draft room members (sessionId === 'new' has no chatStore session).
   * Used for Team mode visibility and room strip.
   */
  draftAgentIds?: string[]
  draftRoomMode?: 'discuss' | 'work'
  onDraftRoomModeChange?(mode: 'discuss' | 'work'): void
}

const InputBox = forwardRef<InputBoxRef, InputBoxProps>(
  (
    {
      sessionId,
      sessionType = 'chat',
      generating = false,
      model,
      fullWidth = false,
      onSelectModel,
      onSubmit,
      onStopGenerating,
      onStartNewThread,
      onRollbackThread,
      onClickSessionSettings,
      agentMode: controlledAgentMode,
      onToggleAgentMode,
      workspaceRoot: controlledWorkspaceRoot,
      onWorkspaceRootChange,
      initialMessage = '',
      draftAgentIds,
      draftRoomMode,
      onDraftRoomModeChange,
    },
    ref
  ) => {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const isSmallScreen = useIsSmallScreen()
    const toolbarIconSize = isSmallScreen ? 22 : 18
    const toolbarButtonClass = cn(
      'flex items-center gap-1 rounded-lg hover:bg-[var(--chatbox-background-tertiary)] transition-colors',
      isSmallScreen ? 'px-2.5 py-1.5 rounded-xl min-h-9' : 'px-2 py-1'
    )
    const { height: viewportHeight } = useViewportSize()
    const pasteLongTextAsAFile = useSettingsStore((state) => state.pasteLongTextAsAFile)
    const shortcuts = useSettingsStore((state) => state.shortcuts)
    const widthFull = fullWidth

    const currentSessionId = sessionId
    const isNewSession = currentSessionId === 'new'

    // Session-level web browsing mode (default ON when search is configured)
    const sessionWebBrowsingMap = useUIStore((s) => s.sessionWebBrowsingMap)
    const setSessionWebBrowsing = useUIStore((s) => s.setSessionWebBrowsing)
    const updateCurrentWebBrowsingDisplay = useUIStore((s) => s.updateCurrentWebBrowsingDisplay)
    const extensionWebSearch = useSettingsStore((s) => s.extension.webSearch)
    const webSearchConfigured = useMemo(() => isWebSearchConfigured(extensionWebSearch), [extensionWebSearch])
    const webBrowsingMode = useMemo(() => {
      const sessionValue = sessionWebBrowsingMap[currentSessionId || 'new']
      if (sessionValue !== undefined) {
        return sessionValue
      }
      return webSearchConfigured
    }, [sessionWebBrowsingMap, currentSessionId, webSearchConfigured])

    // this is used for keyboard shortcut. if we don't provide this, kbd wont know what to set when it's a new session(it doesnt have provider info)
    useEffect(() => {
      updateCurrentWebBrowsingDisplay(currentSessionId || 'new', webBrowsingMode)
    }, [currentSessionId, webBrowsingMode, updateCurrentWebBrowsingDisplay])

    const setWebBrowsingMode = useCallback(
      (enabled: boolean) => {
        setSessionWebBrowsing(currentSessionId || 'new', enabled)
      },
      [currentSessionId, setSessionWebBrowsing]
    )

    const { messageInput, setMessageInput, clearDraft } = useMessageInput(initialMessage, { isNewSession })
    const { promptPresets } = usePromptPresets()
    const { enabledSkills, skills: allSkills } = useSkills()
    /** Session-sticky skill chips selected via $ */
    const [selectedSkills, setSelectedSkills] = useState<SkillPackage[]>([])
    const [skillPickerDismissed, setSkillPickerDismissed] = useState(false)
    const [skillHighlightIndex, setSkillHighlightIndex] = useState(0)
    /** Turn-sticky agent chips selected via @ */
    const [selectedAgents, setSelectedAgents] = useState<AgentDetail[]>([])
    const [agentPickerDismissed, setAgentPickerDismissed] = useState(false)
    const [agentHighlightIndex, setAgentHighlightIndex] = useState(0)
    const { copilots: myAgents } = useMyCopilots()
    const { copilots: remoteAgents } = useRemoteCopilots()
    const allAgents = useMemo(() => {
      const map = new Map<string, AgentDetail>()
      for (const a of myAgents) map.set(a.id, a)
      for (const a of remoteAgents || []) {
        if (!map.has(a.id)) map.set(a.id, a)
      }
      return Array.from(map.values())
    }, [myAgents, remoteAgents])

    // Pre-constructed message state (scoped by session)
    const [preConstructedMessage, setPreConstructedMessage] = useAtom(
      atoms.inputBoxPreConstructedMessageFamily(currentSessionId || 'new')
    )
    const pictureKeys = preConstructedMessage.pictureKeys || []
    const attachments = preConstructedMessage.attachments || []

    const { session: currentSession } = useSession(sessionId || null)
    const { sessionSettings: currentSessionMergedSettings } = useSessionSettings(sessionId || null)
    const agentMode = controlledAgentMode ?? currentSession?.agentMode ?? false
    const workspaceRoot = controlledWorkspaceRoot ?? currentSession?.workspaceRoot
    const isOpenClawModel = model?.provider === ModelProviderEnum.OpenClaw
    const showWorkspaceHint =
      agentMode &&
      !workspaceRoot &&
      !isOpenClawModel &&
      CHATBOX_BUILD_PLATFORM !== 'android' &&
      CHATBOX_BUILD_PLATFORM !== 'web' &&
      Boolean(onWorkspaceRootChange)

    const toggleAgentMode = useCallback(() => {
      onToggleAgentMode?.(!agentMode)
      dom.focusMessageInput()
    }, [agentMode, onToggleAgentMode])

    // Get current messages for token counting - will only recalculate when stable messages actually change
    // Uses getContextMessageIds to respect compaction points
    const currentContextMessageIds = useMemo(() => {
      if (isNewSession) return null
      if (!currentSession?.messages.length) return null

      return getContextMessageIds(currentSession, currentSessionMergedSettings?.maxContextMessageCount)
    }, [isNewSession, currentSessionMergedSettings?.maxContextMessageCount, currentSession])

    const { knowledgeBase, setKnowledgeBase } = useKnowledgeBase({ isNewSession })

    const [showCompressionModal, setShowCompressionModal] = useState(false)

    const [links, setLinks] = useAtom(atoms.inputBoxLinksFamily(currentSessionId || 'new'))
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isSamplingVideoFrames, setIsSamplingVideoFrames] = useState(false)
    const [visionBannerDismissed, setVisionBannerDismissed] = useState(false)

    useEffect(() => {
      const constructedMessage = sessionHelpers.constructUserMessage(
        messageInput,
        pictureKeys,
        preConstructedMessage.preprocessedFiles,
        preConstructedMessage.preprocessedLinks
      )
      setPreConstructedMessage((prev) => ({
        ...prev,
        text: messageInput,
        pictureKeys,
        attachments,
        links,
        message: constructedMessage,
      }))
    }, [
      messageInput,
      pictureKeys,
      attachments,
      links,
      preConstructedMessage.preprocessedFiles,
      preConstructedMessage.preprocessedLinks,
      setPreConstructedMessage,
    ])

    const pictureInputRef = useRef<HTMLInputElement | null>(null)
    const fileInputRef = useRef<HTMLInputElement | null>(null)

    // Check if any preprocessing is in progress
    const isPreprocessing = useMemo(() => {
      const hasProcessingFiles = Object.values(preConstructedMessage.preprocessingStatus.files || {}).some(
        (status) => status === 'processing'
      )
      const hasProcessingLinks = Object.values(preConstructedMessage.preprocessingStatus.links || {}).some(
        (status) => status === 'processing'
      )
      return hasProcessingFiles || hasProcessingLinks
    }, [preConstructedMessage.preprocessingStatus])

    // Check if any preprocessing has errors
    const hasPreprocessErrors = useMemo(() => {
      const hasErrorFiles = Object.values(preConstructedMessage.preprocessingStatus.files || {}).some(
        (status) => status === 'error'
      )
      const hasErrorLinks = Object.values(preConstructedMessage.preprocessingStatus.links || {}).some(
        (status) => status === 'error'
      )
      return hasErrorFiles || hasErrorLinks
    }, [preConstructedMessage.preprocessingStatus])

    const disableSubmit = useMemo(
      () => !(messageInput.trim() || links?.length || attachments?.length || pictureKeys?.length),
      [messageInput, links, attachments, pictureKeys]
    )

    const { providers } = useProviders()
    const modelSelectorDisplayText = useMemo(() => {
      if (!model) {
        return t('Select Model')
      }
      const providerInfo = providers.find((p) => p.id === model.provider)

      const modelInfo = (providerInfo?.models || providerInfo?.defaultSettings?.models)?.find(
        (m) => m.modelId === model.modelId
      )
      return `${modelInfo?.nickname || model.modelId}`
    }, [providers, model, t])

    const hasVideoAttachments = useMemo(() => {
      return (preConstructedMessage.preprocessedFiles || []).some((f) => f.mediaKind === 'video' && !f.error)
    }, [preConstructedMessage.preprocessedFiles])

    const modelSupportsVision = useMemo(() => {
      if (!model) return true
      const providerInfo = providers.find((p) => p.id === model.provider)
      const modelInfo = (providerInfo?.models || providerInfo?.defaultSettings?.models)?.find(
        (m) => m.modelId === model.modelId
      )
      // Unknown capability: don't nag; only warn when vision is explicitly absent
      if (!modelInfo?.capabilities) return true
      return modelInfo.capabilities.includes('vision')
    }, [providers, model])

    const showNonVisionVideoBanner = hasVideoAttachments && !modelSupportsVision && !visionBannerDismissed

    const videoLimitsForUi = useMemo(() => getVideoLimits(platform.formFactor === 'desktop' ? 'desktop' : 'mobile'), [])
    const videoDropLimitsHint = useMemo(
      () => ({
        minutes: Math.floor(videoLimitsForUi.maxDurationSec / 60),
        size: formatBytesForDisplay(videoLimitsForUi.maxFileBytes),
      }),
      [videoLimitsForUi]
    )

    // Re-show banner when a new successful video is attached after dismiss
    useEffect(() => {
      if (!hasVideoAttachments) {
        setVisionBannerDismissed(false)
      }
    }, [hasVideoAttachments])

    // Get model info for context window
    const modelInfo = useMemo(() => {
      if (!model) return null
      const providerInfo = providers.find((p) => p.id === model.provider)
      return (providerInfo?.models || providerInfo?.defaultSettings?.models)?.find((m) => m.modelId === model.modelId)
    }, [providers, model])

    // Check if model supports tool use for files
    const { data: modelSupportToolUseForFile = false } = useQuery({
      queryKey: ['model-tool-capability', model?.provider, model?.modelId],
      queryFn: async () => {
        if (!model?.provider || !model?.modelId) {
          return false
        }

        try {
          const globalSettings = settingsStore.getState().getSettings()
          const configs = await platform.getConfig()
          const dependencies = await createModelDependencies()

          const settings = {
            provider: model.provider,
            modelId: model.modelId,
            ...currentSessionMergedSettings,
          }

          const modelInstance = getModel(settings, globalSettings, configs, dependencies)
          return modelInstance.isSupportToolUse('read-file')
        } catch (e) {
          console.debug('useModelToolCapability: failed to check capability', e)
          return false
        }
      },
      enabled: !!(model?.provider && model?.modelId),
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
    })

    // Calculate token counts using unified cache layer
    const globalSettings = useSettingsStore((state) => state)
    const { contextTokens, currentInputTokens, totalTokens, isCalculating, pendingTasks, messageCount } =
      useContextTokens({
        sessionId: currentSessionId || null,
        session: currentSession,
        settings: currentSessionMergedSettings || {},
        globalSettings,
        model,
        modelSupportToolUseForFile,
        constructedMessage: preConstructedMessage.message,
      })

    const [isCompacting, setIsCompacting] = useState(false)

    const compactionUIStateMap = useAtomValue(compactionUIStateMapAtom)
    const isCompactionRunning = useMemo(() => {
      if (!currentSessionId || isNewSession) return false
      return compactionUIStateMap[currentSessionId]?.status === 'running'
    }, [compactionUIStateMap, currentSessionId, isNewSession])

    const autoCompactionEnabled = useMemo(() => {
      if (!currentSession) return globalSettings.autoCompaction ?? true
      return isAutoCompactionEnabled(currentSession.settings, globalSettings)
    }, [currentSession, globalSettings])

    const contextWindowKnown = useMemo(() => {
      if (!model?.modelId) return false
      return !!modelInfo?.contextWindow || getModelContextWindowSync(model.modelId) !== null
    }, [model?.modelId, modelInfo?.contextWindow])

    // Use model setting contextWindow if available, otherwise fallback to models.dev data
    const effectiveContextWindow = useMemo(() => {
      if (modelInfo?.contextWindow) return modelInfo.contextWindow
      if (model?.modelId) return getModelContextWindowSync(model.modelId)
      return null
    }, [modelInfo?.contextWindow, model?.modelId])

    useEffect(() => {
      if (!currentSessionId || isNewSession) {
        setIsCompacting(false)
        return
      }
      const checkCompacting = () => {
        setIsCompacting(isCompactionInProgress(currentSessionId))
      }
      checkCompacting()
      const interval = setInterval(checkCompacting, 1000)
      return () => clearInterval(interval)
    }, [currentSessionId, isNewSession])

    const handleAutoCompactionChange = useCallback(
      async (enabled: boolean) => {
        if (!currentSessionId || isNewSession) return
        await chatStore.updateSession(currentSessionId, (session) => {
          if (!session) {
            throw new Error('Session not found')
          }
          return {
            ...session,
            settings: {
              ...session.settings,
              autoCompaction: enabled,
            },
          }
        })
      },
      [currentSessionId, isNewSession]
    )

    // Publish token menu state to statusline (composer chip removed)
    const setComposerTokenMenu = useSetAtom(composerTokenMenuAtom)
    useEffect(() => {
      if (!currentSessionId) {
        setComposerTokenMenu(null)
        return
      }
      setComposerTokenMenu({
        sessionId: currentSessionId,
        currentInputTokens,
        contextTokens,
        totalTokens,
        isCalculating,
        pendingTasks,
        totalContextMessages: messageCount,
        contextWindow: effectiveContextWindow ?? undefined,
        currentMessageCount: currentContextMessageIds?.length ?? 0,
        maxContextMessageCount: currentSessionMergedSettings?.maxContextMessageCount,
        autoCompactionEnabled,
        isCompacting,
        contextWindowKnown,
        onCompressClick: !isNewSession ? () => setShowCompressionModal(true) : undefined,
        onAutoCompactionChange: !isNewSession ? handleAutoCompactionChange : undefined,
      })
      return () => {
        setComposerTokenMenu((prev) => (prev?.sessionId === currentSessionId ? null : prev))
      }
    }, [
      currentSessionId,
      currentInputTokens,
      contextTokens,
      totalTokens,
      isCalculating,
      pendingTasks,
      messageCount,
      effectiveContextWindow,
      currentContextMessageIds?.length,
      currentSessionMergedSettings?.maxContextMessageCount,
      autoCompactionEnabled,
      isCompacting,
      contextWindowKnown,
      isNewSession,
      handleAutoCompactionChange,
      setComposerTokenMenu,
    ])

    const [showSelectModelErrorTip, setShowSelectModelErrorTip] = useState(false)
    useEffect(() => {
      if (showSelectModelErrorTip) {
        const clickEventListener = () => {
          setShowSelectModelErrorTip(false)
          document.removeEventListener('click', clickEventListener)
        }
        document.addEventListener('click', clickEventListener)
        return () => {
          document.removeEventListener('click', clickEventListener)
        }
      }
    }, [showSelectModelErrorTip])

    const [showRollbackThreadButton, setShowRollbackThreadButton] = useState(false)
    useEffect(() => {
      if (showRollbackThreadButton) {
        const tid = setTimeout(() => {
          setShowRollbackThreadButton(false)
        }, 5000)
        return () => {
          clearTimeout(tid)
        }
      }
    }, [showRollbackThreadButton])

    const inputRef = useRef<HTMLTextAreaElement | null>(null)

    useImperativeHandle(
      ref,
      () => ({
        // 暂时并没有用到，还是使用了之前atom的方案
        setQuote: (data) => {
          setMessageInput((prev) => `${prev}\n\n${data}`)
          dom.focusMessageInput()
          dom.setMessageInputCursorToEnd()
        },
      }),
      [setMessageInput]
    )

    const { addInputBoxHistory, getPreviousHistoryInput, getNextHistoryInput, resetHistoryIndex } = useInputBoxHistory()
    const [presetHighlightIndex, setPresetHighlightIndex] = useState(0)
    const showPresetPicker = useMemo(
      () => sessionType === 'chat' && !isOpenClawModel && messageInput.startsWith('/') && !messageInput.includes('\n'),
      [isOpenClawModel, messageInput, sessionType]
    )
    const [openClawPickerDismissed, setOpenClawPickerDismissed] = useState(false)

    const showOpenClawCommandPicker = useMemo(
      () =>
        sessionType === 'chat' &&
        isOpenClawModel &&
        messageInput.startsWith('/') &&
        !messageInput.includes('\n') &&
        !messageInput.includes(' ') &&
        !openClawPickerDismissed,
      [isOpenClawModel, messageInput, sessionType, openClawPickerDismissed]
    )
    const skillDollarQuery = useMemo(
      () => (sessionType === 'chat' ? getActiveSkillDollarQuery(messageInput) : null),
      [messageInput, sessionType]
    )
    const agentAtQuery = useMemo(
      () => (sessionType === 'chat' ? getActiveAgentAtQuery(messageInput) : null),
      [messageInput, sessionType]
    )
    const showSkillPicker = useMemo(
      () =>
        sessionType === 'chat' &&
        skillDollarQuery !== null &&
        !showPresetPicker &&
        !showOpenClawCommandPicker &&
        !skillPickerDismissed &&
        selectedSkills.length < SKILL_EXPLICIT_MAX,
      [
        sessionType,
        skillDollarQuery,
        showPresetPicker,
        showOpenClawCommandPicker,
        skillPickerDismissed,
        selectedSkills.length,
      ]
    )
    const showAgentPicker = useMemo(
      () =>
        sessionType === 'chat' &&
        agentAtQuery !== null &&
        !showPresetPicker &&
        !showOpenClawCommandPicker &&
        !showSkillPicker &&
        !agentPickerDismissed &&
        selectedAgents.length < MAX_ROOM_AGENTS,
      [
        sessionType,
        agentAtQuery,
        showPresetPicker,
        showOpenClawCommandPicker,
        showSkillPicker,
        agentPickerDismissed,
        selectedAgents.length,
      ]
    )
    const filteredSkills = useMemo(
      () =>
        filterSkills(
          enabledSkills.filter((s) => !selectedSkills.some((sel) => sel.id === s.id)),
          skillDollarQuery || ''
        ).slice(0, 8),
      [enabledSkills, selectedSkills, skillDollarQuery]
    )
    const filteredAgents = useMemo(
      () =>
        filterAgents(
          allAgents.filter((a) => !selectedAgents.some((sel) => sel.id === a.id)),
          agentAtQuery || ''
        ).slice(0, 8),
      [allAgents, selectedAgents, agentAtQuery]
    )
    const roomAgentIds = useMemo(() => {
      if (isNewSession && draftAgentIds && draftAgentIds.length > 0) {
        return draftAgentIds
      }
      return currentSession?.agentIds || (currentSession?.copilotId ? [currentSession.copilotId] : [])
    }, [isNewSession, draftAgentIds, currentSession?.agentIds, currentSession?.copilotId])
    const presetQuery = useMemo(() => (showPresetPicker ? messageInput.slice(1) : ''), [messageInput, showPresetPicker])
    const openClawCommandQuery = useMemo(
      () => (showOpenClawCommandPicker ? messageInput.slice(1) : ''),
      [messageInput, showOpenClawCommandPicker]
    )
    const filteredPresets = useMemo(
      () => filterPresets(promptPresets, presetQuery).slice(0, 8),
      [presetQuery, promptPresets]
    )
    const providerSettings = useSettingsStore((state) => state.providers?.[ModelProviderEnum.OpenClaw])
    const openClawGatewayConfig = useMemo(
      () => ({
        apiHost: providerSettings?.apiHost || 'http://127.0.0.1:18789',
        apiKey: providerSettings?.apiKey || '',
        cloudflareClientId: providerSettings?.cloudflareClientId || '',
        cloudflareClientSecret: providerSettings?.cloudflareClientSecret || '',
      }),
      [providerSettings]
    )
    const { data: openClawCommands = [] } = useQuery({
      queryKey: [
        'openclaw-commands',
        openClawGatewayConfig.apiHost,
        openClawGatewayConfig.apiKey,
        openClawGatewayConfig.cloudflareClientId,
        openClawGatewayConfig.cloudflareClientSecret,
      ],
      queryFn: async () => {
        const client = getOrCreateGatewayClient(openClawGatewayConfig)
        await client.connect()
        const response = await client.listCommands()
        return response.commands ?? []
      },
      enabled: showOpenClawCommandPicker && !!openClawGatewayConfig.apiHost,
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
    })
    const filteredOpenClawCommands = useMemo(
      () => filterOpenClawCommands(openClawCommands, openClawCommandQuery).slice(0, 8),
      [openClawCommands, openClawCommandQuery]
    )

    useEffect(() => {
      setPresetHighlightIndex(0)
      setSkillHighlightIndex(0)
      setAgentHighlightIndex(0)
      setOpenClawPickerDismissed(false)
      setSkillPickerDismissed(false)
      setAgentPickerDismissed(false)
    }, [presetQuery, skillDollarQuery, agentAtQuery, messageInput])

    const handleAgentSelect = useCallback(
      (agent: AgentDetail) => {
        setSelectedAgents((prev) => {
          if (prev.some((a) => a.id === agent.id) || prev.length >= MAX_ROOM_AGENTS) return prev
          return [...prev, agent]
        })
        setMessageInput((prev) => stripActiveAgentAtToken(prev))
        setAgentPickerDismissed(true)
        dom.focusMessageInput()
      },
      [setMessageInput]
    )

    const handleRemoveRoomAgent = useCallback(
      async (agentId: string) => {
        if (!sessionId) return
        const next = roomAgentIds.filter((id) => id !== agentId)
        const { toSessionAgentFields } = await import('@shared/agent-room')
        const fields = toSessionAgentFields(next)
        await chatStore.updateSession(sessionId, {
          agentIds: fields.agentIds,
          copilotId: fields.copilotId,
        })
        setSelectedAgents((prev) => prev.filter((a) => a.id !== agentId))
      },
      [sessionId, roomAgentIds]
    )

    const handleRoomModeChange = useCallback(
      async (mode: 'discuss' | 'work') => {
        if (isNewSession) {
          onDraftRoomModeChange?.(mode)
          return
        }
        if (!sessionId) return
        const { setSessionRoomMode } = await import('@/stores/session/multi-agent-room')
        await setSessionRoomMode(sessionId, mode)
      },
      [isNewSession, onDraftRoomModeChange, sessionId]
    )

    const handleSkillSelect = useCallback(
      (skill: SkillPackage) => {
        setSelectedSkills((prev) => {
          if (prev.some((s) => s.id === skill.id) || prev.length >= SKILL_EXPLICIT_MAX) return prev
          return [...prev, skill]
        })
        // Remove trailing $partial token from draft
        setMessageInput((prev) =>
          prev.replace(/(?:^|[\s([{])\$[a-z0-9-]*$/i, (m) => m.replace(/\$.*$/, '')).replace(/\s+$/, ' ')
        )
        resetHistoryIndex()
        dom.focusMessageInput()
        setTimeout(() => {
          dom.setMessageInputCursorToEnd()
        }, 0)
      },
      [resetHistoryIndex, setMessageInput]
    )

    const handlePresetSelect = useCallback(
      async (presetId: string) => {
        const preset = filteredPresets.find((item) => item.id === presetId)
        if (!preset) {
          return
        }

        const nextValue = await replacePromptTemplateVars(preset.content, { readClipboard: true })
        setMessageInput(nextValue)
        resetHistoryIndex()
        dom.focusMessageInput()
        setTimeout(() => {
          dom.setMessageInputCursorToEnd()
        }, 0)
      },
      [filteredPresets, resetHistoryIndex, setMessageInput]
    )

    const handleOpenClawCommandSelect = useCallback(
      (command: GatewayCommandInfo) => {
        const nextValue = `${getCommandAlias(command)} `
        setOpenClawPickerDismissed(true)
        setMessageInput(nextValue)
        resetHistoryIndex()
        dom.focusMessageInput()
        setTimeout(() => {
          dom.setMessageInputCursorToEnd()
        }, 0)
      },
      [resetHistoryIndex, setMessageInput]
    )

    const closeSelectModelErrorTipCb = useRef<NodeJS.Timeout>()
    const handleSubmit = async (needGenerating = true) => {
      if (disableSubmit || isSubmitting || isPreprocessing) {
        return
      }

      // 有解析失败的文件或链接时，阻止发送并显示 toast
      if (hasPreprocessErrors) {
        toastActions.add(t('Some files failed to parse. Please remove them and try again.'))
        return
      }

      // 未选择模型时 显示error tip
      if (!model) {
        // 如果不延时执行，会导致error tip 立即消失
        await delay(100)
        if (closeSelectModelErrorTipCb.current) {
          clearTimeout(closeSelectModelErrorTipCb.current)
        }
        setShowSelectModelErrorTip(true)
        closeSelectModelErrorTipCb.current = setTimeout(() => setShowSelectModelErrorTip(false), 5000)
        return
      }

      setIsSubmitting(true)
      try {
        // Use the already constructed message
        if (!preConstructedMessage.message) {
          console.error('No constructed message available')
          return
        }

        // Sample video frames for vision models right before send
        let constructedMessage = preConstructedMessage.message

        // Attach skills from $ chips + inline $tokens; strip $tokens from text to model
        // Attach agents from @ chips
        {
          const rawText = constructedMessage.contentParts.find((p) => p.type === 'text')?.text || ''
          const namesFromText = extractSkillNamesFromText(rawText)
          const nameToSkill = new Map(allSkills.map((s) => [s.name, s]))
          const skillIds: string[] = []
          const seen = new Set<string>()
          for (const s of selectedSkills) {
            if (!seen.has(s.id)) {
              seen.add(s.id)
              skillIds.push(s.id)
            }
          }
          for (const name of namesFromText) {
            const s = nameToSkill.get(name)
            if (s && !seen.has(s.id) && skillIds.length < SKILL_EXPLICIT_MAX) {
              seen.add(s.id)
              skillIds.push(s.id)
            }
          }
          let cleanedText = stripSkillDollarTokens(rawText)
          cleanedText = stripActiveAgentAtToken(cleanedText)

          const mentionedAgentIds = selectedAgents.map((a) => a.id).slice(0, MAX_ROOM_AGENTS)
          constructedMessage = {
            ...constructedMessage,
            skillIds: skillIds.length ? skillIds : undefined,
            mentionedAgentIds: mentionedAgentIds.length ? mentionedAgentIds : undefined,
            contentParts: constructedMessage.contentParts.map((p) =>
              p.type === 'text' ? { ...p, text: cleanedText } : p
            ),
          }
        }

        const hasVideo = constructedMessage.files?.some((f) => f.mediaKind === 'video')
        if (hasVideo && model?.provider && model?.modelId) {
          setIsSamplingVideoFrames(true)
          try {
            const globalSettings = settingsStore.getState().getSettings()
            const configs = await platform.getConfig()
            const dependencies = await createModelDependencies()
            const modelInstance = getModel(
              {
                provider: model.provider,
                modelId: model.modelId,
                ...currentSessionMergedSettings,
              },
              globalSettings,
              configs,
              dependencies
            )
            const supportsVision = modelInstance.isSupportVision()
            constructedMessage = await sessionHelpers.enrichUserMessageWithVideoFrames(constructedMessage, {
              modelSupportVision: supportsVision,
              formFactor: platform.formFactor === 'desktop' ? 'desktop' : 'mobile',
            })
            // Soft banner already covers this when capabilities are known; keep toast only if banner hidden
            if (!supportsVision && !showNonVisionVideoBanner) {
              toastActions.add(
                t('Current model does not support vision. Switch to a vision model to analyze video frames.')
              )
            }
          } catch (err) {
            console.error('Video frame enrichment failed:', err)
            toastActions.add(t('Failed to process video frames. Try a shorter clip or different format.'))
          } finally {
            setIsSamplingVideoFrames(false)
          }
        }

        const messageTextForHistory = constructedMessage.contentParts.find((p) => p.type === 'text')?.text || ''

        const params = {
          constructedMessage,
          needGenerating,
          onUserMessageReady: () => {
            // Re-enable submit as soon as the message is accepted so follow-up
            // sends can enter the per-session queue while generation continues.
            setIsSubmitting(false)
            clearDraft()
            setSelectedAgents([])
            setLinks([])
            setPreConstructedMessage({
              text: '',
              pictureKeys: [],
              attachments: [],
              links: [],
              preprocessedFiles: [],
              preprocessedLinks: [],
              preprocessingStatus: {
                files: {},
                links: {},
              },
              preprocessingPromises: {
                files: new Map(),
                links: new Map(),
              },
              message: undefined,
            })
            setShowRollbackThreadButton(false)
            if (platform.formFactor !== 'mobile' && messageTextForHistory) {
              addInputBoxHistory(messageTextForHistory)
            }
          },
        }

        await onSubmit?.(params)

        trackingEvent('send_message', { event_category: 'user' })
      } catch (e) {
        console.error('Error submitting message:', e)
        toastActions.add((e as Error)?.message || t('An error occurred while sending the message.'))
      } finally {
        setIsSubmitting(false)
      }
    }

    const onMessageInput = useCallback(
      (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        const input = event.target.value
        setMessageInput(input)
        resetHistoryIndex()
      },
      [setMessageInput, resetHistoryIndex]
    )

    const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (showAgentPicker) {
        if (event.key === 'ArrowDown') {
          event.preventDefault()
          if (filteredAgents.length > 0) {
            setAgentHighlightIndex((index) => (index + 1) % filteredAgents.length)
          }
          return
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault()
          if (filteredAgents.length > 0) {
            setAgentHighlightIndex((index) => (index - 1 + filteredAgents.length) % filteredAgents.length)
          }
          return
        }
        if (event.key === 'Escape') {
          event.preventDefault()
          setAgentPickerDismissed(true)
          return
        }
        if (
          event.key === 'Enter' &&
          !event.shiftKey &&
          !event.ctrlKey &&
          !event.altKey &&
          !event.metaKey &&
          filteredAgents[agentHighlightIndex]
        ) {
          event.preventDefault()
          handleAgentSelect(filteredAgents[agentHighlightIndex])
          return
        }
        if (event.key === 'Tab' && filteredAgents[agentHighlightIndex]) {
          event.preventDefault()
          handleAgentSelect(filteredAgents[agentHighlightIndex])
          return
        }
      }

      if (showSkillPicker) {
        if (event.key === 'ArrowDown') {
          event.preventDefault()
          if (filteredSkills.length > 0) {
            setSkillHighlightIndex((index) => (index + 1) % filteredSkills.length)
          }
          return
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault()
          if (filteredSkills.length > 0) {
            setSkillHighlightIndex((index) => (index - 1 + filteredSkills.length) % filteredSkills.length)
          }
          return
        }
        if (event.key === 'Escape') {
          event.preventDefault()
          setSkillPickerDismissed(true)
          return
        }
        if (
          event.key === 'Enter' &&
          !event.shiftKey &&
          !event.ctrlKey &&
          !event.altKey &&
          !event.metaKey &&
          filteredSkills[skillHighlightIndex]
        ) {
          event.preventDefault()
          handleSkillSelect(filteredSkills[skillHighlightIndex])
          return
        }
        if (event.key === 'Tab' && filteredSkills[skillHighlightIndex]) {
          event.preventDefault()
          handleSkillSelect(filteredSkills[skillHighlightIndex])
          return
        }
      }

      if (showPresetPicker || showOpenClawCommandPicker) {
        const activePickerItems = showOpenClawCommandPicker ? filteredOpenClawCommands : filteredPresets

        if (event.key === 'ArrowDown') {
          event.preventDefault()
          if (activePickerItems.length > 0) {
            setPresetHighlightIndex((index) => (index + 1) % activePickerItems.length)
          }
          return
        }

        if (event.key === 'ArrowUp') {
          event.preventDefault()
          if (activePickerItems.length > 0) {
            setPresetHighlightIndex((index) => (index - 1 + activePickerItems.length) % activePickerItems.length)
          }
          return
        }

        if (event.key === 'Escape') {
          event.preventDefault()
          if (showOpenClawCommandPicker) {
            setOpenClawPickerDismissed(true)
          } else {
            setMessageInput('')
          }
          return
        }

        if (
          event.key === 'Enter' &&
          !event.shiftKey &&
          !event.ctrlKey &&
          !event.altKey &&
          !event.metaKey &&
          activePickerItems[presetHighlightIndex]
        ) {
          event.preventDefault()
          if (showOpenClawCommandPicker) {
            handleOpenClawCommandSelect(activePickerItems[presetHighlightIndex] as GatewayCommandInfo)
          } else {
            void handlePresetSelect(filteredPresets[presetHighlightIndex].id)
          }
          return
        }
      }

      const isPressedHash: Record<ShortcutSendValue, boolean> = {
        '': false,
        Enter: event.keyCode === 13 && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey,
        'CommandOrControl+Enter': event.keyCode === 13 && (event.ctrlKey || event.metaKey) && !event.shiftKey,
        'Ctrl+Enter': event.keyCode === 13 && event.ctrlKey && !event.shiftKey,
        'Command+Enter': event.keyCode === 13 && event.metaKey,
        'Shift+Enter': event.keyCode === 13 && event.shiftKey,
        'Ctrl+Shift+Enter': event.keyCode === 13 && event.ctrlKey && event.shiftKey,
      }

      // Alt/Option+Enter always inserts a newline (does not send)
      if (event.keyCode === 13 && event.altKey && !event.ctrlKey && !event.metaKey) {
        return
      }

      // 发送消息
      if (isPressedHash[shortcuts.inputBoxSendMessage]) {
        if (platform.formFactor === 'mobile' && isSmallScreen && shortcuts.inputBoxSendMessage === 'Enter') {
          // 移动端点击回车不会发送消息
          return
        }
        event.preventDefault()
        handleSubmit()
        return
      }

      // 发送消息但不生成回复
      if (isPressedHash[shortcuts.inputBoxSendMessageWithoutResponse]) {
        event.preventDefault()
        handleSubmit(false)
        return
      }

      // 向上向下键翻阅历史消息
      if (
        (event.key === 'ArrowUp' || event.key === 'ArrowDown') &&
        inputRef.current &&
        inputRef.current === document.activeElement && // 聚焦在输入框
        (messageInput.length === 0 || window.getSelection()?.toString() === messageInput) // 要么为空，要么输入框全选
      ) {
        event.preventDefault()
        if (event.key === 'ArrowUp') {
          const previousInput = getPreviousHistoryInput()
          if (previousInput !== undefined) {
            setMessageInput(previousInput)
            setTimeout(() => inputRef.current?.select(), 10)
          }
        } else if (event.key === 'ArrowDown') {
          const nextInput = getNextHistoryInput()
          if (nextInput !== undefined) {
            setMessageInput(nextInput)
            setTimeout(() => inputRef.current?.select(), 10)
          }
        }
      }
    }

    const startNewThread = () => {
      const res = onStartNewThread?.()
      if (res) {
        setShowRollbackThreadButton(true)
      }
    }

    const rollbackThread = () => {
      const res = onRollbackThread?.()
      if (res) {
        setShowRollbackThreadButton(false)
      }
    }

    // ----- Preprocessing helpers -----
    const startLinkPreprocessing = (url: string) => {
      // 设置为处理中状态
      setPreConstructedMessage((prev) => markLinkProcessing(prev, url))

      // 异步预处理链接，失败时标记为 error，并吞掉异常避免 Promise.all reject
      const preprocessPromise = sessionHelpers
        .preprocessLink(url, { provider: model?.provider || '', modelId: model?.modelId || '' })
        .then((preprocessedLink) => {
          setPreConstructedMessage((prev) => onLinkProcessed(prev, url, preprocessedLink, 6))
        })
        .catch((error) => {
          setPreConstructedMessage((prev) =>
            onLinkProcessed(
              prev,
              url,
              {
                url,
                title: '',
                content: '',
                storageKey: '',
                error: (error as Error)?.message || 'Failed to preprocess the link.',
              },
              6
            )
          )
        })

      // Store the promise
      setPreConstructedMessage((prev) => storeLinkPromise(prev, url, preprocessPromise))
    }

    const startFilePreprocessing = (file: File) => {
      // 异步预处理文件，失败时标记为 error，并吞掉异常避免 Promise.all reject
      return sessionHelpers
        .preprocessFile(file, { provider: model?.provider || '', modelId: model?.modelId || '' })
        .then((preprocessedFile) => {
          setPreConstructedMessage((prev) => onFileProcessed(prev, file, preprocessedFile, 20))
        })
        .catch((error) => {
          setPreConstructedMessage((prev) =>
            onFileProcessed(
              prev,
              file,
              {
                file,
                content: '',
                storageKey: '',
                error: (error as Error)?.message || 'Failed to preprocess the file.',
              },
              20
            )
          )
        })
    }

    const insertLinks = (urls: string[]) => {
      let newLinks = [...(links || []), ...urls.map((u) => ({ url: u }))]
      newLinks = _.uniqBy(newLinks, 'url')
      newLinks = newLinks.slice(-6) // 最多插入 6 个链接
      setLinks(newLinks)

      // 预处理链接（只处理前6个）
      for (let i = 0; i < Math.min(urls.length, 6); i++) {
        const url = urls[i]
        const linkIndex = newLinks.findIndex((l) => l.url === url)

        if (linkIndex < 6) {
          startLinkPreprocessing(url)
        }
      }
    }

    const toastUnsupportedFile = useCallback(
      (fileName: string) => {
        const key = getUnsupportedFileI18nKey(fileName)
        toastActions.add(t(key, { fileName }))
      },
      [t]
    )

    const insertFiles = async (files: File[]) => {
      const videoLimits = getVideoLimits(platform.formFactor === 'desktop' ? 'desktop' : 'mobile')

      for (const file of files) {
        // Vision lane: AI-readable images (canvas resize). Advanced formats toast and skip.
        if (file.type.startsWith('image/') || isAiReadableImageFile(file)) {
          if (!isAiReadableImageFile(file)) {
            toastUnsupportedFile(file.name)
            continue
          }
          try {
            const base64 = await picUtils.getImageBase64AndResize(file)
            const key = StorageKeyGenerator.picture('input-box')
            await storage.setBlob(key, base64)
            setPreConstructedMessage((prev) => ({
              ...prev,
              pictureKeys: [...(prev.pictureKeys || []), key].slice(-8),
            })) // Maximum 8 images
          } catch {
            toastUnsupportedFile(file.name)
          }
          continue
        }

        // Video lane: mp4/webm → store blob + poster; frames sampled on send if vision
        if (file.type.startsWith('video/') || isAiReadableVideoFile(file)) {
          if (!isAiReadableVideoFile(file)) {
            toastUnsupportedFile(file.name)
            continue
          }
          if (file.size > videoLimits.maxFileBytes) {
            toastActions.add(
              t('Video is too large. Maximum size is {{max}}.', {
                max: formatBytesForDisplay(videoLimits.maxFileBytes),
              })
            )
            continue
          }

          setPreConstructedMessage((prev) => {
            const existingVideos = (prev.preprocessedFiles || []).filter((f) => f.mediaKind === 'video' && !f.error)
            const attachmentCount = prev.attachments.filter((a) => isAiReadableVideoFile(a)).length
            if (
              existingVideos.length >= videoLimits.maxVideosPerMessage ||
              attachmentCount >= videoLimits.maxVideosPerMessage
            ) {
              toastActions.add(
                t('You can attach at most {{count}} video(s) per message.', {
                  count: videoLimits.maxVideosPerMessage,
                })
              )
              return prev
            }

            const newAttachments = prev.attachments.find(
              (f) => StorageKeyGenerator.fileUniqKey(f) === StorageKeyGenerator.fileUniqKey(file)
            )
              ? prev.attachments
              : [...(prev.attachments || []), file]

            const preprocessPromise = sessionHelpers
              .preprocessVideo(file, {
                formFactor: platform.formFactor === 'desktop' ? 'desktop' : 'mobile',
              })
              .then((preprocessedFile) => {
                if (preprocessedFile.error?.startsWith('video_too_long:')) {
                  const mins = preprocessedFile.error.split(':')[1]
                  toastActions.add(t('Video is too long. Maximum duration is {{minutes}} minutes.', { minutes: mins }))
                } else if (preprocessedFile.error?.startsWith('video_too_large:')) {
                  toastActions.add(
                    t('Video is too large. Maximum size is {{max}}.', {
                      max: preprocessedFile.error.split(':')[1],
                    })
                  )
                } else if (preprocessedFile.error) {
                  toastActions.add(t('Failed to process video. Use MP4 or WebM.'))
                }
                setPreConstructedMessage((p) => onFileProcessed(p, file, preprocessedFile, 20))
              })
              .catch(() => {
                toastActions.add(t('Failed to process video. Use MP4 or WebM.'))
                setPreConstructedMessage((p) =>
                  onFileProcessed(
                    p,
                    file,
                    {
                      file,
                      content: '',
                      storageKey: '',
                      mediaKind: 'video',
                      error: 'Failed to process video',
                    },
                    20
                  )
                )
              })

            return {
              ...storeFilePromise(markFileProcessing(prev, file), file, preprocessPromise),
              attachments: newAttachments,
            }
          })
          continue
        }

        // Document / text lane
        if (!isSupportedFile(file.name)) {
          toastUnsupportedFile(file.name)
          continue
        }
        setPreConstructedMessage((prev) => {
          const newAttachments = prev.attachments.find(
            (f) => StorageKeyGenerator.fileUniqKey(f) === StorageKeyGenerator.fileUniqKey(file)
          )
            ? prev.attachments
            : [...(prev.attachments || []), file].slice(-20) // Maximum 20 attachments

          // Only preprocess first 20 files to avoid wasting resources
          const fileIndex = newAttachments.findIndex(
            (f) => f.name === file.name && f.lastModified === file.lastModified
          )
          if (fileIndex < 20) {
            const preprocessPromise = startFilePreprocessing(file)
            return {
              ...storeFilePromise(markFileProcessing(prev, file), file, preprocessPromise),
              attachments: newAttachments,
            }
          }

          return {
            ...prev,
            attachments: newAttachments,
          }
        })
      }
    }

    const insertFilesRef = useRef(insertFiles)
    insertFilesRef.current = insertFiles

    // Window-level file DnD so drops work over the whole chat (not only the composer shell).
    // Tauri must set dragDropEnabled:false so HTML5 File events reach the webview.
    const [isFileDragActive, setIsFileDragActive] = useState(false)
    useEffect(() => {
      if (sessionType === 'picture') {
        return
      }

      let dragDepth = 0

      const isFileDrag = (event: DragEvent) => {
        const types = event.dataTransfer?.types
        if (!types) {
          return false
        }
        return Array.from(types).includes('Files')
      }

      const onDragEnter = (event: DragEvent) => {
        if (!isFileDrag(event)) {
          return
        }
        event.preventDefault()
        dragDepth += 1
        setIsFileDragActive(true)
      }

      const onDragLeave = (event: DragEvent) => {
        if (!isFileDrag(event)) {
          return
        }
        dragDepth = Math.max(0, dragDepth - 1)
        if (dragDepth === 0) {
          setIsFileDragActive(false)
        }
      }

      const onDragOver = (event: DragEvent) => {
        if (!isFileDrag(event)) {
          return
        }
        // Required so the browser allows drop instead of navigating away
        event.preventDefault()
        if (event.dataTransfer) {
          event.dataTransfer.dropEffect = 'copy'
        }
      }

      const onDrop = (event: DragEvent) => {
        if (!isFileDrag(event)) {
          return
        }
        event.preventDefault()
        event.stopPropagation()
        dragDepth = 0
        setIsFileDragActive(false)
        const files = Array.from(event.dataTransfer?.files ?? [])
        if (files.length > 0) {
          void insertFilesRef.current(files)
        }
      }

      window.addEventListener('dragenter', onDragEnter)
      window.addEventListener('dragleave', onDragLeave)
      window.addEventListener('dragover', onDragOver)
      window.addEventListener('drop', onDrop)
      return () => {
        window.removeEventListener('dragenter', onDragEnter)
        window.removeEventListener('dragleave', onDragLeave)
        window.removeEventListener('dragover', onDragOver)
        window.removeEventListener('drop', onDrop)
      }
    }, [sessionType])

    const onFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!event.target.files) {
        return
      }
      insertFiles(Array.from(event.target.files))
      event.target.value = ''
      dom.focusMessageInput()
    }

    const onImageUploadClick = () => {
      pictureInputRef.current?.click()
    }
    const onFileUploadClick = () => {
      fileInputRef.current?.click()
    }

    const onImageDeleteClick = async (picKey: string) => {
      setPreConstructedMessage((prev) => ({
        ...prev,
        pictureKeys: (prev.pictureKeys || []).filter((k) => k !== picKey),
      }))
      // 不删除图片数据，因为可能在其他地方引用，比如通过上下键盘的历史消息快捷输入、发送的消息中引用
      // await storage.delBlob(picKey)
    }

    const onPaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
      if (sessionType === 'picture') {
        return
      }
      if (event.clipboardData?.items) {
        // 对于 Doc/PPT/XLS 等文件中的内容，粘贴时一般会有 4 个 items，分别是 text 文本、html、某格式和图片
        // 因为 getAsString 为异步操作，无法根据 items 中的内容来定制不同的粘贴行为，因此这里选择了最简单的做法：
        // 保持默认的粘贴行为，这时候会粘贴从文档中复制的文本和图片。我认为应该保留图片，因为文档中的表格、图表等图片信息也很重要，很难通过文本格式来表述。
        // 仅在只粘贴图片或文件时阻止默认行为，防止插入文件或图片的名字
        let hasText = false
        for (let i = 0; i < event.clipboardData.items.length; i++) {
          const item = event.clipboardData.items[i]
          if (item.kind === 'file') {
            // Insert files and images
            const file = item.getAsFile()
            if (file) {
              insertFiles([file])
            }
            continue
          }
          hasText = true
          if (item.kind === 'string' && item.type === 'text/plain') {
            // 插入链接：如果复制的是链接，则插入链接
            item.getAsString((text) => {
              const raw = text.trim()
              if (raw.startsWith('http://') || raw.startsWith('https://')) {
                const urls = raw
                  .split(/\s+/)
                  .map((url) => url.trim())
                  .filter((url) => url.startsWith('http://') || url.startsWith('https://'))
                insertLinks(urls)
              }
              if (pasteLongTextAsAFile && raw.length > 3000) {
                const file = new File([text], `pasted_text_${attachments?.length || 0}.txt`, {
                  type: 'text/plain',
                })
                insertFiles([file])
                setMessageInput(messageInput) // 删除掉默认粘贴进去的长文本
              }
            })
          }
        }
        // 如果没有任何文本，则说明只是复制了图片或文件。这里阻止默认行为，防止插入文件或图片的名字
        if (!hasText) {
          event.preventDefault()
        }
      }
    }

    const handleAttachLink = async () => {
      const links: string[] = await NiceModal.show('attach-link')
      if (links) {
        insertLinks(links)
      }
    }

    // 引用消息
    const quote = useUIStore((state) => state.quote)
    const setQuote = useUIStore((state) => state.setQuote)
    // const [quote, setQuote] = useUIStore(state => [state]) useAtom(atoms.quoteAtom)
    // biome-ignore lint/correctness/useExhaustiveDependencies: todo
    useEffect(() => {
      if (quote !== '') {
        // TODO: 支持引用消息中的图片
        // TODO: 支持引用消息中的文件
        setQuote('')
        setMessageInput((val) => {
          const newValue = !val
            ? quote
            : val + '\n'.repeat(Math.max(0, 2 - (val.match(/(\n)+$/)?.[0].length || 0))) + quote
          return newValue
        })
        // setPreviousMessageQuickInputMark('')
        dom.focusMessageInput()
        dom.setMessageInputCursorToEnd()
      }
    }, [quote])

    const handleKnowledgeBaseSelect = useCallback(
      (kb: KnowledgeBase | null) => {
        if (!kb || kb.id === knowledgeBase?.id) {
          setKnowledgeBase(undefined)
          trackEvent('knowledge_base_disabled', { knowledge_base_name: knowledgeBase?.name })
        } else {
          setKnowledgeBase(pick(kb, 'id', 'name'))
          trackEvent('knowledge_base_enabled', { knowledge_base_name: kb.name })
        }
      },
      [knowledgeBase, setKnowledgeBase]
    )

    // Show deprecated notice for legacy picture sessions
    if (sessionType === 'picture') {
      return (
        <Box id={dom.InputBoxID} className="chat-input-shell">
          <Stack
            className={cn('composer-card', widthFull ? 'chat-col-full' : 'chat-col')}
            gap="xs"
            p="md"
            align="center"
          >
            <Text size="sm" c="chatbox-tertiary" ta="center">
              {t('This image session is no longer active. Please use the new Image Creator for image generation.')}
            </Text>
            <Button variant="light" size="xs" onClick={() => navigate({ to: '/image-creator' })}>
              {t('Go to Image Creator')}
            </Button>
          </Stack>
        </Box>
      )
    }

    const sendDisabled = generating
      ? disableSubmit
        ? false
        : isPreprocessing || isSubmitting || isSamplingVideoFrames || isCompactionRunning
      : disableSubmit || isPreprocessing || isSubmitting || isSamplingVideoFrames || isCompactionRunning

    const roomMode: 'discuss' | 'work' =
      isNewSession
        ? draftRoomMode === 'work'
          ? 'work'
          : 'discuss'
        : currentSession?.roomMode === 'work'
          ? 'work'
          : 'discuss'
    const showRoomModeChip = roomAgentIds.length >= 2 || selectedAgents.length >= 2

    return (
      <Box id={dom.InputBoxID} className="chat-input-shell">
        <Stack className={cn(widthFull ? 'chat-col-full' : 'chat-col')} gap="xs">
          {currentSessionId && <CompactionStatus sessionId={currentSessionId} />}
          {currentSessionId && <QueuedMessageList sessionId={currentSessionId} />}
          {currentSessionId ? <TeamRoomActions sessionId={currentSessionId} /> : null}
          <Stack
            className={cn(
              'composer-card relative justify-between',
              isFileDragActive && 'composer-card-drag-active',
              (showSkillPicker || showAgentPicker || showPresetPicker || showOpenClawCommandPicker) &&
                'composer-card-picker-open'
            )}
            gap={0}
          >
            <div
              className={cn('composer-drop-overlay', isFileDragActive && 'is-active')}
              aria-hidden={!isFileDragActive}
            >
              <div className="composer-drop-overlay-content">
                <IconFolder className="composer-drop-overlay-icon" strokeWidth={1.5} size={28} />
                <span className="composer-drop-overlay-title">{t('Drop to attach')}</span>
                <span className="composer-drop-overlay-hint">{t('Images · video · PDFs · text · code')}</span>
                <span className="composer-drop-overlay-limits font-mono tabular-nums">
                  {t('MP4 · WebM · max {{minutes}} min · {{size}}', videoDropLimitsHint)}
                </span>
              </div>
            </div>
            {showPresetPicker && (
              <PresetPicker
                highlightedIndex={presetHighlightIndex}
                onHighlightChange={setPresetHighlightIndex}
                onManage={() => navigateToSettings('/chat')}
                onSelect={(preset) => {
                  void handlePresetSelect(preset.id)
                }}
                presets={promptPresets}
                query={presetQuery}
              />
            )}
            {showOpenClawCommandPicker && (
              <OpenClawCommandPicker
                commands={openClawCommands}
                highlightedIndex={presetHighlightIndex}
                onHighlightChange={setPresetHighlightIndex}
                onSelect={handleOpenClawCommandSelect}
                query={openClawCommandQuery}
              />
            )}
            {showAgentPicker && (
              <AgentPicker
                agents={allAgents}
                highlightedIndex={agentHighlightIndex}
                onHighlightChange={setAgentHighlightIndex}
                onSelect={handleAgentSelect}
                query={agentAtQuery || ''}
                excludeIds={selectedAgents.map((a) => a.id)}
              />
            )}
            {showSkillPicker && (
              <SkillPicker
                skills={enabledSkills}
                highlightedIndex={skillHighlightIndex}
                onHighlightChange={setSkillHighlightIndex}
                onSelect={handleSkillSelect}
                query={skillDollarQuery || ''}
                excludeIds={selectedSkills.map((s) => s.id)}
              />
            )}

            {/* Agent room + skills — shared horizontal inset (team mode lives next to model picker) */}
            {(selectedAgents.length > 0 || roomAgentIds.length > 0 || selectedSkills.length > 0) && (
              <div className="composer-meta-stack">
                {selectedAgents.length > 0 ? (
                  <div className="composer-meta-row">
                    <span className="composer-meta-label">{t('This turn')}:</span>
                    {selectedAgents.map((agent) => (
                      <span key={agent.id} className="composer-skill-chip">
                        <span className="composer-skill-chip-sigil" aria-hidden>
                          @
                        </span>
                        <span>
                          {agent.emojiAvatar ? `${agent.emojiAvatar} ` : ''}
                          {agent.name}
                        </span>
                        <button
                          type="button"
                          className="composer-skill-chip-remove"
                          aria-label={t('Remove agent')}
                          onClick={() => setSelectedAgents((prev) => prev.filter((a) => a.id !== agent.id))}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    <span className="composer-meta-label">· {t('You')}</span>
                  </div>
                ) : roomAgentIds.length > 0 ? (
                  <AgentRoomStrip
                    agentIds={roomAgentIds}
                    sessionId={sessionId}
                    embedded
                    onRemove={sessionId ? handleRemoveRoomAgent : undefined}
                  />
                ) : null}

                {selectedSkills.length > 0 ? (
                  <div className="composer-meta-row">
                    {selectedSkills.map((skill) => (
                      <span key={skill.id} className="composer-skill-chip">
                        <span className="composer-skill-chip-sigil" aria-hidden>
                          $
                        </span>
                        <span>{skill.name}</span>
                        <button
                          type="button"
                          className="composer-skill-chip-remove"
                          aria-label={t('Remove skill')}
                          onClick={() => setSelectedSkills((prev) => prev.filter((s) => s.id !== skill.id))}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            )}

            {/* Text area — full width of card (mock .composer textarea) */}
            <Textarea
              unstyled={true}
              variant="unstyled"
              classNames={{
                root: 'w-full',
                wrapper: 'w-full',
                input:
                  'composer-textarea block w-full outline-none border-none shadow-none px-4 pt-3.5 pb-2 resize-none bg-transparent text-chatbox-tint-primary placeholder:text-[var(--chatbox-tint-tertiary)] focus:outline-none focus:border-none focus:shadow-none focus-visible:outline-none',
              }}
              styles={{
                input: {
                  border: 'none',
                  borderColor: 'transparent',
                  boxShadow: 'none',
                  outline: 'none',
                  backgroundColor: 'transparent',
                  '&:focus, &:focus-visible, &:focus-within': {
                    border: 'none',
                    borderColor: 'transparent',
                    boxShadow: 'none',
                    outline: 'none',
                  },
                },
              }}
              size="sm"
              id={dom.messageInputID}
              ref={inputRef}
              placeholder={t('Type your question here… Use @ for agents, $ for skills') || ''}
              bg="transparent"
              autosize={true}
              minRows={2}
              maxRows={Math.max(4, Math.floor(viewportHeight / 100))}
              value={messageInput}
              autoFocus={!isSmallScreen}
              readOnly={isCompactionRunning}
              onChange={onMessageInput}
              onKeyDown={onKeyDown}
              onPaste={onPaste}
            />

            {(!!pictureKeys.length || !!attachments.length || !!links.length) && (
              <Flex align="center" wrap="wrap" px="sm" pb="xs" onClick={() => dom.focusMessageInput()}>
                {pictureKeys?.map((picKey, picIndex) => (
                  <ImageMiniCard
                    key={picKey}
                    storageKey={picKey}
                    staggerIndex={picIndex}
                    onDelete={() => onImageDeleteClick(picKey)}
                  />
                ))}
                {attachments?.map((file, fileIndex) => {
                  const fileKey = StorageKeyGenerator.fileUniqKey(file)
                  const status = preConstructedMessage.preprocessingStatus.files[fileKey]
                  const preprocessedFile = preConstructedMessage.preprocessedFiles.find(
                    (f) => StorageKeyGenerator.fileUniqKey(f.file) === fileKey
                  )
                  const pictureOffset = pictureKeys?.length || 0
                  return (
                    <FileMiniCard
                      key={fileKey}
                      name={file.name}
                      fileType={file.type}
                      status={status}
                      errorMessage={preprocessedFile?.error}
                      mediaKind={preprocessedFile?.mediaKind}
                      posterStorageKey={preprocessedFile?.posterStorageKey}
                      videoStorageKey={
                        preprocessedFile?.mediaKind === 'video' && preprocessedFile.storageKey
                          ? preprocessedFile.storageKey
                          : undefined
                      }
                      durationSec={preprocessedFile?.durationSec}
                      byteLength={preprocessedFile?.byteLength ?? file.size}
                      staggerIndex={pictureOffset + fileIndex}
                      durationLabel={
                        preprocessedFile?.mediaKind === 'video' && preprocessedFile.durationSec !== undefined
                          ? formatDurationForDisplay(preprocessedFile.durationSec)
                          : undefined
                      }
                      onErrorClick={() => {
                        if (preprocessedFile?.error) {
                          void NiceModal.show('file-parse-error', {
                            errorCode: preprocessedFile.error,
                            fileName: file.name,
                          })
                        }
                      }}
                      onDelete={() => {
                        // Cancel any ongoing MinerU parsing for this file
                        if (file.path && platform.cancelMineruParse) {
                          platform.cancelMineruParse(file.path).catch(() => {
                            // Ignore cancellation errors
                          })
                        }
                        setPreConstructedMessage((prev) => ({
                          ...cleanupFile(prev, file),
                          attachments: (prev.attachments || []).filter(
                            (f) => StorageKeyGenerator.fileUniqKey(f) !== fileKey
                          ),
                        }))
                      }}
                    />
                  )
                })}
                {(isSamplingVideoFrames || showNonVisionVideoBanner) && (
                  <div className="flex w-full basis-full flex-col gap-1.5 px-1 pb-1 pt-0.5">
                    {isSamplingVideoFrames && (
                      <div
                        className="flex items-center gap-1.5 text-[11px] text-[var(--chatbox-tint-tertiary)]"
                        role="status"
                        aria-live="polite"
                      >
                        <IconLoader2
                          size={13}
                          className="animate-spin shrink-0 text-[var(--chatbox-tint-brand)]"
                          stroke={1.75}
                        />
                        <span className="truncate">{t('Sampling video frames…')}</span>
                      </div>
                    )}
                    {showNonVisionVideoBanner && !isSamplingVideoFrames && (
                      <div className="composer-video-vision-banner flex items-start gap-1.5 rounded-md px-2 py-1.5">
                        <IconAlertCircle
                          size={14}
                          className="mt-0.5 shrink-0 text-[var(--chatbox-tint-tertiary)]"
                          stroke={1.75}
                        />
                        <p className="m-0 min-w-0 flex-1 text-[11px] leading-snug text-[var(--chatbox-tint-tertiary)]">
                          {t("This model can't see video frames. Switch to a vision model to analyze them.")}
                        </p>
                        <button
                          type="button"
                          className="shrink-0 rounded px-1 text-[10px] text-[var(--chatbox-tint-tertiary)] transition-opacity duration-150 hover:text-[var(--chatbox-tint-secondary)] active:scale-[0.96]"
                          onClick={(e) => {
                            e.stopPropagation()
                            setVisionBannerDismissed(true)
                          }}
                        >
                          {t('Dismiss')}
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {links?.map((link, linkIndex) => {
                  const linkKey = StorageKeyGenerator.linkUniqKey(link.url)
                  const status = preConstructedMessage.preprocessingStatus.links[linkKey]
                  const preprocessedLink = preConstructedMessage.preprocessedLinks.find(
                    (l) => StorageKeyGenerator.linkUniqKey(l.url) === linkKey
                  )
                  const attachOffset = (pictureKeys?.length || 0) + (attachments?.length || 0)
                  return (
                    <LinkMiniCard
                      key={linkKey}
                      url={link.url}
                      status={status}
                      staggerIndex={attachOffset + linkIndex}
                      errorMessage={preprocessedLink?.error}
                      onErrorClick={() => {
                        if (preprocessedLink?.error) {
                          void NiceModal.show('file-parse-error', {
                            errorCode: preprocessedLink.error,
                            fileName: link.url,
                          })
                        }
                      }}
                      onDelete={() => {
                        setLinks(links.filter((l) => l.url !== link.url))
                        setPreConstructedMessage((prev) => cleanupLink(prev, link.url))
                      }}
                    />
                  )
                })}
              </Flex>
            )}

            {showWorkspaceHint && (
              <div className="flex items-start gap-1.5 px-3 pb-1.5 pt-0">
                <IconFolder size={14} className="mt-0.5 shrink-0 text-[var(--chatbox-tint-tertiary)]" stroke={1.75} />
                <p className="m-0 min-w-0 flex-1 text-[11px] leading-snug text-[var(--chatbox-tint-tertiary)]">
                  {t('Set a workspace folder (Tools menu) so Agent can write files and run terminal commands on disk.')}
                </p>
              </div>
            )}

            {/* Toolbar row — mock .bar (rail bg + send on the right) */}
            <Flex align="center" gap={0} className="composer-bar shrink-0 w-full">
              {/* Hidden file inputs */}
              <ImageUploadInput ref={pictureInputRef} onChange={onFileInputChange} />
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={onFileInputChange}
                multiple
                accept={getFileAcceptString()}
              />

              {/* Left Group: single overflow control */}
              <Flex align="center" gap={0} className="min-w-0 flex-1 flex-wrap">
                <ComposerToolsMenu
                  isOpenClawModel={isOpenClawModel}
                  sessionType={sessionType}
                  webBrowsingMode={webBrowsingMode}
                  webSearchConfigured={webSearchConfigured}
                  onWebBrowsingChange={(enabled) => {
                    setWebBrowsingMode(enabled)
                    dom.focusMessageInput()
                  }}
                  agentMode={agentMode}
                  onToggleAgentMode={toggleAgentMode}
                  workspaceRoot={workspaceRoot}
                  onWorkspaceRootChange={onWorkspaceRootChange}
                  knowledgeBaseId={knowledgeBase?.id}
                  onSelectKnowledgeBase={handleKnowledgeBaseSelect}
                  showRollbackThreadButton={showRollbackThreadButton}
                  onStartNewThread={onStartNewThread ? startNewThread : undefined}
                  onRollbackThread={onRollbackThread ? rollbackThread : undefined}
                  onClickSessionSettings={
                    onClickSessionSettings
                      ? () => {
                          void onClickSessionSettings()
                        }
                      : undefined
                  }
                  onImageUploadClick={onImageUploadClick}
                  onFileUploadClick={onFileUploadClick}
                  onAttachLink={handleAttachLink}
                  toolbarButtonClass={toolbarButtonClass}
                  toolbarIconSize={toolbarIconSize}
                />
              </Flex>

              {/* Right Group: Team mode (multi-agent) + Model + Send */}
              <Flex align="center" gap={4} className="shrink-0">
                {showRoomModeChip ? (
                  <TeamModeSelect
                    value={roomMode}
                    onChange={(mode) => void handleRoomModeChange(mode)}
                    toolbarButtonClass={toolbarButtonClass}
                    isSmallScreen={isSmallScreen}
                  />
                ) : null}

                {/* Model Selector */}
                <Tooltip
                  label={
                    <Flex align="center" c="white" gap="xxs">
                      <ScalableIcon icon={IconAlertCircle} size={12} className="text-inherit" />
                      <Text span size="xxs" c="white">
                        {t('Please select a model')}
                      </Text>
                    </Flex>
                  }
                  color="dark"
                  opened={showSelectModelErrorTip}
                  withArrow
                >
                  <ModelSelector
                    onSelect={onSelectModel}
                    selectedProviderId={model?.provider}
                    selectedModelId={model?.modelId}
                    position="top-end"
                    transitionProps={{
                      transition: 'fade-up',
                      duration: 200,
                    }}
                  >
                    <UnstyledButton
                      className={cn(toolbarButtonClass, 'model-picker-trigger', isSmallScreen && 'px-2.5')}
                    >
                      {!!model && <ProviderImageIcon size={15} provider={model.provider} />}
                      <Text
                        size="xs"
                        className={cn(
                          'text-[var(--chatbox-tint-secondary)] truncate font-[family-name:var(--chatbox-font-mono)] tabular-nums',
                          isSmallScreen ? 'max-w-[108px]' : 'max-w-[140px]'
                        )}
                        style={{ fontSize: '0.75rem', fontWeight: 500, letterSpacing: '-0.01em' }}
                      >
                        {modelSelectorDisplayText}
                      </Text>
                      <IconChevronRight
                        size={11}
                        stroke={1.75}
                        className="text-[var(--chatbox-tint-tertiary)] flex-shrink-0 opacity-75"
                        style={{ transform: 'translateY(0.5px) rotate(90deg)' }}
                      />
                    </UnstyledButton>
                  </ModelSelector>
                </Tooltip>

                <Tooltip label={t('Sampling video frames…')} disabled={!isSamplingVideoFrames} withArrow position="top">
                  <ActionIcon
                    disabled={sendDisabled}
                    variant="filled"
                    color={generating && disableSubmit ? 'dark' : 'chatbox-brand'}
                    className="composer-send shadow-none"
                    aria-label={
                      isSamplingVideoFrames
                        ? t('Sampling video frames…')
                        : generating && disableSubmit
                          ? t('Stop')
                          : t('Send')
                    }
                    onClick={generating && disableSubmit ? onStopGenerating : () => handleSubmit()}
                    style={
                      !(generating && disableSubmit) && sendDisabled
                        ? {
                            backgroundColor: 'var(--chatbox-background-tertiary)',
                            color: 'var(--chatbox-tint-tertiary)',
                            opacity: 1,
                          }
                        : undefined
                    }
                  >
                    {generating && disableSubmit ? (
                      <ScalableIcon icon={IconPlayerStopFilled} size={14} />
                    ) : isSamplingVideoFrames ? (
                      <IconLoader2 size={14} className="animate-spin" stroke={1.75} />
                    ) : (
                      <ScalableIcon icon={IconArrowUp} size={14} />
                    )}
                  </ActionIcon>
                </Tooltip>
              </Flex>
            </Flex>
          </Stack>
        </Stack>
        {currentSession && (
          <CompressionModal
            opened={showCompressionModal}
            onClose={() => setShowCompressionModal(false)}
            session={currentSession}
          />
        )}
      </Box>
    )
  }
)

// Memoize the InputBox component to prevent unnecessary re-renders during streaming
export default memo(InputBox)
