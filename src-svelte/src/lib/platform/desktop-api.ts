// Desktop API interface for Svelte - mirrors the DesktopIPC type from React app
export interface DesktopIPC {
	invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
	onSystemThemeChange: (callback: () => void) => () => void
	onWindowMaximizedChanged: (callback: (_event: unknown, windowMaximized: boolean) => void) => () => void
	onWindowShow: (callback: () => void) => () => void
	onWindowFocused: (callback: () => void) => () => void
	onUpdateDownloaded: (callback: () => void) => () => void
	addMcpStdioTransportEventListener: (
		transportId: string,
		event: string,
		callback?: (...args: unknown[]) => void
	) => () => void
	onNavigate: (callback: (path: string) => void) => () => void
}
