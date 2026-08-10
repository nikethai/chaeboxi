/**
 * (legacy comment)
 * @param url URL
 * @returns true
 */
export function isLocalHost(url: string): boolean {
  try {
    const { hostname } = new URL(url)
    if (hostname === 'localhost' || hostname === '[::1]' || hostname === '::1') return true
    if (hostname.startsWith('127.')) return true
    if (hostname.startsWith('192.168.')) return true
    if (hostname.startsWith('10.')) return true
    // (legacy comment removed)
    const match = hostname.match(/^172\.(\d{1,3})\./)
    if (match) {
      const second = Number(match[1])
      return second >= 16 && second <= 31
    }
  } catch (_) {
    /* ignore malformed URL */
    return false
  }
  return false
}
