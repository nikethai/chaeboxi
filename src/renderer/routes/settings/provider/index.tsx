import { isProviderListedInSettings } from '@shared/providers/provider-credentials'
import { SystemProviders } from '@shared/defaults'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo } from 'react'
import { useIsSmallScreen } from '@/hooks/useScreenChange'
import { useSettingsStore } from '@/stores/settingsStore'

export const Route = createFileRoute('/settings/provider/')({
  component: RouteComponent,
})

export function RouteComponent() {
  const isSmallScreen = useIsSmallScreen()
  const navigate = useNavigate()
  const providersMap = useSettingsStore((s) => s.providers)
  const customProviders = useSettingsStore((s) => s.customProviders)

  const firstListedId = useMemo(() => {
    const all = [...SystemProviders(), ...(customProviders || [])]
    const listed = all.find((p) => isProviderListedInSettings(p, providersMap?.[p.id]))
    return listed?.id
  }, [customProviders, providersMap])

  useEffect(() => {
    if (isSmallScreen) return
    if (firstListedId) {
      void navigate({
        to: '/settings/provider/$providerId',
        params: { providerId: firstListedId },
        replace: true,
      })
      return
    }
    // Empty list: stay on index (list shows empty + Add). No forced openai.
  }, [isSmallScreen, firstListedId, navigate])

  return null
}
