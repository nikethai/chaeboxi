export type MCPServerConfig<TransportConfig = MCPTransportConfig> = {
  id: string
  name: string
  enabled: boolean
  transport: TransportConfig
}

export enum ToolRiskTier {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export type MCPTransportConfig =
  | {
      type: 'stdio'
      command: string
      args: string[]
      env?: Record<string, string>
    }
  | {
      type: 'http'
      url: string
      headers?: Record<string, string>
    }

export type MCPServerStatus = {
  state: 'idle' | 'starting' | 'running' | 'stopping'
  error?: string
}
