import type { PromptPreset } from '@shared/types'
import { useAtom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { v4 as uuidv4 } from 'uuid'
import storage, { StorageKey } from '@/storage'

export const systemPromptPresetsAtom = atomWithStorage<PromptPreset[]>(StorageKey.SystemPromptPresets, [], storage)

function sortSystemPromptPresets(presets: PromptPreset[]) {
  return [...presets].sort((a, b) => a.name.localeCompare(b.name))
}

export function useSystemPromptPresets() {
  const [systemPromptPresets, setSystemPromptPresets] = useAtom(systemPromptPresetsAtom)

  const addOrUpdatePreset = (preset: Omit<PromptPreset, 'id'> & Partial<Pick<PromptPreset, 'id'>>) => {
    const nextPreset: PromptPreset = {
      ...preset,
      id: preset.id || uuidv4(),
    }

    setSystemPromptPresets(async (prev) => {
      const presets = await prev
      const nextPresets = presets.some((item) => item.id === nextPreset.id)
        ? presets.map((item) => (item.id === nextPreset.id ? nextPreset : item))
        : [...presets, nextPreset]

      return sortSystemPromptPresets(nextPresets)
    })

    return nextPreset
  }

  const removePreset = (presetId: string) => {
    setSystemPromptPresets(async (prev) => (await prev).filter((preset) => preset.id !== presetId))
  }

  return {
    systemPromptPresets: sortSystemPromptPresets(systemPromptPresets),
    addOrUpdatePreset,
    removePreset,
  }
}
