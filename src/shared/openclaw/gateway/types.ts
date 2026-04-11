// Gateway protocol types for OpenClaw WebSocket communication

// Connection params
export interface ConnectParams {
  role: 'operator' | 'user' | 'guest'
  auth?: {
    token?: string
    password?: string
  }
  capabilities?: string[]
}

export interface ConnectResponse {
  status: 'ok'
  stateVersion: number
  uptimeMs: number
  limits: GatewayLimits
  policy: GatewayPolicy
  features: GatewayFeatures
}

export interface GatewayLimits {
  maxSessions?: number
  maxAgents?: number
  maxConcurrentRequests?: number
  rateLimit?: {
    requestsPerMinute: number
    burstSize: number
  }
}

export interface GatewayPolicy {
  allowedAgents?: string[]
  allowedTools?: string[]
  maxMessageLength?: number
  sessionTimeoutMs?: number
}

export interface GatewayFeatures {
  streaming?: boolean
  agentInvocation?: boolean
  sessionManagement?: boolean
  presence?: boolean
  toolExecution?: boolean
}

// Message frame types
export type MessageId = number

export interface RequestFrame {
  type: 'req'
  id: MessageId
  method: string
  params?: Record<string, unknown>
}

export interface ResponseFrame {
  type: 'res'
  id: MessageId
  ok: boolean
  payload?: unknown
  error?: GatewayError
}

export interface EventFrame {
  type: 'event'
  event: ServerEventName
  data?: unknown
}

export type GatewayMessage = RequestFrame | ResponseFrame | EventFrame

export type ServerEventName =
  | 'agent'
  | 'session.message'
  | 'session.tool'
  | 'sessions.changed'
  | 'presence'
  | 'tick'
  | 'health'
  | 'heartbeat'
  | 'shutdown'

// Error format
export interface GatewayError {
  code: string
  message: string
  details?: Record<string, unknown>
}

// Agent invoke types
export interface AgentInvokeParams {
  agentId: string
  message: string
  sessionId?: string
  sessionKey?: string
  extraSystemPrompt?: string
  idempotencyKey: string
  attachments?: AgentAttachment[]
}

export interface AgentMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  attachments?: AgentAttachment[]
}

export interface AgentAttachment {
  type: 'image' | 'file' | 'url'
  url: string
  name?: string
  mimeType?: string
}

export interface AgentInvokeResponse {
  status?: 'accepted' | 'started' | 'in_flight' | 'ok'
  invocationId?: string
  runId?: string
  acceptedAt?: string | number
}

export interface AgentChunk {
  type: 'chunk'
  invocationId: string
  runId?: string
  delta: string
  done?: boolean
}

export interface AgentDone {
  type: 'done'
  invocationId: string
  runId?: string
  status: 'ok' | 'error'
  error?: GatewayError
}

export interface AgentToolCall {
  type: 'tool'
  invocationId: string
  runId?: string
  tool: string
  input: Record<string, unknown>
}

export interface AgentToolResult {
  type: 'tool_result'
  invocationId: string
  runId?: string
  tool: string
  output: unknown
  error?: string
}

export type AgentStreamEvent =
  | AgentChunk
  | AgentDone
  | AgentToolCall
  | AgentToolResult

// Session types
export interface SessionInfo {
  id: string
  name?: string
  createdAt: number
  updatedAt: number
  agentId?: string
  metadata?: Record<string, unknown>
}

export interface SessionMessage {
  id: string
  sessionId: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  timestamp: number
  attachments?: AgentAttachment[]
}

export interface SessionToolCall {
  id: string
  sessionId: string
  tool: string
  input: Record<string, unknown>
  timestamp: number
}

// Presence types
export interface PresenceUpdate {
  type: 'online' | 'offline' | 'typing'
  userId?: string
  sessionId?: string
  timestamp: number
}

// Health types
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  latencyMs?: number
  activeSessions?: number
  activeAgents?: number
  timestamp: number
}

// Heartbeat types
export interface HeartbeatPayload {
  timestamp: number
  sequence: number
}

// Generic request params for agents.list, sessions.list, etc.
export interface AgentsListParams {
  filter?: {
    available?: boolean
    tags?: string[]
  }
}

export interface AgentsListResponse {
  agents: AgentInfo[]
}

export interface AgentInfo {
  id: string
  name: string
  description?: string
  capabilities?: string[]
  tags?: string[]
  available?: boolean
}

export interface SessionsListParams {
  filter?: {
    agentId?: string
    since?: number
  }
}

export interface SessionsListResponse {
  sessions: SessionInfo[]
}

export interface CommandsListResponse {
  commands: GatewayCommandInfo[]
}

export interface GatewayCommandInfo {
  name: string
  nativeName?: string
  description?: string
  usage?: string
  textAliases?: string[]
  icon?: string
  category?: string
}

// Client connection state
export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'authenticating'
  | 'connected'
  | 'reconnecting'
  | 'error'

export interface GatewayInfo {
  url: string
  stateVersion: number
  uptimeMs: number
  limits: GatewayLimits
  policy: GatewayPolicy
  features: GatewayFeatures
}
