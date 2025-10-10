import { useDebouncedValue } from '@mantine/hooks'
import { useEffect, useState } from 'react'
import { estimateTokensFromMessages } from '@/packages/token'
import type { Message } from '../../shared/types'

export function useTokenCount(
  constructedMessage: Message | undefined,
  messages: Message[] | null,
  model?: { provider: string; modelId: string }
) {
  const [currentInputTokens, setCurrentInputTokens] = useState(0)
  const [contextTokens, setContextTokens] = useState(0)

  const [debouncedConstructedMessage] = useDebouncedValue(constructedMessage, 300)
  const [debouncedContextMessages] = useDebouncedValue(messages, 300)

  useEffect(() => {
    if (!debouncedConstructedMessage) {
      setCurrentInputTokens(0)
      return
    } else {
      console.debug('useTokenCount', 'calculate current input tokens')
      setCurrentInputTokens(
        estimateTokensFromMessages([debouncedConstructedMessage], 'input', {
          modelId: model?.modelId || '',
          provider: model?.provider || '',
        })
      )
    }
  }, [debouncedConstructedMessage, model?.modelId, model?.provider])

  useEffect(() => {
    if (!debouncedContextMessages) {
      setContextTokens(0)
      return
    }
    console.debug('useTokenCount', 'calculate context tokens')
    setContextTokens(
      estimateTokensFromMessages(debouncedContextMessages, 'input', {
        modelId: model?.modelId || '',
        provider: model?.provider || '',
      })
    )
  }, [debouncedContextMessages, model?.modelId, model?.provider])

  return {
    currentInputTokens,
    contextTokens,
    totalTokens: currentInputTokens + contextTokens,
  }
}
