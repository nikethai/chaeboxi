import type { ConnectorId } from '../../types/integrations'
import { asanaConnector } from './asana'
import { githubConnector } from './github'
import { googleWorkspaceConnector } from './google-workspace'
import { jiraConnector } from './jira'
import type { ConnectorDefinition } from './types'

export type {
  ConnectorConfigField,
  ConnectorDefinition,
  ConnectorOAuthSpec,
  RuntimeBindingSpec,
} from './types'

const CONNECTORS: ConnectorDefinition[] = [
  jiraConnector,
  asanaConnector,
  googleWorkspaceConnector,
  githubConnector,
]

const byId = new Map(CONNECTORS.map((c) => [c.id, c]))

export function listConnectors(): ConnectorDefinition[] {
  return [...CONNECTORS]
}

export function getConnector(id: ConnectorId): ConnectorDefinition | undefined {
  return byId.get(id)
}

export function requireConnector(id: ConnectorId): ConnectorDefinition {
  const c = getConnector(id)
  if (!c) {
    throw new Error(`Unknown integration connector: ${id}`)
  }
  return c
}
