import platform from '@/platform'
import { CHATBOX_BUILD_PLATFORM } from '@/variables'

const isAndroid = CHATBOX_BUILD_PLATFORM === 'android'

export const featureFlags = {
  // MCP is available on desktop and Tauri Android (HTTP transports only;
  // stdio servers are filtered out at bootstrap time for Android).
  mcp: platform.type === 'desktop',
  // Knowledge Base requires local filesystem operations not available on Android.
  knowledgeBase: platform.type === 'desktop' && !isAndroid,
}
