import * as Sentry from '@sentry/react'
import debounce from 'lodash/debounce'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { estimateTokensFromMessages } from '@/packages/token'
import type { Message } from '../../shared/types'

export function useTokenCount(
  constructedMessage: Message | undefined,
  messages: Message[] = [],
  model?: { provider: string; modelId: string }
) {
  // Note: messages should already be filtered to exclude generating messages at the atom level
  const contextTokens = useMemo(() => {
    return estimateTokensFromMessages(messages, 'input', model)
  }, [messages, model])

  // Debounced calculation for current input tokens
  const [currentInputTokens, setCurrentInputTokens] = useState(0)

  const debouncedCalculateInputTokens = useCallback(
    debounce((message: Message | undefined, modelConfig?: { provider: string; modelId: string }) => {
      try {
        if (!message) {
          setCurrentInputTokens(0)
          return
        }
        const tokens = estimateTokensFromMessages([message], 'input', modelConfig)
        setCurrentInputTokens(tokens)
      } catch (e) {
        Sentry.captureException(e)
        setCurrentInputTokens(0)
      }
    }, 300),
    []
  )

  useEffect(() => {
    debouncedCalculateInputTokens(constructedMessage, model)
    return () => {
      debouncedCalculateInputTokens.cancel()
    }
  }, [constructedMessage, model, debouncedCalculateInputTokens])

  return {
    currentInputTokens,
    contextTokens,
    totalTokens: currentInputTokens + contextTokens,
  }
}
