export const SITE_ORIGIN = 'https://nikethai.github.io'
export const SITE_HOME = 'https://nikethai.github.io/chaeboxi/'
export const SITE_NAME = 'Chaeboxi'
export const DEFAULT_DESCRIPTION =
  'Local-first AI copilot. Bring your own keys. Chats stay on your device. Independent GPLv3 — not Chatbox AI, not a hosted LLM.'

export function pageUrl(pathname: string): string {
  return new URL(pathname, SITE_ORIGIN).href
}

export function assetUrl(base: string, file: string): string {
  const path = `${base}${file}`.replace(/\/{2,}/g, '/')
  return new URL(path, SITE_ORIGIN).href
}
