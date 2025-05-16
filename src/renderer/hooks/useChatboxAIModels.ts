import { getModelManifest } from '@/packages/remote'
import { languageAtom } from '@/stores/atoms'
import { useQuery } from '@tanstack/react-query'
import { useAtomValue } from 'jotai'
import { useMemo } from 'react'
import { ModelProvider, ProviderModelInfo } from 'src/shared/types'
import { useProviderSettings } from './useSettings'

const useChatboxAIModels = () => {
  const language = useAtomValue(languageAtom)
  const { providerSettings: chatboxAISettings } = useProviderSettings(ModelProvider.ChatboxAI)

  const { data, ...others } = useQuery({
    queryKey: ['chatbox-ai-models', language],
    queryFn: async () => {
      const res = await getModelManifest({
        aiProvider: ModelProvider.ChatboxAI,
        language,
      })

      return res.models
    },
  })

  const allChatboxAIModels = useMemo(
    () =>
      data?.map(
        (item) =>
          ({
            modelId: item.modelId,
            nickname: item.modelName,
            labels: item.labels,
          } as ProviderModelInfo)
      ) || [],
    [data]
  )

  const chatboxAIModels = useMemo(
    () => allChatboxAIModels.filter((m) => !chatboxAISettings?.excludedModels?.includes(m.modelId)),
    [allChatboxAIModels, chatboxAISettings]
  )

  return { allChatboxAIModels, chatboxAIModels, ...others }
}

export default useChatboxAIModels
