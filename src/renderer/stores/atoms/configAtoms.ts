import type { RemoteConfig } from '@shared/types'
import { atomWithStorage } from 'jotai/utils'
import storage, { StorageKey } from '../../storage'

// configVersion ，（migration）
// export const configVersionAtom = atomWithStorage<number>(StorageKey.ConfigVersion, 0, storage) // Keep commented out if original was

// (legacy comment removed)
export const remoteConfigAtom = atomWithStorage<Partial<RemoteConfig>>(StorageKey.RemoteConfig, {}, storage)
