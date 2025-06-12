import { getModelManifest } from '@/packages/remote'
import { languageAtom } from '@/stores/atoms'
import { useQuery } from '@tanstack/react-query'
import { useAtomValue } from 'jotai'
import { useMemo } from 'react'
import { ModelProviderEnum, ProviderModelInfo } from 'src/shared/types'
import { useProviderSettings } from './useSettings'

const useChatboxAIModels = () => {
  const language = useAtomValue(languageAtom)
  const { providerSettings: chatboxAISettings, setProviderSettings } = useProviderSettings(ModelProviderEnum.ChatboxAI)

  const { data, ...others } = useQuery({
    queryKey: ['chatbox-ai-models', language],
    queryFn: async () => {
      const res = await getModelManifest({
        aiProvider: ModelProviderEnum.ChatboxAI,
        language,
      })

      // ChatboxAI的设置中实际存的是excludedModels, models实际为空，这导致生成消息时无法拿到model的nickName，所以这里每次获取chatbox ai models之后就存在settings中
      setProviderSettings({
        models: res.models.map((m) => ({
          modelId: m.modelId,
          nickname: m.modelName,
          labels: m.labels,
        })),
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
