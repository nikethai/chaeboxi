// Legacy domain-guard for upstream web hosting — disabled for Chaeboxi independence.
// Kept as a no-op module so existing imports do not break.

import { CHATBOX_BUILD_TARGET } from '../variables'

switch (CHATBOX_BUILD_TARGET) {
  case 'mobile_app':
    break
  case 'unknown':
    // Intentionally no hostname redirect to chatboxai.app
    break
}
