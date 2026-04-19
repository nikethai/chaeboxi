// Re-export gateway client from shared for convenience
export {
  OpenClawGatewayClient,
  normalizeGatewayUrl,
  wsToHttpUrl,
  isLocalhostUrl,
  analyzeGatewayUrl,
} from '@shared/openclaw/gateway'
export type {
  GatewayAuth,
  GatewayClientOptions,
  GatewaySecurityLevel,
  GatewayUrlAnalysis,
} from '@shared/openclaw/gateway'
