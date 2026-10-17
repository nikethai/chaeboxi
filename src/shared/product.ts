/**
 * Dango product identity and feature flags.
 * Marketing + legal URLs live on GitHub Pages until a custom domain exists.
 */

export const PRODUCT = {
  name: 'Dango',
  /** Short description for metadata / OpenRouter */
  title: 'Dango',
  githubRepo: 'https://github.com/nikethai/dango',
  homepage: 'https://nikethai.github.io/dango/',
  releasesUrl: 'https://github.com/nikethai/dango/releases',
  feedbackUrl: 'https://github.com/nikethai/dango/issues',
  privacyUrl: 'https://nikethai.github.io/dango/privacy/',
  termsUrl: 'https://nikethai.github.io/dango/terms/',
  changelogUrl: 'https://github.com/nikethai/dango/releases',
  /** OpenRouter / partner app attribution */
  openRouterReferer: 'https://nikethai.github.io/dango/',
  openRouterTitle: 'Dango',
} as const

/**
 * When false, no requests go to Dango hosted APIs (api.chatboxai.app, etc.).
 * Local API via USE_LOCAL_API / USE_LOCAL_CHATBOX still works for development.
 * Keep internal stubs so the app stays stable and upstream cherry-picks stay easy.
 */
export const CHATBOX_CLOUD_ENABLED = false

/**
 * Analytics / Sentry: disabled until Dango-owned accounts exist.
 * Sentry Vite plugin already no-ops without SENTRY_AUTH_TOKEN.
 */
export const TELEMETRY_ENABLED = false
