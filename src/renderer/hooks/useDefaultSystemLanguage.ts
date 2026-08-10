import { useEffect } from 'react'
import { settingsStore } from '@/stores/settingsStore'
import platform from '../platform'

export function useSystemLanguageWhenInit() {
  useEffect(() => {
    // Delay so persisted settings finish loading before first language write.
    setTimeout(() => {
      ;(async () => {
        const { languageInited } = settingsStore.getState()
        if (!languageInited) {
          // Chaeboxi ships English-first. Users can change language in Settings.
          // Do not auto-switch to Chinese (or other OS locales) on first run.
          settingsStore.setState({
            language: 'en',
            languageInited: true,
          })
        }
        settingsStore.setState({
          languageInited: true,
        })
      })()
    }, 2000)
  }, [])
}
