/**
 * Chaeboxi product identity and feature flags.
 * Marketing + legal URLs live on GitHub Pages until a custom domain exists.
 */

export const PRODUCT = {
  name: 'Chaeboxi',
  /** Short description for metadata / OpenRouter */
  title: 'Chaeboxi',
  githubRepo: 'https://github.com/nikethai/chaeboxi',
  homepage: 'https://nikethai.github.io/chaeboxi/',
  releasesUrl: 'https://github.com/nikethai/chaeboxi/releases',
  feedbackUrl: 'https://github.com/nikethai/chaeboxi/issues',
  privacyUrl: 'https://nikethai.github.io/chaeboxi/privacy/',
  termsUrl: 'https://nikethai.github.io/chaeboxi/terms/',
  changelogUrl: 'https://github.com/nikethai/chaeboxi/releases',
  /** OpenRouter / partner app attribution */
  openRouterReferer: 'https://nikethai.github.io/chaeboxi/',
  openRouterTitle: 'Chaeboxi',
} as const

/**
 * When false, no requests go to Chaeboxi hosted APIs (api.chatboxai.app, etc.).
 * Local API via USE_LOCAL_API / USE_LOCAL_CHATBOX still works for development.
 * Keep internal stubs so the app stays stable and upstream cherry-picks stay easy.
 */
export const CHATBOX_CLOUD_ENABLED = false

/**
 * Analytics / Sentry: disabled until Chaeboxi-owned accounts exist.
 * Sentry Vite plugin already no-ops without SENTRY_AUTH_TOKEN.
 */
export const TELEMETRY_ENABLED = false
