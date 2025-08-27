import * as Sentry from '@sentry/react'
import { useMemo } from 'react'
import { estimateTokensFromMessages } from '@/packages/token'
import type { Message } from '../../shared/types'

export function useTokenCount(
  constructedMessage: Message | undefined,
  messages: Message[] = [],
  model?: { provider: string; modelId: string }
) {
  const stableMessages = useMemo(() => {
    return messages.filter((msg) => !msg.generating)
  }, [messages])

  return useMemo(() => {
    try {
      // Calculate current input tokens from the constructed message
      let currentInputTokens = 0

      if (constructedMessage) {
        currentInputTokens = estimateTokensFromMessages([constructedMessage], 'input', model)
      }

      // Calculate context tokens from messages
      const contextTokens = estimateTokensFromMessages(stableMessages, 'input', model)

      return {
        currentInputTokens,
        contextTokens,
        totalTokens: currentInputTokens + contextTokens,
      }
    } catch (e) {
      Sentry.captureException(e)
      return {
        currentInputTokens: 0,
        contextTokens: 0,
        totalTokens: 0,
      }
    }
  }, [constructedMessage, stableMessages, model])
}
