import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import type React from 'react'
import type { RefObject } from 'react'
import type { VirtuosoHandle } from 'react-virtuoso'
import platform from '@/platform'
import type { KnowledgeBase, MessagePicture, Toast } from '../../../shared/types'

// Input box related state
export const inputBoxLinksAtom = atom<{ url: string }[]>([])
export const inputBoxWebBrowsingModeAtom = atom(false)

// Atom to store collapsed state of providers
export const collapsedProvidersAtom = atomWithStorage<Record<string, boolean>>('collapsedProviders', {})
