// Message framing utilities for OpenClaw gateway protocol

import type { EventFrame, GatewayMessage, RequestFrame, ResponseFrame, MessageId } from './types'

/**
 * Creates a request frame with the given parameters
 */
export function createReq(id: MessageId, method: string, params?: Record<string, unknown>): RequestFrame {
  return {
    type: 'req',
    id,
    method,
    params,
  }
}

/**
 * Creates a response frame with the given parameters
 */
export function createRes(id: MessageId, ok: boolean, payload?: unknown): ResponseFrame {
  return {
    type: 'res',
    id,
    ok,
    payload,
  }
}

/**
 * Creates an error response frame
 */
export function createErrorRes(
  id: MessageId,
  code: string,
  message: string,
  details?: Record<string, unknown>
): ResponseFrame {
  return {
    type: 'res',
    id,
    ok: false,
    error: { code, message, details },
  }
}

/**
 * Parses an incoming WebSocket frame into a known message type
 * Returns null if parsing fails
 */
export function parseMessage(data: unknown): GatewayMessage | null {
  if (data === null || data === undefined) {
    return null
  }

  if (typeof data !== 'object') {
    return null
  }

  const msg = data as Record<string, unknown>

  // Must have a type field
  if (typeof msg.type !== 'string') {
    return null
  }

  switch (msg.type) {
    case 'req':
      if (typeof msg.id !== 'number' || typeof msg.method !== 'string') {
        return null
      }
      return {
        type: 'req',
        id: msg.id,
        method: msg.method,
        params: msg.params as Record<string, unknown> | undefined,
      }

    case 'res':
      if (typeof msg.id !== 'number' || typeof msg.ok !== 'boolean') {
        return null
      }
      return {
        type: 'res',
        id: msg.id,
        ok: msg.ok,
        payload: msg.payload,
        error: msg.error as ResponseFrame['error'],
      }

    case 'event':
      if (typeof msg.event !== 'string') {
        return null
      }
      return {
        type: 'event',
        event: msg.event as EventFrame['event'],
        data: msg.data,
      }

    default:
      return null
  }
}

/**
 * Type guard to check if a message is an event frame
 */
export function isEvent(msg: GatewayMessage): msg is EventFrame {
  return msg.type === 'event'
}

/**
 * Type guard to check if a message is a response frame
 */
export function isResponse(msg: GatewayMessage): msg is ResponseFrame {
  return msg.type === 'res'
}

/**
 * Type guard to check if a message is a request frame
 */
export function isRequest(msg: GatewayMessage): msg is RequestFrame {
  return msg.type === 'req'
}

/**
 * Serialize a message to JSON string for sending over WebSocket
 */
export function serializeMessage(msg: GatewayMessage): string {
  return JSON.stringify(msg)
}

/**
 * Check if a response matches a specific request by ID
 */
export function isResponseTo(response: ResponseFrame, requestId: MessageId): boolean {
  return response.id === requestId
}
