import * as Sentry from '@sentry/react'
import { initSettingsStore } from '@/stores/settingsStore'
import { CHATBOX_BUILD_PLATFORM, CHATBOX_BUILD_TARGET, NODE_ENV } from '@/variables'
import platform from '../platform'

void (async () => {
  try {
    const settings = await initSettingsStore()
    if (!settings.allowReportingAndTracking) {
      return
    }

    const version = await platform.getVersion().catch(() => 'unknown')
    // Sentry has been disabled to prevent unsolicited data sends to upstream infrastructure.
    /*
    Sentry.init({
      dsn: 'https://eca691c5e01ebfa05958fca1fcb487a9@sentry.midway.run/697',
      environment: NODE_ENV,
      // Performance Monitoring
      // Set to 1.0 to capture all errors, then sample in beforeSend
      sampleRate: 1.0,
      tracesSampleRate: 0.1, // Capture 100% of the transactions, reduce in production!
      // Session Replay
      replaysSessionSampleRate: 0.05,
      replaysOnErrorSampleRate: 0.05,
      release: version,
      // (legacy comment removed)
      initialScope: {
        tags: {
          platform: platform.type,
          app_version: version,
          build_target: CHATBOX_BUILD_TARGET,
          build_platform: CHATBOX_BUILD_PLATFORM,
        },
      },
      // beforeSend hook implements differential sampling
      beforeSend(event) {
        // ErrorBoundary: 100% reporting
        if (event.tags?.errorBoundary) {
          return event
        }

        // Other errors: 10% sampling
        if (Math.random() < 0.1) {
          return event
        }

        // Discard 90% of non-ErrorBoundary errors
        return null
      },
    })
    */
  } catch (e) {
    console.error('Failed to initialize Sentry:', e)
  }
})()

export default Sentry

