// Toggle for exposing dev routes outside of development builds.
// Set to true to keep the /dev routes visible even in production builds (e.g. debug mobile packages).
// Dev routes are always stripped from Android builds regardless of NODE_ENV.
import { CHATBOX_BUILD_PLATFORM } from '@/variables'

export const FORCE_ENABLE_DEV_PAGES =
  process.env.NODE_ENV === 'development' && CHATBOX_BUILD_PLATFORM !== 'android'
