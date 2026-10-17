import type { ReviewEntry, ReviewKind, ReviewRefType } from '@shared/types/review'
import type { ComponentType } from 'react'
import { createStore } from 'zustand/vanilla'

export type ReviewOpener = (entry: ReviewEntry) => void | Promise<void>
export type ReviewRendererProps = { entry: ReviewEntry; focused: boolean }
type RendererComponent = ComponentType<ReviewRendererProps>

// One store for both registries so hooks re-render when a lazily loaded slice registers late.
export const reviewRegistryStore = createStore<{
  openers: Record<string, ReviewOpener>
  renderers: Record<string, RendererComponent>
}>()(() => ({ openers: {}, renderers: {} }))

function register<K extends 'openers' | 'renderers'>(
  field: K,
  key: string,
  value: K extends 'openers' ? ReviewOpener : RendererComponent
): () => void {
  reviewRegistryStore.setState((s) => ({ [field]: { ...s[field], [key]: value } }) as Partial<typeof s>)
  return () => {
    // Remove only what this call added; a later registration under the same key stays.
    if (reviewRegistryStore.getState()[field][key] !== value) return
    reviewRegistryStore.setState((s) => {
      const { [key]: _removed, ...rest } = s[field]
      return { [field]: rest } as Partial<typeof s>
    })
  }
}

export function registerReviewOpener(refType: ReviewRefType, open: ReviewOpener): () => void {
  return register('openers', refType, open)
}

export function hasReviewOpener(entry: ReviewEntry): boolean {
  return Boolean(reviewRegistryStore.getState().openers[entry.ref.type])
}

export async function openReviewEntry(entry: ReviewEntry): Promise<boolean> {
  const open = reviewRegistryStore.getState().openers[entry.ref.type]
  if (!open) return false
  await open(entry)
  return true
}

export function registerReviewRenderer(
  kind: ReviewKind,
  Component: RendererComponent,
  opts?: { refType?: ReviewRefType }
): () => void {
  return register('renderers', opts?.refType ? `${kind}:${opts.refType}` : kind, Component)
}

export function lookupReviewRenderer(
  renderers: Record<string, RendererComponent>,
  entry: Pick<ReviewEntry, 'kind' | 'ref'>
): RendererComponent | undefined {
  return renderers[`${entry.kind}:${entry.ref.type}`] ?? renderers[entry.kind]
}

export function getReviewRenderer(entry: Pick<ReviewEntry, 'kind' | 'ref'>): RendererComponent | undefined {
  return lookupReviewRenderer(reviewRegistryStore.getState().renderers, entry)
}
