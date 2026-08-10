import type { ProviderUsageStatus, UsagePeriod } from '@shared/providers/usage'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSettingsStore, settingsStore } from '@/stores/settingsStore'
import { providerUsageService } from '../service'

export function useProviderUsageStatus(
  providerId: string | undefined,
  period: UsagePeriod = '30d'
) {
  // Only subscribe to fields that should trigger a reload (not the whole store)
  const providers = useSettingsStore((s) => s.providers)
  const customProviders = useSettingsStore((s) => s.customProviders)
  const [status, setStatus] = useState<ProviderUsageStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestIdRef = useRef(0)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const load = useCallback(
    async (force: boolean, showLoading: boolean) => {
      if (!providerId) {
        if (mountedRef.current) setStatus(null)
        return
      }
      const requestId = ++requestIdRef.current
      if (showLoading && mountedRef.current) setLoading(true)
      try {
        await providerUsageService.init()
        // Read settings at call time — avoid closing over the whole store
        const settings = settingsStore.getState().getSettings()
        const next = await providerUsageService.getStatus(providerId, settings, {
          period,
          forceRefresh: force,
        })
        if (!mountedRef.current || requestId !== requestIdRef.current) return
        setStatus(next)
        setError(null)
      } catch (err) {
        if (!mountedRef.current || requestId !== requestIdRef.current) return
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        if (showLoading && mountedRef.current && requestId === requestIdRef.current) {
          setLoading(false)
        }
      }
    },
    [providerId, period, providers, customProviders]
  )

  const refresh = useCallback(async (force = false) => load(force, true), [load])

  // Keep a stable ref so the service subscription never re-binds load identity loops
  const loadRef = useRef(load)
  loadRef.current = load

  useEffect(() => {
    void load(false, true)
  }, [load])

  useEffect(() => {
    return providerUsageService.subscribe(() => {
      // Quiet re-sync after local usage / exhausted updates
      void loadRef.current(false, false)
    })
  }, [])

  return { status, loading, error, refresh }
}
