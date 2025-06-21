import { createModelDependencies } from '@/adapters'
import { getMessageText, cloneMessage } from '@/utils/message'
import { TextPart, ImagePart, FilePart, CoreMessage } from 'ai'
import dayjs from 'dayjs'
import { compact } from 'lodash'
import { Message } from 'src/shared/types'
import { MessageContentParts } from 'src/shared/types'
import { ModelDependencies } from 'src/shared/types/adapters'

async function convertContentParts<T extends TextPart | ImagePart | FilePart>(
  contentParts: MessageContentParts,
  imageType: 'image' | 'file',
  dependencies: ModelDependencies
): Promise<T[]> {
  return compact(
    await Promise.all(
      contentParts.map(async (c) => {
        if (c.type === 'text') {
          return { type: 'text', text: c.text! } as T
        } else if (c.type === 'image') {
          const imageData = (await dependencies.storage.getImage(c.storageKey))?.replace(
            /^data:image\/[^;]+;base64,/,
            ''
          )
          return {
            type: imageType,
            ...(imageType === 'image' ? { image: imageData } : { data: imageData }),
            mimeType: 'image/png',
          } as T
        }
        return null
      })
    )
  )
}

async function convertUserContentParts(
  contentParts: MessageContentParts,
  dependencies: ModelDependencies
): Promise<Array<TextPart | ImagePart>> {
  return convertContentParts<TextPart | ImagePart>(contentParts, 'image', dependencies)
}

async function convertAssistantContentParts(
  contentParts: MessageContentParts,
  dependencies: ModelDependencies
): Promise<Array<TextPart | FilePart>> {
  return convertContentParts<TextPart | FilePart>(contentParts, 'file', dependencies)
}

export async function convertToCoreMessages(messages: Message[]): Promise<CoreMessage[]> {
  const dependencies = await createModelDependencies()
  return compact(
    await Promise.all(
      messages.map(async (m) => {
        switch (m.role) {
          case 'system':
            return {
              role: 'system' as const,
              content: getMessageText(m),
            }
          case 'user': {
            const contentParts = await convertUserContentParts(m.contentParts || [], dependencies)
            return {
              role: 'user' as const,
              content: contentParts,
            }
          }
          case 'assistant': {
            const contentParts = m.contentParts || []
            return {
              role: 'assistant' as const,
              content: await convertAssistantContentParts(contentParts, dependencies),
            }
          }
          case 'tool':
            return null
          default:
            const _exhaustiveCheck: never = m.role
            throw new Error(`Unkown role: ${_exhaustiveCheck}`)
        }
      })
    )
  )
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
  const metadataPrompt = `Current model: ${model}\nCurrent date: ${dayjs().format(
    'YYYY-MM-DD'
  )}\n Additional info for this conversation: ${additionalInfo}\n\n`
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
