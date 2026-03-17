// Platform initialization for Svelte
import DesktopPlatform from './desktop-platform'
import WebPlatform from './web-platform'
import { isTauriRuntime } from './tauri-ipc-adapter'
import type { Platform } from './interfaces'

function initPlatform(): Platform {
	if (typeof window !== 'undefined') {
		if (isTauriRuntime()) {
			return new DesktopPlatform()
		}
	}
	return new WebPlatform()
}

export default initPlatform()
