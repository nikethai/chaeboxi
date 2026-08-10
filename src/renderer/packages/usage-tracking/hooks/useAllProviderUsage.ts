import type { ProviderUsageStatus, UsagePeriod } from '@shared/providers/usage'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSettingsStore, settingsStore } from '@/stores/settingsStore'
import { providerUsageService } from '../service'

export function useAllProviderUsage(period: UsagePeriod = '30d') {
  const providers = useSettingsStore((s) => s.providers)
  const customProviders = useSettingsStore((s) => s.customProviders)
  const [statuses, setStatuses] = useState<ProviderUsageStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [backfillProgress, setBackfillProgress] = useState<number | null>(null)
  const requestIdRef = useRef(0)
  const mountedRef = useRef(true)
  const loadingStatusesRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const load = useCallback(
    async (force: boolean, showLoading: boolean) => {
      // Prevent concurrent full reloads (esp. while backfill emits progress)
      if (loadingStatusesRef.current && !force) return
      loadingStatusesRef.current = true
      const requestId = ++requestIdRef.current
      if (showLoading && mountedRef.current) setLoading(true)
      try {
        await providerUsageService.init()
        if (!providerUsageService.isBackfillComplete()) {
          if (mountedRef.current) setBackfillProgress(0)
          await providerUsageService.backfillFromSessions((p) => {
            if (mountedRef.current) setBackfillProgress(p)
          })
          if (mountedRef.current) setBackfillProgress(null)
        }
        const settings = settingsStore.getState().getSettings()
        const next = await providerUsageService.getAllStatuses(settings, period, force)
        if (!mountedRef.current || requestId !== requestIdRef.current) return
        setStatuses(next)
        setError(null)
      } catch (err) {
        if (!mountedRef.current || requestId !== requestIdRef.current) return
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        loadingStatusesRef.current = false
        if (showLoading && mountedRef.current && requestId === requestIdRef.current) {
          setLoading(false)
        }
      }
    },
    [period, providers, customProviders]
  )

  const refresh = useCallback(async (force = false) => load(force, true), [load])

  const loadRef = useRef(load)
  loadRef.current = load

  useEffect(() => {
    void load(false, true)
  }, [load])

  useEffect(() => {
    return providerUsageService.subscribe(() => {
      // Ignore emissions during backfill / in-flight load — avoids nested reload storms
      if (loadingStatusesRef.current) return
      void loadRef.current(false, false)
    })
  }, [])

  const rebackfill = useCallback(async () => {
    if (mountedRef.current) setBackfillProgress(0)
    try {
      await providerUsageService.init()
      await providerUsageService.backfillFromSessions((p) => {
        if (mountedRef.current) setBackfillProgress(p)
      })
      await load(true, true)
    } finally {
      if (mountedRef.current) setBackfillProgress(null)
    }
  }, [load])

  return { statuses, loading, error, refresh, rebackfill, backfillProgress }
}
