import * as Sentry from '@sentry/react'
import debounce from 'lodash/debounce'
import { useCallback, useEffect, useState } from 'react'
import { estimateTokensFromMessages } from '@/packages/token'
import type { Message } from '../../shared/types'

export function useTokenCount(
  constructedMessage: Message | undefined,
  messages: Message[] = [],
  model?: { provider: string; modelId: string }
) {
  const [contextTokens, setContextTokens] = useState(0)

  // Note: messages should already be filtered to exclude generating messages at the atom level
  const debouncedCalculateContextTokens = useCallback(
    debounce((messages: Message[], model?: { provider: string; modelId: string }) => {
      // console.log('calculate context tokens')
      setContextTokens(estimateTokensFromMessages(messages, 'input', model))
    }, 300),
    []
  )

  // Debounced calculation for current input tokens
  const [currentInputTokens, setCurrentInputTokens] = useState(0)

  const debouncedCalculateInputTokens = useCallback(
    debounce((message: Message | undefined, modelConfig?: { provider: string; modelId: string }) => {
      try {
        if (!message) {
          setCurrentInputTokens(0)
          return
        }
        // console.log('calculate current input tokens')
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
    debouncedCalculateContextTokens(messages, model)
    return () => {
      debouncedCalculateContextTokens.cancel()
    }
  }, [messages, model, debouncedCalculateContextTokens])

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
