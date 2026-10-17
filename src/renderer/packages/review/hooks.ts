import type { ReviewEntry } from '@shared/types/review'
import type { ComponentType } from 'react'
import { useEffect } from 'react'
import { useStore } from 'zustand'
import { lookupReviewRenderer, type ReviewRendererProps, reviewRegistryStore } from './registry'
import { loadReviewEntries, reviewStore, waitingCount } from './store'

/** Load review entries on mount, and again whenever this window regains focus or becomes visible. */
export function useReviewAutoload(): void {
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
}

export function useReviewEntries(): ReviewEntry[] {
  useReviewAutoload()
  return useStore(reviewStore, (s) => s.entries)
}

export function useReviewWaitingCount(): number {
  useReviewAutoload()
  return useStore(reviewStore, (s) => waitingCount(s.entries))
}

export function useLastCheckedAt(): number | undefined {
  useReviewAutoload()
  return useStore(reviewStore, (s) => s.lastCheckedAt)
}

export function useReviewRenderer(
  entry: Pick<ReviewEntry, 'kind' | 'ref'>
): ComponentType<ReviewRendererProps> | undefined {
  return useStore(reviewRegistryStore, (s) => lookupReviewRenderer(s.renderers, entry))
}
