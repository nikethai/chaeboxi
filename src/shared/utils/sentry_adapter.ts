/**
 * (legacy comment)
 * (legacy comment)
 */
export interface SentryAdapter {
  captureException(error: any): void
  withScope(callback: (scope: SentryScope) => void): void
}

export interface SentryScope {
  setTag(key: string, value: string): void
  setExtra(key: string, value: any): void
}
