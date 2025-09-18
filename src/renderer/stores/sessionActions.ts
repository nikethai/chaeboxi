import * as Sentry from '@sentry/react'
import { getDefaultStore } from 'jotai'
import { identity, pickBy, throttle } from 'lodash'
import * as defaults from 'src/shared/defaults'
import { getModel } from 'src/shared/models'
import type { onResultChangeWithCancel } from 'src/shared/models/types'
import { v4 as uuidv4 } from 'uuid'
import { createModelDependencies } from '@/adapters'
import * as dom from '@/hooks/dom'
import { languageNameMap } from '@/i18n/locales'
import { formatChatAsHtml, formatChatAsMarkdown, formatChatAsTxt } from '@/lib/format-chat'
import * as appleAppStore from '@/packages/apple_app_store'
import * as localParser from '@/packages/local-parser'
import { generateImage, generateText, streamText } from '@/packages/model-calls'
import { getModelDisplayName } from '@/packages/model-setting-utils'
import * as remote from '@/packages/remote'
import { estimateTokens, estimateTokensFromMessages } from '@/packages/token'
import { router } from '@/router'
import { StorageKeyGenerator } from '@/storage/StoreStorage'
import { trackEvent } from '@/utils/track'

/**
 * 跟踪生成事件
 */
function trackGenerateEvent(
  settings: SessionSettings,
  globalSettings: Settings,
  sessionType: SessionType | undefined,
  options?: { operationType?: 'send_message' | 'regenerate' }
) {
  // 获取更有意义的 provider 标识
  let providerIdentifier = settings.provider
  if (settings.provider?.startsWith('custom-provider-')) {
    // 对于自定义 provider，使用 apiHost 作为标识
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

  const webBrowsing = uiStore.getState().inputBoxWebBrowsingMode

  trackEvent('generate', {
    provider: providerIdentifier,
    model: settings.modelId || 'unknown',
    operation_type: options?.operationType || 'unknown',
    web_browsing_enabled: webBrowsing ? 'true' : 'false',
    session_type: sessionType || 'chat',
  })
}

import {
  AIProviderNoImplementedPaintError,
  ApiError,
  BaseError,
  ChatboxAIAPIError,
  NetworkError,
} from '../../shared/models/errors'
import {
  createMessage,
  type ExportChatFormat,
  type ExportChatScope,
  type Message,
  type MessageImagePart,
  type MessagePicture,
  type ModelProvider,
  ModelProviderEnum,
  type Session,
  type SessionMeta,
  type SessionSettings,
  SessionSettingsSchema,
  type SessionThread,
  type SessionType,
  type Settings,
  TOKEN_CACHE_KEYS,
} from '../../shared/types'
import { cloneMessage, countMessageWords, getMessageText, mergeMessages } from '../../shared/utils/message'
import i18n from '../i18n'
import * as promptFormat from '../packages/prompts'
import platform from '../platform'
import storage from '../storage'
import * as atoms from './atoms'
import { lastUsedModelStore } from './lastUsedModelStore'
import * as scrollActions from './scrollActions'
import { clearConversations, copySession, createSession, getSession, saveSession } from './sessionStorageMutations'
import * as settingActions from './settingActions'
import { settingsStore } from './settingsStore'
import { uiStore } from './uiStore'

/**
 * 创建一个新的会话
 * @param newSession
 */
async function create(newSession: Omit<Session, 'id'>) {
  const session = await createSession(newSession)
  switchCurrentSession(session.id)
  return session
}

/**
 * 修改会话名称
 */
export function modifyNameAndThreadName(sessionId: string, name: string) {
  saveSession(sessionId, { name, threadName: name })
}

/**
 * 修改会话的当前话题名称
 */
export function modifyThreadName(sessionId: string, threadName: string) {
  saveSession(sessionId, { threadName })
}

/**
 * 创建一个空的会话
 */
export async function createEmpty(type: 'chat' | 'picture') {
  let newSession: Session
  switch (type) {
    case 'chat':
      newSession = await create(initEmptyChatSession())
      break
    case 'picture':
      newSession = await create(initEmptyPictureSession())
      break
    default:
      throw new Error(`Unknown session type: ${type}`)
  }
  switchCurrentSession(newSession.id)
  return newSession
}

/**
 * 创建 n 个空图片消息（loading 中，用于占位）
 * @param n 空消息数量
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
 * 切换当前会话，根据 id
 * @param sessionId
 */
export function switchCurrentSession(sessionId: string) {
  const store = getDefaultStore()
  store.set(atoms.currentSessionIdAtom, sessionId)
  router.navigate({
    to: `/session/${sessionId}`,
  })
  // scrollActions.scrollToBottom() // 切换会话时自动滚动到底部
  scrollActions.clearAutoScroll() // 切换会话时清除自动滚动
}

/**
 * 切换当前会话，根据排序后的索引
 * @param index
 * @returns
 */
export function switchToIndex(index: number) {
  const store = getDefaultStore()
  const sessions = store.get(atoms.sortedSessionsListAtom)
  const target = sessions[index]
  if (!target) {
    return
  }
  switchCurrentSession(target.id)
}

/**
 * 将当前会话切换到下一个，根据排序后到会话列表顺序
 * @param reversed 是否反向切换到上一个
 * @returns
 */
export function switchToNext(reversed?: boolean) {
  const store = getDefaultStore()
  const sessions = store.get(atoms.sortedSessionsListAtom)
  const currentSessionId = store.get(atoms.currentSessionIdAtom)
  const currentIndex = sessions.findIndex((s) => s.id === currentSessionId)
  if (currentIndex < 0) {
    switchCurrentSession(sessions[0].id)
    return
  }
  let targetIndex = reversed ? currentIndex - 1 : currentIndex + 1
  if (targetIndex >= sessions.length) {
    targetIndex = 0
  }
  if (targetIndex < 0) {
    targetIndex = sessions.length - 1
  }
  const target = sessions[targetIndex]
  switchCurrentSession(target.id)
}

/**
 * 编辑历史话题(目前只支持修改名称)
 * @param sessionId 会话 id
 * @param threadId 历史话题 id
 * @param newThread  Pick<Partial<SessionThread>, 'name'>
 * @returns
 */
export function editThread(sessionId: string, threadId: string, newThread: Pick<Partial<SessionThread>, 'name'>) {
  const session = getSession(sessionId)
  if (!session || !session.threads) return

  // 特殊情况： 如果修改的是当前的话题，则直接修改当前会话的threadName, 而不是name
  if (threadId === sessionId) {
    saveSession(sessionId, { threadName: newThread.name })
    return
  }

  const targetThread = session.threads.find((t) => t.id === threadId)
  if (!targetThread) return

  const threads = session.threads.map((t) => {
    if (t.id !== threadId) return t
    return { ...t, ...newThread }
  })

  saveSession(sessionId, { threads })
}

/**
 * 删除历史话题
 * @param sessionId 会话 id
 * @param threadId 历史话题 id
 */
export function removeThread(sessionId: string, threadId: string) {
  if (sessionId === threadId) {
    removeCurrentThread(sessionId)
    return
  }
  const session = getSession(sessionId)
  if (!session) {
    return
  }
  saveSession(sessionId, {
    threads: session.threads?.filter((t) => t.id !== threadId),
  })
}

/**
 * 清空会话中的所有消息，仅保留 system prompt
 * @param sessionId
 * @returns
 */
export function clear(sessionId: string) {
  const session = getSession(sessionId)
  if (!session) {
    return
  }
  session.messages.forEach((msg) => {
    msg?.cancel?.()
  })
  saveSession(sessionId, {
    messages: session.messages.filter((m) => m.role === 'system').slice(0, 1),
    threads: undefined,
  })
}

/**
 * 复制会话
 * @param source
 */
export async function copy(source: SessionMeta) {
  const newSession = await copySession(source)
  switchCurrentSession(newSession.id)
}

/**
 * 将会话中的当前消息移动到历史记录中，并清空上下文
 * @param sessionId
 */
export function refreshContextAndCreateNewThread(sessionId: string) {
  const session = getSession(sessionId)
  if (!session) {
    return
  }
  for (const m of session.messages) {
    m?.cancel?.()
  }
  const newThread: SessionThread = {
    id: uuidv4(),
    name: session.threadName || session.name,
    messages: session.messages,
    createdAt: Date.now(),
  }

  let systemPrompt = session.messages.find((m) => m.role === 'system')
  if (systemPrompt) {
    systemPrompt = createMessage('system', getMessageText(systemPrompt))
  }
  saveSession(sessionId, {
    ...session,
    threads: session.threads ? [...session.threads, newThread] : [newThread],
    messages: systemPrompt ? [systemPrompt] : [createMessage('system', defaults.getDefaultPrompt())],
    threadName: '',
    messageForksHash: undefined,
  })
}

export function startNewThread() {
  const store = getDefaultStore()
  const sessionId = store.get(atoms.currentSessionIdAtom)
  refreshContextAndCreateNewThread(sessionId)
  // 自动滚动到底部并自动聚焦到输入框
  setTimeout(() => {
    scrollActions.scrollToBottom()
    dom.focusMessageInput()
  }, 100)
}

/**
 * 压缩当前会话并创建新话题，保留压缩后的上下文
 * @param sessionId 会话ID
 * @param summary 压缩后的总结内容
 */
export function compressAndCreateThread(sessionId: string, summary: string) {
  const session = getSession(sessionId)
  if (!session) {
    return
  }

  // 取消所有正在进行的消息生成
  for (const m of session.messages) {
    m?.cancel?.()
  }

  // 创建包含所有消息的新话题
  const newThread: SessionThread = {
    id: uuidv4(),
    name: session.threadName || session.name,
    messages: session.messages,
    createdAt: Date.now(),
  }

  // 获取原始的系统提示（如果存在）
  const systemPrompt = session.messages.find((m) => m.role === 'system')
  let systemPromptText = ''
  if (systemPrompt) {
    systemPromptText = getMessageText(systemPrompt)
  }

  // 创建新的消息列表，包含原始系统提示和压缩后的上下文
  const newMessages: Message[] = []

  // 如果有系统提示，先添加系统提示
  if (systemPromptText) {
    newMessages.push(createMessage('system', systemPromptText))
  }

  // 添加压缩后的上下文作为系统消息
  const compressionContext = `Previous conversation summary:\n\n${summary}`
  newMessages.push(createMessage('user', compressionContext))

  // 保存会话
  saveSession(sessionId, {
    ...session,
    threads: session.threads ? [...session.threads, newThread] : [newThread],
    messages: newMessages,
    threadName: '',
    messageForksHash: undefined,
  })

  // 自动滚动到底部并自动聚焦到输入框
  setTimeout(() => {
    scrollActions.scrollToBottom()
    dom.focusMessageInput()
  }, 100)
}

/**
 * 切换到历史记录中的某个上下文，原有上下文存储到历史记录中
 * @param sessionId
 * @param threadId
 */
export function switchThread(sessionId: string, threadId: string) {
  const session = getSession(sessionId)
  if (!session || !session.threads) {
    return
  }
  const target = session.threads.find((h) => h.id === threadId)
  if (!target) {
    return
  }
  for (const m of session.messages) {
    m?.cancel?.()
  }
  const newThreads = session.threads.filter((h) => h.id !== threadId)
  newThreads.push({
    id: uuidv4(),
    name: session.threadName || session.name,
    messages: session.messages,
    createdAt: Date.now(),
  })
  saveSession(sessionId, {
    ...session,
    threads: newThreads,
    messages: target.messages,
    threadName: target.name,
  })
  setTimeout(() => scrollActions.scrollToBottom('smooth'), 300)
}

/**
 * 删除某个会话的当前话题。如果该会话存在历史话题，则会回退到上一个话题；如果该会话没有历史话题，则会清空当前会话
 * @param sessionId
 */
export function removeCurrentThread(sessionId: string) {
  const session = getSession(sessionId)
  if (!session) {
    return
  }
  const updatedSession: Session = {
    ...session,
    messages: session.messages.filter((m) => m.role === 'system').slice(0, 1), // 仅保留一条系统提示
    threadName: undefined,
  }
  if (session.threads && session.threads.length > 0) {
    const lastThread = session.threads[session.threads.length - 1]
    updatedSession.messages = lastThread.messages
    updatedSession.threads = session.threads.slice(0, session.threads.length - 1)
    updatedSession.threadName = lastThread.name
  }
  saveSession(sessionId, updatedSession)
}

export async function moveThreadToConversations(sessionId: string, threadId: string) {
  if (sessionId === threadId) {
    moveCurrentThreadToConversations(sessionId)
    return
  }
  const session = getSession(sessionId)
  if (!session) {
    return
  }
  const targetThread = session.threads?.find((t) => t.id === threadId)
  if (!targetThread) {
    return
  }
  const newSession = await copySession({
    ...session,
    name: targetThread.name,
    messages: targetThread.messages,
    threads: [],
    threadName: undefined,
  })
  removeThread(sessionId, threadId)
  switchCurrentSession(newSession.id)
}

export async function moveCurrentThreadToConversations(sessionId: string) {
  const session = getSession(sessionId)
  if (!session) {
    return
  }
  const newSession = await copySession({
    ...session,
    name: session.threadName || session.name,
    messages: session.messages,
    threads: [],
    threadName: undefined,
  })
  removeCurrentThread(sessionId)
  switchCurrentSession(newSession.id)
}

/**
 * 在当前主题的最后插入一条消息。
 * @param sessionId
 * @param msg
 */
export function insertMessage(sessionId: string, msg: Message) {
  const session = getSession(sessionId)
  if (!session) {
    return
  }
  msg.wordCount = countMessageWords(msg)
  msg.tokenCount = estimateTokensFromMessages([msg])
  saveSession(sessionId, (s) => ({
    messages: [...(s?.messages || []), msg],
  }))
}

/**
 * 在某条消息后面插入新消息。如果消息在历史主题中，也能支持插入
 * @param sessionId
 * @param msg
 * @param afterMsgId
 */
export function insertMessageAfter(sessionId: string, msg: Message, afterMsgId: string) {
  const session = getSession(sessionId)
  if (!session) {
    return
  }
  msg.wordCount = countMessageWords(msg)
  msg.tokenCount = estimateTokensFromMessages([msg])
  let hasHandled = false
  const handle = (msgs: Message[]) => {
    const index = msgs.findIndex((m) => m.id === afterMsgId)
    if (index < 0) {
      return msgs
    }
    hasHandled = true
    return [...msgs.slice(0, index + 1), msg, ...msgs.slice(index + 1)]
  }

  const updatedSession = { ...session }
  updatedSession.messages = handle(session.messages)
  if (session.threads && !hasHandled) {
    updatedSession.threads = session.threads.map((h) => ({
      ...h,
      messages: handle(h.messages),
    }))
  }
  saveSession(sessionId, updatedSession)
}

/**
 * 根据 id 修改消息。如果消息在历史主题中，也能支持修改
 * @param sessionId
 * @param updated
 * @param refreshCounting
 */
export function modifyMessage(sessionId: string, updated: Message, refreshCounting?: boolean) {
  const session = getSession(sessionId)
  if (!session) {
    return
  }
  if (refreshCounting) {
    updated.wordCount = countMessageWords(updated)
    updated.tokenCount = estimateTokensFromMessages([updated])
  }

  // 更新消息时间戳
  updated.timestamp = Date.now()

  let hasHandled = false
  const handle = (msgs: Message[]): Message[] => {
    return msgs.map((m) => {
      if (m.id === updated.id) {
        hasHandled = true
        return { ...updated }
      }
      return m
    })
  }

  const updatedSession = { ...session }
  updatedSession.messages = handle(session.messages)

  if (!hasHandled && updatedSession.threads) {
    updatedSession.threads = updatedSession.threads.map((h) => ({
      ...h,
      messages: handle(h.messages),
    }))
  }

  if (!hasHandled && updatedSession.messageForksHash) {
    const keys = Object.keys(updatedSession.messageForksHash)
    for (const key of keys) {
      updatedSession.messageForksHash = {
        ...updatedSession.messageForksHash,
        [key]: {
          ...updatedSession.messageForksHash[key],
          lists: updatedSession.messageForksHash[key].lists.map((l) => ({
            ...l,
            messages: handle(l.messages),
          })),
        },
      }
    }
  }
  saveSession(sessionId, updatedSession)
}

/**
 * 在会话中删除消息。如果消息存在于历史主题中，也能支持删除
 * @param sessionId
 * @param messageId
 */
export function removeMessage(sessionId: string, messageId: string) {
  const session = getSession(sessionId)
  if (!session) {
    return
  }

  const updatedSession = { ...session }
  updatedSession.messages = session.messages.filter((m) => m.id !== messageId)

  if (session.threads) {
    updatedSession.threads = session.threads
      .map((h) => ({
        ...h,
        messages: h.messages.filter((m) => m.id !== messageId),
      }))
      .filter((h) => h.messages.length > 0)
  }

  // 删除消息的同时，也触发对消息分支的清理
  if (session.messageForksHash) {
    updatedSession.messageForksHash = { ...session.messageForksHash }
    delete updatedSession.messageForksHash[messageId]
  }

  // 如果某个对话的消息为空，尽量使用上一个话题的消息
  if (updatedSession.messages.length === 0 && updatedSession.threads && updatedSession.threads.length > 0) {
    const lastThread = updatedSession.threads[updatedSession.threads.length - 1]
    updatedSession.messages = lastThread.messages
    updatedSession.threads = updatedSession.threads.slice(0, updatedSession.threads.length - 1)
  }

  saveSession(sessionId, updatedSession)
}

/**
 * 预处理文件以获取内容和存储键
 * @param file 文件对象
 * @param settings 会话设置
 * @param tokenLimit 每个文件的token限制
 * @returns 预处理后的文件信息
 */
export async function preprocessFile(
  file: File,
  settings: SessionSettings
): Promise<{
  file: File
  content: string
  storageKey: string
  tokenCountMap?: Record<string, number>
  error?: string
}> {
  const remoteConfig = settingActions.getRemoteConfig()

  try {
    const isChatboxAI = settings.provider === ModelProviderEnum.ChatboxAI
    const uniqKey = StorageKeyGenerator.fileUniqKey(file)

    // 检查是否已经处理过这个文件
    const existingContent = await storage.getBlob(uniqKey).catch(() => null)
    if (existingContent) {
      // Get existing token map or create new one
      const existingTokenMap: Record<string, number> = (await storage.getItem(`${uniqKey}_tokenMap`, {})) as Record<
        string,
        number
      >

      // Calculate tokens for both tokenizers if not cached
      if (!existingTokenMap[TOKEN_CACHE_KEYS.default]) {
        existingTokenMap[TOKEN_CACHE_KEYS.default] = estimateTokens(existingContent)
      }
      if (!existingTokenMap[TOKEN_CACHE_KEYS.deepseek]) {
        existingTokenMap[TOKEN_CACHE_KEYS.deepseek] = estimateTokens(existingContent, {
          provider: '',
          modelId: 'deepseek',
        })
      }

      // Save updated token map if changes were made
      if (!existingTokenMap[TOKEN_CACHE_KEYS.default] || !existingTokenMap[TOKEN_CACHE_KEYS.deepseek]) {
        await storage.setItem(`${uniqKey}_tokenMap`, existingTokenMap)
      }

      return {
        file,
        content: existingContent,
        storageKey: uniqKey,
        tokenCountMap: existingTokenMap,
      }
    }

    if (isChatboxAI) {
      // ChatboxAI 方案：上传文件并获取内容
      const licenseKey = settingActions.getLicenseKey()
      const uploadedKey = await remote.uploadAndCreateUserFile(licenseKey || '', file)

      // 获取上传后的文件内容（如果可用）
      const content = (await storage.getBlob(uploadedKey).catch(() => '')) || ''

      // 将内容存储到唯一键下
      if (content) {
        await storage.setBlob(uniqKey, content)
      }

      // Calculate token counts for both tokenizers
      const tokenCountMap: Record<string, number> = content
        ? {
            [TOKEN_CACHE_KEYS.default]: estimateTokens(content),
            [TOKEN_CACHE_KEYS.deepseek]: estimateTokens(content, { provider: '', modelId: 'deepseek' }),
          }
        : {}

      // Store token map for future use
      if (content) {
        await storage.setItem(`${uniqKey}_tokenMap`, tokenCountMap)
      }

      return {
        file,
        content,
        storageKey: uniqKey,
        tokenCountMap,
      }
    } else {
      // 本地方案：解析文件内容
      const result = await platform.parseFileLocally(file)
      if (!result.isSupported || !result.key) {
        if (platform.type === 'mobile') {
          throw new Error('mobile_not_support_local_file_parsing')
        }
        // 根据当前 IP，判断是否在错误中推荐 Chatbox AI
        if (remoteConfig.setting_chatboxai_first) {
          throw new Error('model_not_support_file')
        } else {
          throw new Error('model_not_support_file_2')
        }
      }

      // 从临时存储中获取文件内容
      const content = (await storage.getBlob(result.key).catch(() => '')) || ''

      // 将内容存储到唯一键下
      if (content) {
        await storage.setBlob(uniqKey, content)
      }

      // Calculate token counts for both tokenizers
      const tokenCountMap: Record<string, number> = content
        ? {
            [TOKEN_CACHE_KEYS.default]: estimateTokens(content),
            [TOKEN_CACHE_KEYS.deepseek]: estimateTokens(content, { provider: '', modelId: 'deepseek' }),
          }
        : {}

      // Store token map for future use
      if (content) {
        await storage.setItem(`${uniqKey}_tokenMap`, tokenCountMap)
      }

      return {
        file,
        content,
        storageKey: uniqKey,
        tokenCountMap,
      }
    }
  } catch (error) {
    return {
      file,
      content: '',
      storageKey: '',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * 预处理链接以获取内容
 * @param url 链接地址
 * @param settings 会话设置
 * @returns 预处理后的链接信息
 */
export async function preprocessLink(
  url: string,
  settings: SessionSettings
): Promise<{
  url: string
  title: string
  content: string
  storageKey: string
  tokenCountMap?: Record<string, number>
  error?: string
}> {
  try {
    const isChatboxAI = settings.provider === ModelProviderEnum.ChatboxAI
    const uniqKey = StorageKeyGenerator.linkUniqKey(url)

    // 检查是否已经处理过这个链接
    const existingContent = await storage.getBlob(uniqKey).catch(() => null)
    if (existingContent) {
      // 如果已经有内容，尝试从内容中提取标题
      const titleMatch = existingContent.match(/<title[^>]*>([^<]+)<\/title>/i)
      const title = titleMatch ? titleMatch[1] : url.replace(/^https?:\/\//, '')

      // Get existing token map or create new one
      const existingTokenMap: Record<string, number> = (await storage.getItem(`${uniqKey}_tokenMap`, {})) as Record<
        string,
        number
      >

      // Calculate tokens for both tokenizers if not cached
      if (!existingTokenMap[TOKEN_CACHE_KEYS.default]) {
        existingTokenMap[TOKEN_CACHE_KEYS.default] = estimateTokens(existingContent)
      }
      if (!existingTokenMap[TOKEN_CACHE_KEYS.deepseek]) {
        existingTokenMap[TOKEN_CACHE_KEYS.deepseek] = estimateTokens(existingContent, {
          provider: '',
          modelId: 'deepseek',
        })
      }

      // Save updated token map if changes were made
      if (!existingTokenMap[TOKEN_CACHE_KEYS.default] || !existingTokenMap[TOKEN_CACHE_KEYS.deepseek]) {
        await storage.setItem(`${uniqKey}_tokenMap`, existingTokenMap)
      }

      return {
        url,
        title,
        content: existingContent,
        storageKey: uniqKey,
        tokenCountMap: existingTokenMap,
      }
    }

    if (isChatboxAI) {
      // ChatboxAI 方案：使用远程解析
      const licenseKey = settingActions.getLicenseKey()
      const parsed = await remote.parseUserLinkPro({ licenseKey: licenseKey || '', url })

      // 获取解析后的内容
      const content = (await storage.getBlob(parsed.storageKey).catch(() => '')) || ''

      // 将内容存储到唯一键下
      if (content) {
        await storage.setBlob(uniqKey, content)
      }

      // Calculate token counts for both tokenizers
      const tokenCountMap: Record<string, number> = content
        ? {
            [TOKEN_CACHE_KEYS.default]: estimateTokens(content),
            [TOKEN_CACHE_KEYS.deepseek]: estimateTokens(content, { provider: '', modelId: 'deepseek' }),
          }
        : {}

      // Store token map for future use
      if (content) {
        await storage.setItem(`${uniqKey}_tokenMap`, tokenCountMap)
      }

      return {
        url,
        title: parsed.title,
        content,
        storageKey: uniqKey,
        tokenCountMap,
      }
    } else {
      // 本地方案：解析链接内容
      const { key, title } = await localParser.parseUrl(url)
      const content = (await storage.getBlob(key).catch(() => '')) || ''

      // 将内容存储到唯一键下
      if (content) {
        await storage.setBlob(uniqKey, content)
      }

      // Calculate token counts for both tokenizers
      const tokenCountMap: Record<string, number> = content
        ? {
            [TOKEN_CACHE_KEYS.default]: estimateTokens(content),
            [TOKEN_CACHE_KEYS.deepseek]: estimateTokens(content, { provider: '', modelId: 'deepseek' }),
          }
        : {}

      // Store token map for future use
      if (content) {
        await storage.setItem(`${uniqKey}_tokenMap`, tokenCountMap)
      }

      return {
        url,
        title,
        content,
        storageKey: uniqKey,
        tokenCountMap,
      }
    }
  } catch (error) {
    return {
      url,
      title: url.replace(/^https?:\/\//, ''),
      content: '',
      storageKey: '',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * 构建用户消息，只包含元数据不包含内容
 * @param text 消息文本
 * @param pictureKeys 图片存储键列表
 * @param preprocessedFiles 预处理后的文件信息
 * @param preprocessedLinks 预处理后的链接信息
 * @returns 构建好的消息对象
 */
export function constructUserMessage(
  text: string,
  pictureKeys: string[] = [],
  preprocessedFiles: Array<{
    file: File
    content: string
    storageKey: string
    tokenCountMap?: Record<string, number>
  }> = [],
  preprocessedLinks: Array<{
    url: string
    title: string
    content: string
    storageKey: string
    tokenCountMap?: Record<string, number>
  }> = []
): Message {
  // 只使用原始文本，不添加文件和链接内容
  const msg = createMessage('user', text)

  // 添加图片
  if (pictureKeys.length > 0) {
    msg.contentParts = msg.contentParts ?? []
    msg.contentParts.push(...pictureKeys.map((k) => ({ type: 'image' as const, storageKey: k })))
  }

  // 添加附件元数据（只包含存储键，不包含内容）
  if (preprocessedFiles.length > 0) {
    msg.files = preprocessedFiles.map((f) => ({
      id: f.storageKey || f.file.name,
      name: f.file.name,
      fileType: f.file.type,
      storageKey: f.storageKey,
      tokenCountMap: f.tokenCountMap,
    }))
  }

  // 添加链接元数据（只包含存储键，不包含内容）
  if (preprocessedLinks.length > 0) {
    msg.links = preprocessedLinks.map((l) => ({
      id: l.storageKey || l.url,
      url: l.url,
      title: l.title,
      storageKey: l.storageKey,
      tokenCountMap: l.tokenCountMap,
    }))
  }

  return msg
}

/**
 * 在会话中发送新用户消息，并根据需要生成回复
 * @param params
 */
export async function submitNewUserMessage(params: {
  currentSessionId: string
  newUserMsg: Message
  needGenerating: boolean
}) {
  const { currentSessionId, newUserMsg, needGenerating } = params
  const webBrowsing = uiStore.getState().inputBoxWebBrowsingMode

  // 先在聊天列表中插入发送的用户消息
  insertMessage(currentSessionId, newUserMsg)

  const settings = getCurrentSessionMergedSettings()
  const globalSettings = settingsStore.getState().getSettings()
  const isChatboxAI = settings.provider === ModelProviderEnum.ChatboxAI
  const remoteConfig = settingActions.getRemoteConfig()

  // 根据需要，插入空白的回复消息
  let newAssistantMsg = createMessage('assistant', '')
  if (newUserMsg.files && newUserMsg.files.length > 0) {
    if (!newAssistantMsg.status) {
      newAssistantMsg.status = []
    }
    newAssistantMsg.status.push({
      type: 'sending_file',
      mode: isChatboxAI ? 'advanced' : 'local',
    })
  }
  if (newUserMsg.links && newUserMsg.links.length > 0) {
    if (!newAssistantMsg.status) {
      newAssistantMsg.status = []
    }
    newAssistantMsg.status.push({
      type: 'loading_webpage',
      mode: isChatboxAI ? 'advanced' : 'local',
    })
  }
  if (needGenerating) {
    newAssistantMsg.generating = true
    insertMessage(currentSessionId, newAssistantMsg)
  }

  try {
    // 如果本次消息开启了联网问答，需要检查当前模型是否支持
    // 桌面版&手机端总是支持联网问答，不再需要检查模型是否支持
    const dependencies = await createModelDependencies()
    const model = getModel(settings, globalSettings, { uuid: '' }, dependencies)
    if (webBrowsing && platform.type === 'web' && !model.isSupportToolUse()) {
      if (remoteConfig.setting_chatboxai_first) {
        throw ChatboxAIAPIError.fromCodeName('model_not_support_web_browsing', 'model_not_support_web_browsing')
      } else {
        throw ChatboxAIAPIError.fromCodeName('model_not_support_web_browsing_2', 'model_not_support_web_browsing_2')
      }
    }

    // Files and links are now preprocessed in InputBox with storage keys, so no need to process them here
    // Just verify they have storage keys
    if (newUserMsg.files?.length) {
      const missingStorageKeys = newUserMsg.files.filter((f) => !f.storageKey)
      if (missingStorageKeys.length > 0) {
        console.warn('Files without storage keys found:', missingStorageKeys)
      }
    }
    if (newUserMsg.links?.length) {
      const missingStorageKeys = newUserMsg.links.filter((l) => !l.storageKey)
      if (missingStorageKeys.length > 0) {
        console.warn('Links without storage keys found:', missingStorageKeys)
      }
    }
  } catch (err: unknown) {
    // 如果文件上传失败，一定会出现带有错误信息的回复消息
    const error = !(err instanceof Error) ? new Error(`${err}`) : err
    if (
      !(
        error instanceof ApiError ||
        error instanceof NetworkError ||
        error instanceof AIProviderNoImplementedPaintError
      )
    ) {
      Sentry.captureException(error) // unexpected error should be reported
    }
    if (!(err instanceof ApiError || err instanceof NetworkError || err instanceof AIProviderNoImplementedPaintError)) {
      Sentry.captureException(err) // unexpected error should be reported
    }
    let errorCode: number | undefined
    if (err instanceof BaseError) {
      errorCode = err.code
    }

    newAssistantMsg = {
      ...newAssistantMsg,
      generating: false,
      cancel: undefined,
      model: await getModelDisplayName(settings, globalSettings, 'chat'),
      contentParts: [{ type: 'text', text: '' }],
      errorCode,
      error: `${error.message}`, // 这么写是为了避免类型问题
      status: [],
    }
    if (needGenerating) {
      modifyMessage(currentSessionId, newAssistantMsg)
    } else {
      insertMessage(currentSessionId, newAssistantMsg)
    }
    return // 文件上传失败，不再继续生成回复
  }
  // 根据需要，生成这条回复消息
  if (needGenerating) {
    return generate(currentSessionId, newAssistantMsg, { operationType: 'send_message' })
  }
}

/**
 * 执行消息生成，会修改消息的状态
 * @param sessionId
 * @param targetMsg
 * @returns
 */
export async function generate(
  sessionId: string,
  targetMsg: Message,
  options?: { operationType?: 'send_message' | 'regenerate' }
) {
  // 获得依赖的数据
  const store = getDefaultStore()
  const globalSettings = settingsStore.getState().getSettings()
  const configs = await platform.getConfig()
  const session = getSession(sessionId)
  if (!session) {
    return
  }
  const settings = mergeSettings(globalSettings, session.settings, session.type)

  // 跟踪生成事件
  trackGenerateEvent(settings, globalSettings, session.type, options)

  // 将消息的状态修改成初始状态
  targetMsg = {
    ...targetMsg,
    // FIXME: 图片消息生成时，需要展示 placeholder
    // pictures: session.type === 'picture' ? createLoadingPictures(settings.imageGenerateNum) : targetMsg.pictures,
    cancel: undefined,
    aiProvider: settings.provider,
    model: await getModelDisplayName(settings, globalSettings, session.type || 'chat'),
    style: session.type === 'picture' ? settings.dalleStyle : undefined,
    generating: true,
    errorCode: undefined,
    error: undefined,
    errorExtra: undefined,
    status: [],
    firstTokenLatency: undefined,
    // Set isStreamingMode once during Message initialization (constant property)
    isStreamingMode: settings.stream !== false,
  }

  modifyMessage(sessionId, targetMsg)
  setTimeout(() => {
    scrollActions.scrollToMessage(targetMsg.id, 'end')
  }, 50) // 等待消息渲染完成后再滚动到底部，否则会出现滚动不到底部的问题

  // 获取目标消息所在的消息列表（可能是历史消息），获取目标消息的索引
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
    const model = getModel(settings, globalSettings, configs, dependencies)
    const sessionKnowledgeBaseMap = uiStore.getState().sessionKnowledgeBaseMap
    const knowledgeBase = sessionKnowledgeBaseMap[sessionId]
    const webBrowsing = uiStore.getState().inputBoxWebBrowsingMode
    switch (session.type) {
      // 对话消息生成
      case 'chat':
      case undefined: {
        const startTime = Date.now()
        let firstTokenLatency: number | undefined
        const promptMsgs = await genMessageContext(settings, messages.slice(0, targetMsgIx))
        const throttledModifyMessage = throttle<onResultChangeWithCancel>((updated) => {
          const textLength = getMessageText(targetMsg, true, true).length
          if (!firstTokenLatency && textLength > 0) {
            firstTokenLatency = Date.now() - startTime
          }
          targetMsg = {
            ...targetMsg,
            ...pickBy(updated, identity),
            status: textLength > 0 ? [] : targetMsg.status,
            firstTokenLatency,
          }
          modifyMessage(sessionId, targetMsg)
        }, 100)

        const result = await streamText(model, {
          sessionId,
          messages: promptMsgs,
          onResultChangeWithCancel: throttledModifyMessage,
          providerOptions: settings.providerOptions,
          knowledgeBase,
          webBrowsing,
        })
        targetMsg = {
          ...targetMsg,
          generating: false,
          cancel: undefined,
          tokensUsed: targetMsg.tokensUsed ?? estimateTokensFromMessages([...promptMsgs, targetMsg]),
          status: [],
          finishReason: result.finishReason,
        }
        modifyMessage(sessionId, targetMsg, true)
        break
      }
      // 图片消息生成
      case 'picture': {
        // 取当前消息之前最近的一条用户消息作为 prompt
        const userMessage = messages.slice(0, targetMsgIx).findLast((m) => m.role === 'user')
        if (!userMessage) {
          // 不应该找不到用户消息
          throw new Error('No user message found')
        }

        const insertImage = (image: MessageImagePart) => {
          targetMsg.contentParts.push(image)
          targetMsg.status = []
          modifyMessage(sessionId, targetMsg, true)
        }
        await generateImage(
          model,
          {
            message: userMessage,
            num: settings.imageGenerateNum || 1,
          },
          async (picBase64) => {
            const storageKey = StorageKeyGenerator.picture(`${sessionId}:${targetMsg.id}`)
            // 图片需要存储到 indexedDB，如果直接使用 OpenAI 返回的图片链接，图片链接将随着时间而失效
            await storage.setBlob(storageKey, picBase64)
            insertImage({ type: 'image', storageKey })
          }
        )
        targetMsg = {
          ...targetMsg,
          generating: false,
          cancel: undefined,
          status: [],
        }
        modifyMessage(sessionId, targetMsg, true)
        break
      }
      default:
        throw new Error(`Unknown session type: ${session.type}, generate failed`)
    }
    appleAppStore.tickAfterMessageGenerated()
  } catch (err: unknown) {
    const error = !(err instanceof Error) ? new Error(`${err}`) : err
    if (
      !(
        error instanceof ApiError ||
        error instanceof NetworkError ||
        error instanceof AIProviderNoImplementedPaintError
      )
    ) {
      Sentry.captureException(error) // unexpected error should be reported
    }
    if (!(err instanceof ApiError || err instanceof NetworkError || err instanceof AIProviderNoImplementedPaintError)) {
      Sentry.captureException(err) // unexpected error should be reported
    }
    let errorCode: number | undefined
    if (err instanceof BaseError) {
      errorCode = err.code
    }
    targetMsg = {
      ...targetMsg,
      generating: false,
      cancel: undefined,
      errorCode,
      error: `${error.message}`, // 这么写是为了避免类型问题
      errorExtra: {
        aiProvider: settings.provider,
        host: error instanceof NetworkError ? error.host : undefined,
        // biome-ignore lint/suspicious/noExplicitAny: FIXME: 找到有responseBody的error类型
        responseBody: (error as any).responseBody,
      },
      status: [],
    }
    modifyMessage(sessionId, targetMsg, true)
  }
}

/**
 * 在目标消息下方插入并生成一条新消息
 * @param sessionId 会话ID
 * @param msgId 消息ID
 */
export async function generateMore(sessionId: string, msgId: string) {
  const newAssistantMsg = createMessage('assistant', '')
  insertMessageAfter(sessionId, newAssistantMsg, msgId)
  await generate(sessionId, newAssistantMsg, { operationType: 'regenerate' })
}

export async function generateMoreInNewFork(sessionId: string, msgId: string) {
  await createNewFork(msgId)
  await generateMore(sessionId, msgId)
}

export async function regenerateInNewFork(sessionId: string, msg: Message) {
  const messageList = getCurrentMessages()
  const messageIndex = messageList.findIndex((m) => m.id === msg.id)
  const previousMessageIndex = messageIndex - 1
  if (previousMessageIndex < 0) {
    // 如果目标消息是第一条消息，则直接重新生成
    generate(sessionId, msg, { operationType: 'regenerate' })
    return
  }
  const forkMessage = messageList[previousMessageIndex]
  await createNewFork(forkMessage.id)
  return generateMore(sessionId, forkMessage.id)
}

async function _generateName(sessionId: string, modifyName: (sessionId: string, name: string) => void) {
  const globalSettings = settingsStore.getState().getSettings()
  const session = getSession(sessionId)
  if (!session) {
    return
  }
  const settings = {
    ...globalSettings,
    ...session.settings,
    // 图片会话使用gpt-4o-mini模型，否则会使用DALL-E-3
    ...(session.type === 'picture'
      ? {
          modelId: 'gpt-4o-mini',
        }
      : {}),
    ...(globalSettings.threadNamingModel
      ? {
          provider: globalSettings.threadNamingModel.provider as ModelProvider,
          modelId: globalSettings.threadNamingModel.model,
        }
      : {}),
  }
  const configs = await platform.getConfig()
  try {
    const dependencies = await createModelDependencies()
    const model = getModel(settings, globalSettings, configs, dependencies)
    const result = await generateText(
      model,
      promptFormat.nameConversation(
        session.messages.filter((m) => m.role !== 'system').slice(0, 4),
        languageNameMap[settings.language]
      )
    )
    let name =
      result.contentParts
        ?.filter((c) => c.type === 'text')
        .map((c) => c.text)
        .join('') || ''
    name = name.replace(/['"“”]/g, '').replace(/<think>.*?<\/think>/g, '')
    // name = name.slice(0, 10)    // 限制名字长度
    modifyName(session.id, name)
  } catch (e: unknown) {
    if (!(e instanceof ApiError || e instanceof NetworkError)) {
      Sentry.captureException(e) // unexpected error should be reported
    }
  }
}

// 全局跟踪正在进行的名称生成请求
const pendingNameGenerations = new Map<string, ReturnType<typeof setTimeout>>()
const activeNameGenerations = new Set<string>()
export async function generateNameAndThreadName(sessionId: string) {
  return _generateName(sessionId, modifyNameAndThreadName)
}

export async function generateThreadName(sessionId: string) {
  return _generateName(sessionId, modifyThreadName)
}

/**
 * 调度生成会话名称和线程名称（带去重和延迟）
 */
export function scheduleGenerateNameAndThreadName(sessionId: string) {
  const key = `name-${sessionId}`

  // 如果已经有正在进行的请求，不重复发送
  if (activeNameGenerations.has(key)) {
    return
  }

  // 清除之前的定时器
  const existingTimeout = pendingNameGenerations.get(key)
  if (existingTimeout) {
    clearTimeout(existingTimeout)
  }

  // 设置新的定时器，延迟1秒执行
  const timeout = setTimeout(async () => {
    pendingNameGenerations.delete(key)
    activeNameGenerations.add(key)

    try {
      await generateNameAndThreadName(sessionId)
    } finally {
      activeNameGenerations.delete(key)
    }
  }, 1000)

  pendingNameGenerations.set(key, timeout)
}

/**
 * 调度生成线程名称（带去重和延迟）
 */
export function scheduleGenerateThreadName(sessionId: string) {
  const key = `thread-${sessionId}`

  // 如果已经有正在进行的请求，不重复发送
  if (activeNameGenerations.has(key)) {
    return
  }

  // 清除之前的定时器
  const existingTimeout = pendingNameGenerations.get(key)
  if (existingTimeout) {
    clearTimeout(existingTimeout)
  }

  // 设置新的定时器，延迟1秒执行
  const timeout = setTimeout(async () => {
    pendingNameGenerations.delete(key)
    activeNameGenerations.add(key)

    try {
      await generateThreadName(sessionId)
    } finally {
      activeNameGenerations.delete(key)
    }
  }, 1000)

  pendingNameGenerations.set(key, timeout)
}

/**
 * 清理会话列表，保留指定数量的会话
 * @param keepNum 保留的会话数量（顶部顺序）
 */
export function clearConversationList(keepNum: number) {
  clearConversations(keepNum)
}

/**
 * 从历史消息中生成 prompt 上下文
 */
async function genMessageContext(settings: SessionSettings, msgs: Message[]) {
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
  const head = msgs[0].role === 'system' ? msgs[0] : undefined
  if (head) {
    msgs = msgs.slice(1)
  }
  let _totalLen = head ? estimateTokensFromMessages([head]) : 0
  let prompts: Message[] = []
  for (let i = msgs.length - 1; i >= 0; i--) {
    let msg = msgs[i]
    // 跳过错误消息
    if (msg.error || msg.errorCode) {
      continue
    }
    const size = estimateTokensFromMessages([msg]) + 20 // 20 作为预估的误差补偿
    // 只有 OpenAI 才支持上下文 tokens 数量限制
    if (settings.provider === 'openai') {
      // if (size + totalLen > openaiMaxContextTokens) {
      //     break
      // }
    }
    if (
      maxContextMessageCount < Number.MAX_SAFE_INTEGER &&
      prompts.length >= maxContextMessageCount + 1 // +1是为了保留用户最后一条输入消息
    ) {
      break
    }

    // 如果消息中包含本地文件（消息中携带有本地文件的storageKey），则将文件内容也作为 prompt 的一部分
    if (msg.files && msg.files.length > 0) {
      for (const [fileIndex, file] of msg.files.entries()) {
        if (file.storageKey) {
          msg = cloneMessage(msg) // 复制一份消息，避免修改原始消息
          const content = await storage.getBlob(file.storageKey).catch(() => '')
          if (content) {
            let attachment = `\n\n<ATTACHMENT_FILE>\n`
            attachment += `<FILE_INDEX>File ${fileIndex + 1}</FILE_INDEX>\n`
            attachment += `<FILE_NAME>${file.name}</FILE_NAME>\n`
            attachment += '<FILE_CONTENT>\n'
            attachment += `${content}\n`
            attachment += '</FILE_CONTENT>\n'
            attachment += `</ATTACHMENT_FILE>\n`
            msg = mergeMessages(msg, createMessage(msg.role, attachment))
          }
        }
      }
    }
    // 如果消息中包含本地链接（消息中携带有本地链接的storageKey），则将链接内容也作为 prompt 的一部分
    if (msg.links && msg.links.length > 0) {
      for (const [linkIndex, link] of msg.links.entries()) {
        if (link.storageKey) {
          msg = cloneMessage(msg) // 复制一份消息，避免修改原始消息
          const content = await storage.getBlob(link.storageKey).catch(() => '')
          if (content) {
            let attachment = `\n\n<ATTACHMENT_LINK>\n`
            attachment += `<LINK_INDEX>${linkIndex + 1}</LINK_INDEX>\n`
            attachment += `<LINK_URL>${link.url}</LINK_URL>\n`
            attachment += `<LINK_CONTENT>\n`
            attachment += `${content}\n`
            attachment += '</LINK_CONTENT>\n'
            attachment += `</ATTACHMENT_LINK>\n`
            msg = mergeMessages(msg, createMessage(msg.role, attachment))
          }
        }
      }
    }

    prompts = [msg, ...prompts]
    _totalLen += size
  }
  if (head) {
    prompts = [head, ...prompts]
  }
  return prompts
}

export function initEmptyChatSession(): Omit<Session, 'id'> {
  const settings = settingsStore.getState().getSettings()
  const { chat: lastUsedChatModel } = lastUsedModelStore.getState()
  const newSession: Omit<Session, 'id'> = {
    name: 'Untitled',
    type: 'chat',
    messages: [],
    settings: {
      maxContextMessageCount: settings.maxContextMessageCount || 6,
      temperature: settings.temperature || undefined,
      topP: settings.topP || undefined,
      ...(settings.defaultChatModel
        ? {
            provider: settings.defaultChatModel.provider,
            modelId: settings.defaultChatModel.model,
          }
        : lastUsedChatModel),
    },
  }
  if (settings.defaultPrompt) {
    newSession.messages.push(createMessage('system', settings.defaultPrompt || defaults.getDefaultPrompt()))
  }
  return newSession
}

export function initEmptyPictureSession(): Omit<Session, 'id'> {
  const { picture: lastUsedPictureModel } = lastUsedModelStore.getState()

  return {
    name: 'Untitled',
    type: 'picture',
    messages: [createMessage('system', i18n.t('Image Creator Intro') || '')],
    settings: {
      ...lastUsedPictureModel,
    },
  }
}

export function getSessions() {
  const store = getDefaultStore()
  return store.get(atoms.sessionsListAtom)
}

export function getSortedSessions() {
  const store = getDefaultStore()
  return store.get(atoms.sortedSessionsListAtom)
}

export function getCurrentSession() {
  const store = getDefaultStore()
  return store.get(atoms.currentSessionAtom)
}

export function getCurrentMessages() {
  const store = getDefaultStore()
  return store.get(atoms.currentMessageListAtom)
}

/**
 * 寻找某个消息所在的话题消息列表
 * @param sessionId 会话ID
 * @param messageId 消息ID
 * @returns 消息所在的话题消息列表
 */
export function getMessageThreadContext(sessionId: string, messageId: string): Message[] {
  const session = getSession(sessionId)
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

// export function mergeSettings(
//   globalSettings: Settings,
//   sessionSetting: SessionSettings,
//   sessionType?: 'picture' | 'chat'
// ): Settings {
//   let specialSettings = sessionSetting
//   // 过滤掉会话专属设置中不应该存在的设置项，为了兼容旧版本数据和防止疏漏
//   switch (sessionType) {
//     case 'picture':
//       specialSettings = pickPictureSettings(specialSettings as Settings)
//       break
//     case undefined:
//     case 'chat':
//     default:
//       specialSettings = settings2SessionSettings(specialSettings as Settings)
//       break
//   }
//   specialSettings = omit(specialSettings) // 需要 omit 来去除 undefined，否则会覆盖掉全局配置
//   const ret = {
//     ...globalSettings,
//     ...specialSettings, // 会话配置优先级高于全局配置
//   }
//   // 对于自定义模型提供方，只有模型 model 可以被会话配置覆盖
//   if (ret.customProviders) {
//     ret.customProviders = globalSettings.customProviders.map((provider) => {
//       if (specialSettings.customProviders) {
//         const specialProvider = specialSettings.customProviders.find((p) => p.id === provider.id)
//         if (specialProvider) {
//           return {
//             ...provider,
//             model: specialProvider.model, // model 字段的会话配置优先级高于全局配置
//           }
//         }
//       }
//       return provider
//     })
//   }
//   return ret
// }

export function mergeSettings(
  globalSettings: Settings,
  sessionSetting?: SessionSettings,
  sessionType?: 'picture' | 'chat'
): SessionSettings {
  if (!sessionSetting) {
    return SessionSettingsSchema.parse(globalSettings)
  }
  return SessionSettingsSchema.parse({
    ...globalSettings,
    ...(sessionType === 'picture'
      ? {
          imageGenerateNum: defaults.pictureSessionSettings().imageGenerateNum,
          dalleStyle: defaults.pictureSessionSettings().dalleStyle,
        }
      : {
          maxContextMessageCount: defaults.chatSessionSettings().maxContextMessageCount,
        }),
    ...sessionSetting,
  })
}

export function getCurrentSessionMergedSettings(): SessionSettings {
  const store = getDefaultStore()
  const globalSettings = settingsStore.getState().getSettings()
  const session = store.get(atoms.currentSessionAtom)
  if (!session || !session.settings) {
    return SessionSettingsSchema.parse(globalSettings)
  }
  return mergeSettings(globalSettings, session.settings, session.type)
}

export async function exportChat(session: Session, scope: ExportChatScope, format: ExportChatFormat) {
  const threads: SessionThread[] = scope === 'all_threads' ? session.threads || [] : []
  threads.push({
    id: session.id,
    name: session.threadName || session.name,
    messages: session.messages,
    createdAt: Date.now(),
  })

  if (format === 'Markdown') {
    const content = formatChatAsMarkdown(session.name, threads)
    platform.exporter.exportTextFile(`${session.name}.md`, content)
  } else if (format === 'TXT') {
    const content = formatChatAsTxt(session.name, threads)
    platform.exporter.exportTextFile(`${session.name}.txt`, content)
  } else if (format === 'HTML') {
    const content = await formatChatAsHtml(session.name, threads)
    platform.exporter.exportTextFile(`${session.name}.html`, content)
  }
}

export async function exportCurrentSessionChat(content: ExportChatScope, format: ExportChatFormat) {
  const store = getDefaultStore()
  const currentSession = store.get(atoms.currentSessionAtom)
  if (!currentSession) {
    return
  }
  await exportChat(currentSession, content, format)
}

export async function createNewFork(forkMessageId: string) {
  const store = getDefaultStore()
  const currentSession = store.get(atoms.currentSessionAtom)
  if (!currentSession) {
    return
  }

  const messageForksHash = currentSession.messageForksHash || {}

  const updateFn = (data: Message[]): { data: Message[]; updated: boolean } => {
    const forkMessageIndex = data.findIndex((m) => m.id === forkMessageId)
    if (forkMessageIndex < 0) {
      return { data, updated: false }
    }
    const forks = messageForksHash[forkMessageId] || {
      position: 0,
      lists: [
        {
          id: `fork_list_${uuidv4()}`,
          messages: [],
        },
      ],
      createdAt: Date.now(),
    }
    // 下方消息存储到当前游标位置
    const backupMessages = data.slice(forkMessageIndex + 1)
    if (backupMessages.length === 0) {
      return { data, updated: false }
    }
    forks.lists[forks.position] = {
      id: `fork_list_${uuidv4()}`,
      messages: backupMessages,
    }
    // 创建另一个新分支，作为新的游标位置
    forks.lists.push({
      id: `fork_list_${uuidv4()}`,
      messages: [],
    })
    forks.position = forks.lists.length - 1

    messageForksHash[forkMessageId] = forks
    data = data.slice(0, forkMessageIndex + 1)

    return { data, updated: true }
  }

  const { data, updated } = updateFn(currentSession.messages)
  if (updated) {
    saveSession(currentSession.id, {
      messages: data,
      messageForksHash,
    })
    // scrollActions.scrollToMessage(forkMessageId, 'start')
    return
  }
  for (let i = (currentSession.threads || []).length - 1; i >= 0; i--) {
    const thread = (currentSession.threads || [])[i]
    const { data, updated } = updateFn(thread.messages)
    if (updated) {
      saveSession(currentSession.id, {
        threads: currentSession.threads?.map((t) => (t.id === thread.id ? { ...t, messages: data } : t)),
        messageForksHash,
      })
      // scrollActions.scrollToMessage(forkMessageId, 'start')
      return
    }
  }
}

export async function switchFork(forkMessageId: string, direction: 'next' | 'prev') {
  const store = getDefaultStore()
  const currentSession = store.get(atoms.currentSessionAtom)
  if (!currentSession || !currentSession.messageForksHash) {
    return
  }
  const messageForksHash = currentSession.messageForksHash

  const updateFn = (data: Message[]): { data: Message[]; updated: boolean } => {
    const forks = messageForksHash[forkMessageId]
    if (forks.lists.length === 0) {
      return { data, updated: false }
    }
    const forkMessageIndex = data.findIndex((m) => m.id === forkMessageId)
    if (forkMessageIndex < 0) {
      return { data, updated: false }
    }
    const newPosition =
      direction === 'next'
        ? (forks.position + 1) % forks.lists.length
        : (forks.position - 1 + forks.lists.length) % forks.lists.length
    // 当前被分叉的消息存储在当前的游标位置
    forks.lists[forks.position].messages = data.slice(forkMessageIndex + 1)
    // 当前消息列表中移除被分叉的消息，并且添加新的游标位置的消息
    data = data.slice(0, forkMessageIndex + 1).concat(forks.lists[newPosition].messages)
    // 更新游标位置
    forks.position = newPosition
    // 清空新的游标位置的消息（因为已经在主分支了，所以清理以节省空间）
    forks.lists[newPosition].messages = []
    messageForksHash[forkMessageId] = forks
    return { data, updated: true }
  }

  const { data, updated } = updateFn(currentSession.messages)
  if (updated) {
    saveSession(currentSession.id, {
      messages: data,
      messageForksHash,
    })
    // scrollActions.scrollToMessage(forkMessageId, 'start')
    return
  }
  for (let i = (currentSession.threads || []).length - 1; i >= 0; i--) {
    const thread = (currentSession.threads || [])[i]
    const { data, updated } = updateFn(thread.messages)
    if (updated) {
      saveSession(currentSession.id, {
        threads: currentSession.threads?.map((t) => (t.id === thread.id ? { ...t, messages: data } : t)),
        messageForksHash,
      })
      // scrollActions.scrollToMessage(forkMessageId, 'start')
      return
    }
  }
}

/**
 * 删除某个消息的当前分叉
 * @param forkMessageId 消息ID
 */
export async function deleteFork(forkMessageId: string) {
  const store = getDefaultStore()
  const currentSession = store.get(atoms.currentSessionAtom)
  if (!currentSession || !currentSession.messageForksHash) {
    return
  }
  const messageForksHash = currentSession.messageForksHash

  const updateFn = (data: Message[]): { data: Message[]; updated: boolean } => {
    const forkMessageIndex = data.findIndex((m) => m.id === forkMessageId)
    if (forkMessageIndex < 0) {
      return { data, updated: false } // 只有找不到消息才返回 false
    }
    const forks = messageForksHash[forkMessageId]
    if (!forks) {
      return { data, updated: true }
    }
    // 删除消息列表中当前分叉的消息
    data = data.slice(0, forkMessageIndex + 1)
    // 清理当前分叉
    forks.lists = [...forks.lists.slice(0, forks.position), ...forks.lists.slice(forks.position + 1)]
    forks.position = Math.min(forks.position, forks.lists.length - 1)
    // 如果当前消息已经没有分支，则删除整个消息分叉信息
    if (forks.lists.length === 0) {
      delete messageForksHash[forkMessageId]
      return { data, updated: true }
    }
    // 将当前游标位置的消息添加到主消息列表中
    data = data.concat(forks.lists[forks.position].messages)
    forks.lists[forks.position].messages = []
    messageForksHash[forkMessageId] = forks
    return { data, updated: true }
  }

  // 更新当前消息列表，如果没有找到消息则自动更新线程消息列表
  const { data, updated } = updateFn(currentSession.messages)
  if (updated) {
    saveSession(currentSession.id, {
      messages: data,
      messageForksHash,
    })
    return
  }
  for (let i = (currentSession.threads || []).length - 1; i >= 0; i--) {
    const thread = (currentSession.threads || [])[i]
    const { data, updated } = updateFn(thread.messages)
    if (updated) {
      saveSession(currentSession.id, {
        threads: currentSession.threads?.map((t) => (t.id === thread.id ? { ...t, messages: data } : t)),
        messageForksHash,
      })
      return
    }
  }
}

/**
 * 将某条消息所有的分叉消息全部展开到当前消息列表中
 * @param forkMessageId 消息ID
 */
export async function expandFork(forkMessageId: string) {
  const store = getDefaultStore()
  const currentSession = store.get(atoms.currentSessionAtom)
  if (!currentSession || !currentSession.messageForksHash) {
    return
  }
  const messageForksHash = currentSession.messageForksHash

  const updateFn = (data: Message[]): { data: Message[]; updated: boolean } => {
    const forkMessageIndex = data.findIndex((m) => m.id === forkMessageId)
    if (forkMessageIndex < 0) {
      return { data, updated: false } // 只有找不到消息才返回 false
    }
    const forks = messageForksHash[forkMessageId]
    if (!forks) {
      return { data, updated: true }
    }
    // 将当前消息的所有分叉消息添加到主消息列表中
    for (const list of forks.lists) {
      data = data.concat(list.messages)
    }
    // 删除当前消息的所有分叉
    delete messageForksHash[forkMessageId]
    return { data, updated: true }
  }

  // 更新当前消息列表，如果没有找到消息则自动更新线程消息列表
  const { data, updated } = updateFn(currentSession.messages)
  if (updated) {
    saveSession(currentSession.id, {
      messages: data,
      messageForksHash,
    })
    return
  }
  for (let i = (currentSession.threads || []).length - 1; i >= 0; i--) {
    const thread = (currentSession.threads || [])[i]
    const { data, updated } = updateFn(thread.messages)
    if (updated) {
      saveSession(currentSession.id, {
        threads: currentSession.threads?.map((t) => (t.id === thread.id ? { ...t, messages: data } : t)),
        messageForksHash,
      })
      return
    }
  }
}
