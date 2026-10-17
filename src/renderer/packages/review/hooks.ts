import type { ReviewEntry } from '@shared/types/review'
import type { ComponentType } from 'react'
import { useEffect } from 'react'
import { useStore } from 'zustand'
import { lookupReviewRenderer, type ReviewRendererProps, reviewRegistryStore } from './registry'
import { loadReviewEntries, reviewStore, waitingCount } from './store'

export function useReviewEntries(): ReviewEntry[] {
  useEffect(() => {
    const reload = () => void loadReviewEntries().catch(() => undefined)
    const onVisible = () => {
      if (document.visibilityState === 'visible') reload()
    }
    reload()
    window.addEventListener('focus', reload)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('focus', reload)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])
  return useStore(reviewStore, (s) => s.entries)
}

export function useReviewWaitingCount(): number {
  return useStore(reviewStore, (s) => waitingCount(s.entries))
}

export function useLastCheckedAt(): number | undefined {
  return useStore(reviewStore, (s) => s.lastCheckedAt)
}

export function useReviewRenderer(
  entry: Pick<ReviewEntry, 'kind' | 'ref'>
): ComponentType<ReviewRendererProps> | undefined {
  return useStore(reviewRegistryStore, (s) => lookupReviewRenderer(s.renderers, entry))
}
