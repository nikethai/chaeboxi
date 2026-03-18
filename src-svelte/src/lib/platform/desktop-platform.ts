import platform from '.'
import type { DesktopIPC } from './desktop-api'
import type { Platform } from './interfaces'

class DesktopPlatformStub {
	constructor(_ipc: DesktopIPC) {
		return platform
	}
}

export default DesktopPlatformStub as unknown as new (ipc: DesktopIPC) => Platform
