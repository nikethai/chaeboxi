/// <reference types="@sveltejs/kit" />
import type { DesktopIPC } from '../../src/shared/desktop-ipc-types'

declare global {
	interface Window {
		desktopAPI: DesktopIPC
	}

	interface File {
		path?: string
	}

	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
