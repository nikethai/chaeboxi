import platform from '.'
import type { Platform } from './interfaces'

class WebPlatformStub {
	constructor() {
		return platform
	}
}

export default WebPlatformStub as unknown as new () => Platform
