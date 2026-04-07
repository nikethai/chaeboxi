import { ModelProviderEnum } from '@shared/types'
import { ComfyUIClient } from '@shared/providers/definitions/models/comfyui-client'
import type { ComfyUIServerInfo } from '@shared/providers/definitions/models/comfyui-types'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useProviderSettings } from '@/stores/settingsStore'

const COMFYUI_INFO_QUERY_KEY = 'comfyui-server-info'
const STALE_TIME = 5 * 60 * 1000 // 5 minutes

/**
 * React Query hook that fetches available checkpoints, LoRAs, samplers, and schedulers
 * from a ComfyUI server's /object_info endpoint.
 */
export function useComfyUIInfo() {
  const { providerSettings } = useProviderSettings(ModelProviderEnum.ComfyUI)
  const apiHost = providerSettings?.apiHost || ''

  const { data, isLoading, error, refetch } = useQuery<ComfyUIServerInfo>({
    queryKey: [COMFYUI_INFO_QUERY_KEY, apiHost],
    queryFn: async () => {
      if (!apiHost) {
        return { checkpoints: [], loras: [], samplers: [], schedulers: [] }
      }
      const client = new ComfyUIClient(apiHost)
      const objectInfo = await client.getObjectInfo()
      return client.parseServerInfo(objectInfo)
    },
    enabled: !!apiHost,
    staleTime: STALE_TIME,
    retry: 1,
  })

  const info = useMemo<ComfyUIServerInfo>(
    () =>
      data ?? {
        checkpoints: [],
        loras: ['none'],
        samplers: [],
        schedulers: [],
      },
    [data],
  )

  const loras = useMemo(() => {
    if (info.loras.length === 0) return ['none']
    return info.loras.includes('none') ? info.loras : ['none', ...info.loras]
  }, [info.loras])

  return {
    checkpoints: info.checkpoints,
    loras,
    samplers: info.samplers,
    schedulers: info.schedulers,
    isLoading,
    error,
    refetch,
  }
}
