import type { Message, MessageContentParts } from '@shared/types'
import type { ModelDependencies } from '@shared/types/adapters'
import type { FilePart, ImagePart, ModelMessage, ReasoningUIPart, TextPart } from 'ai'
import dayjs from 'dayjs'
import { compact } from 'lodash'
import { createModelDependencies } from '@/adapters'
import { settingsStore } from '@/stores/settingsStore'
import { cloneMessage, getMessageText } from '@/utils/message'

/**
 * Replace copilot template variables in a system prompt string.
 * Supported variables:
 *   {{CURRENT_DATE}} → YYYY-MM-DD
 *   {{CURRENT_TIME}} → HH:MM
 */
export function replaceCopilotTemplateVars(text: string): string {
  const now = dayjs()
  return text
    .replace(/\{\{CURRENT_DATE\}\}/g, now.format('YYYY-MM-DD'))
    .replace(/\{\{CURRENT_TIME\}\}/g, now.format('HH:mm'))
}

export async function replacePromptTemplateVars(
  text: string,
  options: {
    readClipboard?: boolean
  } = {}
): Promise<string> {
  let nextText = replaceCopilotTemplateVars(text)

  if (options.readClipboard && nextText.includes('{{CLIPBOARD}}')) {
    let clipboardText = ''
    try {
      clipboardText = await navigator.clipboard.readText()
    } catch (error) {
      console.warn('Failed to read clipboard for prompt template vars:', error)
    }
    nextText = nextText.replace(/\{\{CLIPBOARD\}\}/g, clipboardText)
  }

  return nextText
}

async function convertContentParts<T extends TextPart | ImagePart | FilePart>(
  contentParts: MessageContentParts,
  imageType: 'image' | 'file',
  dependencies: ModelDependencies,
  options?: { modelSupportVision: boolean }
): Promise<T[]> {
  return compact(
    await Promise.all(
      contentParts.map(async (c) => {
        if (c.type === 'text') {
          return { type: 'text', text: c.text } as T
        } else if (c.type === 'image') {
          if (options?.modelSupportVision === false) {
            return { type: 'text', text: `This is an image, OCR Result: \n${c.ocrResult}` } as T
          }
          try {
            const imageData = await dependencies.storage.getImage(c.storageKey)
            if (!imageData) {
              console.warn(`Image not found for storage key: ${c.storageKey}`)
              return null
            }
            const base64Data = imageData.replace(/^data:image\/[^;]+;base64,/, '')
            const mediaType = imageData.match(/^data:([^;]+)/)?.[1] || 'image/png'

            if (imageType === 'image') {
              return {
                type: 'image',
                image: base64Data,
                mediaType,
              } as T
            } else {
              return {
                type: 'file',
                data: base64Data,
                mediaType,
              } as T
            }
          } catch (error) {
            console.error(`Failed to get image for storage key ${c.storageKey}:`, error)
            return null
          }
        }
        return null
      })
    )
  )
}

async function convertUserContentParts(
  contentParts: MessageContentParts,
  dependencies: ModelDependencies,
  options?: { modelSupportVision: boolean }
): Promise<Array<TextPart | ImagePart>> {
  return await convertContentParts<TextPart | ImagePart>(contentParts, 'image', dependencies, options)
}

async function convertAssistantContentParts(
  contentParts: MessageContentParts,
  dependencies: ModelDependencies,
  options?: { includeReasoning?: boolean }
): Promise<Array<TextPart | FilePart | ReasoningUIPart>> {
  const convertedParts = await Promise.all(
    contentParts.map(async (part): Promise<TextPart | FilePart | ReasoningUIPart | null> => {
      if (part.type === 'reasoning') {
        if (!options?.includeReasoning) {
          return null
        }

        return {
          type: 'reasoning',
          text: part.text,
        }
      }

      const converted = await convertContentParts<TextPart | FilePart>([part], 'file', dependencies)
      return converted[0] || null
    })
  )

  return compact(convertedParts)
}

export async function convertToModelMessages(
  messages: Message[],
  options?: {
    modelSupportVision: boolean
    dependencies?: ModelDependencies
    includeAssistantReasoning?: boolean
  }
): Promise<ModelMessage[]> {
  const dependencies = options?.dependencies ?? (await createModelDependencies())
  const results = await Promise.all(
    messages.map(async (m): Promise<ModelMessage | null> => {
      switch (m.role) {
        case 'system':
          return {
            role: 'system' as const,
            content: replaceCopilotTemplateVars(getMessageText(m)),
          }
        case 'user': {
          const contentParts = await convertUserContentParts(m.contentParts || [], dependencies, options)
          return {
            role: 'user' as const,
            content: contentParts,
          }
        }
        case 'assistant': {
          const contentParts = m.contentParts || []
          return {
            role: 'assistant' as const,
            content: await convertAssistantContentParts(contentParts, dependencies, {
              includeReasoning: options?.includeAssistantReasoning,
            }),
          }
        }
        case 'tool':
          return null
        default: {
          const _exhaustiveCheck: never = m.role
          throw new Error(`Unknown role: ${_exhaustiveCheck}`)
        }
      }
    })
  )

  // Filter out null values manually instead of using compact
  return results.filter((result): result is ModelMessage => result !== null)
}

/**
 * Build personal info section for system prompt injection.
 * Returns empty string if injection is disabled or no entries exist.
 */
function buildPersonalInfoSection(): string {
  const userPersonalInfo = settingsStore.getState().userPersonalInfo
  if (!userPersonalInfo?.enableInjection) return ''
  const entries = userPersonalInfo?.entries ?? []
  if (entries.length === 0) return ''

  const infoLines = entries
    .filter((entry) => entry.key && entry.value)
    .map((entry) => `- ${entry.key}: ${entry.value}`)
    .join('\n')

  return infoLines ? `\n## Personal Info About You (the user):\n${infoLines}\n` : ''
}

/**
 * 在 system prompt 中注入模型信息
 * @param model
 * @param messages
 * @returns
 */
export function injectModelSystemPrompt(
  model: string,
  messages: Message[],
  additionalInfo: string,
  role: 'system' | 'user' = 'system'
) {
  const personalInfo = buildPersonalInfoSection()
  const metadataPrompt = `Current model: ${model}\nCurrent date: ${dayjs().format(
    'YYYY-MM-DD'
  )}${personalInfo}\n Additional info for this conversation: ${additionalInfo}\n\n`
  let hasInjected = false
  return messages.map((m) => {
    if (m.role === role && !hasInjected) {
      m = cloneMessage(m) // 复制，防止原始数据在其他地方被直接渲染使用
      m.contentParts = [{ type: 'text', text: metadataPrompt + getMessageText(m) }]
      hasInjected = true
    }
    return m
  })
}
