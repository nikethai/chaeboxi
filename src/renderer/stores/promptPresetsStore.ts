import type { PromptPreset } from '@shared/types'
import { useAtom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { v4 as uuidv4 } from 'uuid'
import storage, { StorageKey } from '@/storage'

export const promptPresetsAtom = atomWithStorage<PromptPreset[]>(StorageKey.PromptPresets, [], storage)

function sortPromptPresets(presets: PromptPreset[]) {
  return [...presets].sort((a, b) => {
    const categoryA = a.category || ''
    const categoryB = b.category || ''
    return categoryA.localeCompare(categoryB) || a.name.localeCompare(b.name)
  })
}

export function usePromptPresets() {
  const [promptPresets, setPromptPresets] = useAtom(promptPresetsAtom)

  const addOrUpdatePreset = (preset: Omit<PromptPreset, 'id'> & Partial<Pick<PromptPreset, 'id'>>) => {
    const nextPreset: PromptPreset = {
      ...preset,
      id: preset.id || uuidv4(),
    }

    setPromptPresets(async (prev) => {
      const presets = await prev
      const nextPresets = presets.some((item) => item.id === nextPreset.id)
        ? presets.map((item) => (item.id === nextPreset.id ? nextPreset : item))
        : [...presets, nextPreset]
      return sortPromptPresets(nextPresets)
    })

    return nextPreset
  }

  const removePreset = (presetId: string) => {
    setPromptPresets(async (prev) => (await prev).filter((preset) => preset.id !== presetId))
  }

  return {
    promptPresets: sortPromptPresets(promptPresets),
    addOrUpdatePreset,
    removePreset,
  }
}
