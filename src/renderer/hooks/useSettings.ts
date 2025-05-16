import { ProviderSettings, Settings } from 'src/shared/types'
import { useAtom } from 'jotai'
import { useCallback } from 'react'
import { settingsAtom } from '@/stores/atoms'

export const useSettings = () => {
  const [settings, _setSettings] = useAtom(settingsAtom)

  const setSettings = useCallback((val: Partial<Settings>) => {
    _setSettings((pre) => ({
      ...pre,
      ...val,
    }))
  }, [])

  return {
    settings,
    setSettings,
  }
}

export const useProviderSettings = (providerId: string) => {
  const { settings, setSettings } = useSettings()

  const providerSettings = settings.providers?.[providerId]

  const setProviderSettings = (val: Partial<ProviderSettings>) => {
    setSettings({
      providers: {
        ...(settings.providers || {}),
        [providerId]: {
          ...(settings.providers?.[providerId] || {}),
          ...val,
        },
      },
    })
  }

  return {
    providerSettings,
    setProviderSettings,
  }
}
