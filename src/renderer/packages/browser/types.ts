export type BrowserErrorCode =
  | 'UNSUPPORTED_PLATFORM'
  | 'SESSION_NOT_FOUND'
  | 'ACTION_TIMEOUT'
  | 'REF_INVALID'
  | 'SECURITY_BLOCKED'
  | 'BROWSER_BUSY'
  | 'DEPENDENCY_MISSING'
  | 'LAUNCH_FAILED'
  | 'ACTION_ERROR'
  | 'NOT_IMPLEMENTED'

export type BrowserSessionStartOptions = {
  sessionId: string
  headless?: boolean
  downloadsEnabled?: boolean
  downloadDir?: string
  allowlist?: string[]
  channel?: 'chrome' | 'msedge'
  viewport?: { width: number; height: number }
}

export type BrowserStatus = {
  running: boolean
  activePageId?: string | null
  tabCount?: number
  url?: string | null
  headless?: boolean
  downloadsEnabled?: boolean
}

export type BrowserSnapshotResult = {
  url: string
  title: string
  snapshot: string
  truncated?: boolean
  refCount?: number
}

export type BrowserTabInfo = {
  tabId: string
  url: string
  title: string
  active: boolean
}
