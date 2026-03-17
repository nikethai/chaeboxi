// Tauri IPC adapter for Svelte - uses @tauri-apps/api
import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import type { DesktopAPI } from './desktop-api'

export function isTauriRuntime(): boolean {
	return typeof window !== 'undefined' && '__TAURI__' in window
}

export function createTauriIPCAdapter(): DesktopAPI {
	return {
		invoke: async <T>(channel: string, ...args: unknown[]): Promise<T> => {
			return await invoke<T>(channel, { args })
		},
		listen: async <T>(channel: string, callback: (payload: T) => void): Promise<UnlistenFn> => {
			const unlisten = await listen<T>(channel, (event) => {
				callback(event.payload)
			})
			return unlisten
		},
	}
}
