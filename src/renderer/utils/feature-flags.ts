import { platformCapabilities } from '@/platform'

export const featureFlags = {
  // MCP is available on desktop and Tauri Android (HTTP transports only;
  // stdio servers are filtered out at bootstrap time for Android).
  mcp: platformCapabilities.supportsMcpBootstrap,
  // Knowledge Base requires local filesystem operations not available on Android.
  knowledgeBase: platformCapabilities.supportsKnowledgeBase,
}
